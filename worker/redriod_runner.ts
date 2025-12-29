import { spawn, exec, execSync } from "child_process";
import { redroid_config, scrcpy_config } from "./config.js";

const POD_NAME = process.env.POD_NAME;
if (!POD_NAME) {
  console.error("POD_NAME environment variable is required");
  process.exit(1);
}

class RedroidRunner {
  private static instance: RedroidRunner;
  private running = false;
  private scrcpyProc: ReturnType<typeof spawn> | null = null;
  private adbTarget: string;

  private constructor() {
    const { host, port } = redroid_config;
    this.adbTarget = `${host}:${port}`;
  }

  static getInstance(): RedroidRunner {
    if (!RedroidRunner.instance) {
      RedroidRunner.instance = new RedroidRunner();
    }
    return RedroidRunner.instance;
  }

  isRunning(): boolean {
    return this.running;
  }

  private execAsync(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(cmd, (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve(stdout.trim());
      });
    });
  }

  /**
   * Execute command but don't throw on non-zero exit - just return output
   * Useful for commands that print to stderr but still succeed
   */
  private execAsyncSafe(cmd: string): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve) => {
      exec(cmd, (error, stdout, stderr) => {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          code: error ? (error as any).code || 1 : 0,
        });
      });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Start the redroid runner with a specific game package.
   * Sets up kiosk mode - hides navigation, launches game, and locks user in.
   */
  async start(packageName: string): Promise<void> {
    if (this.running) {
      console.log("RedroidRunner already running");
      return;
    }

    const { height, video_bit_rate, max_fps } = redroid_config;

    // Connect adb (retry a few times in case redroid isn't ready yet)
    console.log(`Connecting ADB to ${this.adbTarget}...`);
    let adbConnected = false;
    for (let i = 0; i < 10; i++) {
      try {
        await this.execAsync(`adb connect ${this.adbTarget}`);
        adbConnected = true;
        break;
      } catch {
        console.log(`ADB connect attempt ${i + 1} failed, retrying...`);
        await this.sleep(1000);
      }
    }
    if (!adbConnected) {
      throw new Error("Failed to connect ADB");
    }

    // Wait for device to be fully booted
    console.log("Waiting for device to boot...");
    let booted = false;
    for (let i = 0; i < 30; i++) {
      try {
        const result = await this.execAsync(
          `adb -s ${this.adbTarget} shell getprop sys.boot_completed`
        );
        if (result === "1") {
          booted = true;
          break;
        }
      } catch {}
      await this.sleep(1000);
    }

    if (!booted) {
      throw new Error("Device failed to boot");
    }
    console.log("Device booted!");

    // Kill any existing scrcpy processes (from previous worker runs)
    console.log("Killing any existing scrcpy processes...");
    try {
      await this.execAsync(`adb -s ${this.adbTarget} shell pkill -f scrcpy`);
    } catch {
      // Ignore error if no process found
    }
    await this.sleep(500);

    // Remove old port forward
    console.log("Removing old port forwards...");
    try {
      await this.execAsync(`adb -s ${this.adbTarget} forward --remove-all`);
    } catch {
      // Ignore error
    }

    // Push scrcpy server
    console.log("Pushing scrcpy server...");
    await this.execAsync(
      `adb -s ${this.adbTarget} push ./assets/scrcpy/scrcpy-server /data/local/tmp/scrcpy-server.jar`
    );

    // Get scrcpy version
    const scrcpyVersion = (await this.execAsync("cat ./assets/scrcpy/version")).trim();
    console.log(`Using scrcpy version: ${scrcpyVersion}`);

    // Setup port forward for scrcpy abstract socket
    console.log("Setting up port forward...");
    await this.execAsync(
      `adb -s ${this.adbTarget} forward tcp:${scrcpy_config.port} localabstract:scrcpy`
    );

    // Start scrcpy server
    console.log("Starting scrcpy server...");
    this.scrcpyProc = spawn(
      "adb",
      [
        "-s",
        this.adbTarget,
        "shell",
        `CLASSPATH=/data/local/tmp/scrcpy-server.jar app_process / com.genymobile.scrcpy.Server ${scrcpyVersion} tunnel_forward=true audio=false control=true cleanup=false raw_stream=true max_size=${height} max_fps=${max_fps} video_bit_rate=${video_bit_rate} video_codec_options=profile=1,level=256,i-frame-interval=1`,
      ],
      { stdio: "pipe" }
    );

    this.scrcpyProc.stdout?.on("data", (data) => {
      console.log("scrcpy:", data.toString().trim());
    });

    this.scrcpyProc.stderr?.on("data", (data) => {
      console.error("scrcpy err:", data.toString().trim());
      throw new Error(`scrcpy error: ${data.toString().trim()}`);
    });

    this.scrcpyProc.on("error", (err) => console.error("scrcpy error:", err));
    this.scrcpyProc.on("exit", (code) => console.log("scrcpy exited with code:", code));

    // Wait for scrcpy to be ready
    await this.sleep(2000);

    this.running = true;
    console.log("RedroidRunner started successfully!");
    console.log(`scrcpy port: ${scrcpy_config.port} (connect twice: video first, then control)`);

    // Setup kiosk mode AFTER scrcpy is running
    await this.setupKioskMode(packageName);
  }

  /**
   * Setup kiosk mode - launch game in fullscreen immersive mode
   */
  private async setupKioskMode(packageName: string): Promise<void> {
    console.log(`Setting up kiosk mode for ${packageName}...`);

    // Hide nav bar and status bar with immersive mode
    await this.execAsyncSafe(
      `adb -s ${this.adbTarget} shell settings put global policy_control immersive.full=*`
    );

    // Get the launcher activity for this package
    console.log(`Finding launcher activity for ${packageName}...`);
    const activityResult = await this.execAsyncSafe(
      `adb -s ${this.adbTarget} shell cmd package resolve-activity --brief -c android.intent.category.LAUNCHER ${packageName}`
    );
    console.log(`Activity resolve: ${activityResult.stdout}`);

    // Parse the activity (last line of output like "com.package/com.package.Activity")
    const lines = activityResult.stdout.split('\n').filter(l => l.trim());
    const activity = lines[lines.length - 1]?.trim();

    if (activity && activity.includes('/')) {
      console.log(`Launching with am start: ${activity}`);
      const result = await this.execAsyncSafe(
        `adb -s ${this.adbTarget} shell am start -n ${activity}`
      );
      console.log(`Launch result: ${result.stdout}`);
      if (result.stderr) console.log(`Launch stderr: ${result.stderr}`);
    } else {
      // Fallback to monkey
      console.log(`Fallback: launching with monkey...`);
      await this.execAsyncSafe(
        `adb -s ${this.adbTarget} shell monkey -p ${packageName} --pct-syskeys 0 -c android.intent.category.LAUNCHER 1`
      );
    }

    console.log("Kiosk mode setup complete!");
  }


  /**
   * Restart the redroid container via Docker.
   * Used to get a fresh state when worker restarts.
   */
  restartContainer(): void {
    const containerName = `${POD_NAME}-redroid-1`;
    console.log(`Restarting redroid container: ${containerName}`);
    try {
      execSync(`docker restart ${containerName}`, { stdio: "inherit" });
      this.running = false; // Reset state since container is fresh
    } catch (e) {
      console.error("Failed to restart redroid container:", e);
    }
  }
}

export const redroidRunner = RedroidRunner.getInstance();
