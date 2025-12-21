import { spawn, exec } from "child_process";
import { redroid_config, scrcpy_config } from "./config.js";

class RedroidRunner {
  private static instance: RedroidRunner;
  private running = false;
  private scrcpyProc: ReturnType<typeof spawn> | null = null;

  private constructor() {}

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

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  async start(): Promise<void> {
    if (this.running) {
      console.log("RedroidRunner already running");
      return;
    }

    const { host, port, height } = redroid_config;
    const adbTarget = `${host}:${port}`;

    // Connect adb (retry a few times in case redroid isn't ready yet)
    console.log(`Connecting ADB to ${adbTarget}...`);
    let adbConnected = false;
    for (let i = 0; i < 10; i++) {
      try {
        await this.execAsync(`adb connect ${adbTarget}`);
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
          `adb -s ${adbTarget} shell getprop sys.boot_completed`
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
      await this.execAsync(`adb -s ${adbTarget} shell pkill -f scrcpy`);
    } catch {
      // Ignore error if no process found
    }
    await this.sleep(500);

    // Remove old port forward
    console.log("Removing old port forwards...");
    try {
      await this.execAsync(`adb -s ${adbTarget} forward --remove-all`);
    } catch {
      // Ignore error
    }

    // Push scrcpy server
    console.log("Pushing scrcpy server...");
    await this.execAsync(
      `adb -s ${adbTarget} push ./assets/scrcpy/scrcpy-server /data/local/tmp/scrcpy-server.jar`
    );

    // Get scrcpy version
    const scrcpyVersion = (await this.execAsync("cat ./assets/scrcpy/version")).trim();
    console.log(`Using scrcpy version: ${scrcpyVersion}`);

    // Setup port forward for scrcpy abstract socket
    console.log("Setting up port forward...");
    await this.execAsync(
      `adb -s ${adbTarget} forward tcp:${scrcpy_config.port} localabstract:scrcpy`
    );

    // Start scrcpy server
    console.log("Starting scrcpy server...");
    this.scrcpyProc = spawn(
      "adb",
      [
        "-s",
        adbTarget,
        "shell",
        `CLASSPATH=/data/local/tmp/scrcpy-server.jar app_process / com.genymobile.scrcpy.Server ${scrcpyVersion} tunnel_forward=true audio=false control=true cleanup=false raw_stream=true max_size=${height} video_codec_options=i-frame-interval:int=2`,
      ],
      { stdio: "pipe" }
    );

    this.scrcpyProc.stdout?.on("data", (data) => {
      console.log("scrcpy:", data.toString().trim());
    });

    this.scrcpyProc.stderr?.on("data", (data) => {
      console.error("scrcpy err:", data.toString().trim());
    });

    this.scrcpyProc.on("error", (err) => console.error("scrcpy error:", err));
    this.scrcpyProc.on("exit", (code) => console.log("scrcpy exited with code:", code));

    // Wait for scrcpy to be ready
    await this.sleep(2000);

    this.running = true;
    console.log("RedroidRunner started successfully!");
    console.log(`scrcpy port: ${scrcpy_config.port} (connect twice: video first, then control)`);
  }

  getScrcpyPort(): number {
    return scrcpy_config.port;
  }

  getScreenWidth(): number {
    return redroid_config.width;
  }

  getScreenHeight(): number {
    return redroid_config.height;
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    const { host, port } = redroid_config;
    const adbTarget = `${host}:${port}`;

    // Kill local process handle
    if (this.scrcpyProc) {
      this.scrcpyProc.kill();
      this.scrcpyProc = null;
    }

    // Kill scrcpy on the device
    console.log("Killing scrcpy on device...");
    try {
      await this.execAsync(`adb -s ${adbTarget} shell pkill -f scrcpy`);
    } catch {
      // Ignore error if no process found
    }

    // Remove port forwards
    try {
      await this.execAsync(`adb -s ${adbTarget} forward --remove-all`);
    } catch {
      // Ignore error
    }

    this.running = false;
    console.log("RedroidRunner stopped");
  }
}

export const redroidRunner = RedroidRunner.getInstance();
