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

    const {
      redroid_docker_container_name,
      redroid_docker_port,
      redroid_docker_image_name,
      redroid_docker_image_tag,
      redroid_width,
      redroid_height,
      redroid_dpi,
      redroid_fps,
    } = redroid_config;

    // Stop existing container if any
    try {
      await this.execAsync(`docker stop ${redroid_docker_container_name} 2>/dev/null || true`);
      await this.execAsync(`docker rm ${redroid_docker_container_name} 2>/dev/null || true`);
    } catch {}

    // Start redroid container
    console.log("Starting Redroid container...");
    const dockerCmd = `docker run -itd --rm --privileged --name ${redroid_docker_container_name} -v ~/data:/data -p ${redroid_docker_port}:5555 ${redroid_docker_image_name}:${redroid_docker_image_tag} androidboot.redroid_width=${redroid_width} androidboot.redroid_height=${redroid_height} androidboot.redroid_dpi=${redroid_dpi} androidboot.redroid_fps=${redroid_fps}`;

    await this.execAsync(dockerCmd);
    console.log("Container started, waiting for boot...");

    // Wait for adb to be ready
    await this.sleep(5000);

    // Connect adb
    console.log("Connecting ADB...");
    await this.execAsync(`adb connect localhost:${redroid_docker_port}`);
    await this.sleep(2000);

    // Wait for device to be fully booted
    console.log("Waiting for device to boot...");
    let booted = false;
    for (let i = 0; i < 30; i++) {
      try {
        const result = await this.execAsync(
          `adb -s localhost:${redroid_docker_port} shell getprop sys.boot_completed`
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

    // Push scrcpy server
    console.log("Pushing scrcpy server...");
    await this.execAsync(
      `adb -s localhost:${redroid_docker_port} push /opt/scrcpy/scrcpy-server /data/local/tmp/scrcpy-server.jar`
    );

    // Get scrcpy version
    const scrcpyVersion = (await this.execAsync("cat /opt/scrcpy/version")).trim();
    console.log(`Using scrcpy version: ${scrcpyVersion}`);

    // Setup port forward for scrcpy abstract socket
    console.log("Setting up port forward...");
    await this.execAsync(
      `adb -s localhost:${redroid_docker_port} forward tcp:${scrcpy_config.port} localabstract:scrcpy`
    );

    // Start scrcpy server with tunnel_forward=true, audio=false, control=true, raw_stream=true
    console.log("Starting scrcpy server...");
    this.scrcpyProc = spawn(
      "adb",
      [
        "-s",
        `localhost:${redroid_docker_port}`,
        "shell",
        `CLASSPATH=/data/local/tmp/scrcpy-server.jar app_process / com.genymobile.scrcpy.Server ${scrcpyVersion} tunnel_forward=true audio=false control=true cleanup=false raw_stream=true max_size=${redroid_width}`,
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

    // Wait for scrcpy to be ready (it starts listening on the abstract socket)
    await this.sleep(2000);

    this.running = true;
    console.log("RedroidRunner started successfully!");
    console.log(`scrcpy port: ${scrcpy_config.port} (connect twice: video first, then control)`);
  }

  getScrcpyPort(): number {
    return scrcpy_config.port;
  }

  getScreenWidth(): number {
    return redroid_config.redroid_width;
  }

  getScreenHeight(): number {
    return redroid_config.redroid_height;
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    if (this.scrcpyProc) {
      this.scrcpyProc.kill();
      this.scrcpyProc = null;
    }

    try {
      await this.execAsync(`docker stop ${redroid_config.redroid_docker_container_name}`);
    } catch {}

    this.running = false;
    console.log("RedroidRunner stopped");
  }
}

export const redroidRunner = RedroidRunner.getInstance();
