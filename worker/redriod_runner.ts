import { spawn, exec, execSync } from "child_process";
import { REDROID_SCRCPY_SERVER_SETTINGS } from "../shared/const.js";

const WORKER_NAME = process.env.WORKER_NAME;
if (!WORKER_NAME) {
  console.error("WORKER_NAME environment variable is required");
  process.exit(1);
}

const FREE_KIOSK_PIN = process.env.FREE_KIOSK_PIN;
if (!FREE_KIOSK_PIN) {
  console.error("FREE_KIOSK_PIN environment variable is required");
  process.exit(1);
}

class RedroidRunner {
  private static instance: RedroidRunner;
  private running = false;
  private scrcpyProc: ReturnType<typeof spawn> | null = null;
  private adbTarget: string | null = null;
  private host: string | null = null;
  private port: number | null = null;
  private maxVideoSize: number | null;
  private videoSizeInterval: ReturnType<typeof setInterval> | null = null;

  public videoWidth: number = 0;
  public videoHeight: number = 0;

  private getRedroidHost(): string {
    // With network_mode: host, we need to find the container's IP via Docker
    const workerName = process.env.WORKER_NAME;
    if (workerName) {
      try {
        const containerName = `${workerName}-redroid-1`;
        const ip = execSync(
          `docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${containerName}`,
          { encoding: "utf-8" },
        ).trim();
        if (ip) {
          console.log(`Resolved redroid container IP: ${ip}`);
          return ip;
        }
      } catch (e) {
        console.warn(
          "Failed to get redroid container IP, falling back to localhost",
        );
      }
    }

    return "localhost";
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

  private execAsync(
    cmd: string,
  ): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve, reject) => {
      exec(cmd, (error, stdout, stderr) => {
        const result = {
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          code: error ? (error as any).code || 1 : 0,
        };
        if (error) reject(Object.assign(error, result));
        else resolve(result);
      });
    });
  }

  /**
   * Execute command but don't throw on non-zero exit - just return output
   * Useful for commands that print to stderr but still succeed
   */
  private execAsyncSafe(
    cmd: string,
  ): Promise<{ stdout: string; stderr: string; code: number }> {
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
  async start(packageName: string, maxSize: number): Promise<void> {
    if (this.running) {
      console.log("RedroidRunner already running");
      return;
    }

    this.maxVideoSize = maxSize;

    this.host = this.getRedroidHost();
    this.port = 5555;
    this.adbTarget = `${this.host}:${this.port}`;

    // Connect adb (retry a few times in case redroid isn't ready yet)
    console.log(`Connecting ADB to ${this.adbTarget}...`);
    let adbConnected = false;
    for (let i = 0; i < 10; i++) {
      try {
        const response = await this.execAsync(`adb connect ${this.adbTarget}`);
        if (!response.stdout.includes("connected")) {
          throw new Error("Failed to connect ADB");
        }
        adbConnected = true;
        break;
      } catch (err) {
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
          `adb -s ${this.adbTarget} shell getprop sys.boot_completed`,
        );
        if (result.stdout === "1") {
          booted = true;
          break;
        }
      } catch (err) {
        console.log(`Boot check attempt ${i + 1} failed:`);
      }
      await this.sleep(1000);
    }

    if (!booted) {
      throw new Error("Device failed to boot");
    }
    console.log("Device booted!");

    await this.spoofWithMagisk(); //help

    // Run FreeKiosk setup and scrcpy setup in parallel

    await Promise.all([
      this.setupKioskModeUsingFreeKiosk(packageName),
      // this needs to wait a few secs so its sockets can open but kiosk takes longer, so we dont need to wait
      // todo somehow check if scrcpy video and input sockets are readyß
    ]); // scrcpy wont send video until redriodRunner.start() finishes so this is fine!
    await this.setupScrcpy();
    this.running = true;

    console.log("RedroidRunner started successfully!");

    // Start polling video size every 5 seconds
    this.startVideoSizePolling();
  }

  /**
   * Start polling video size every 5 seconds
   */
  private startVideoSizePolling(): void {
    // Get initial size immediately
    this.updateVideoSize();

    // Then poll every 5 seconds
    this.videoSizeInterval = setInterval(() => {
      this.updateVideoSize();
    }, 3000);
  }

  /**
   * Update the video width/height from the device
   */
  private async updateVideoSize(): Promise<void> {
    const size = await this.getVideoSize();
    if (size) {
      this.videoWidth = size.width;
      this.videoHeight = size.height;
    }
  }

  /**
   * Setup kiosk mode using FreeKiosk app.
   * Locks the device to the specified app with auto-relaunch on crash.
   * Requires FreeKiosk to be installed on the device.
   */
  private async setupKioskModeUsingFreeKiosk(
    packageName: string,
  ): Promise<void> {
    console.log(`Setting up kiosk mode for ${packageName} using FreeKiosk...`);

    // Configure FreeKiosk - exact format from docs Cloud Gaming example
    console.log(`Configuring FreeKiosk to lock to ${packageName}...`);
    const kioskCmd = `adb -s ${this.adbTarget} shell am start -n com.freekiosk/.MainActivity --es lock_package "${packageName}" --es pin "${FREE_KIOSK_PIN}" --es auto_relaunch "true" --ez auto_start true`;

    console.log("Running:", kioskCmd);
    const configResult = await this.execAsync(kioskCmd);
    console.log("Config result:", configResult);

    // Wait for FreeKiosk to save config
    await this.sleep(10000);

    // Launch FreeKiosk to activate the lock
    console.log("Launching FreeKiosk to activate lock...");
    const launchResult = await this.execAsync(
      `adb -s ${this.adbTarget} shell am start -n com.freekiosk/.MainActivity`,
    );
    console.log("Launch result:", launchResult);

    await this.sleep(2000);
    console.log("Kiosk mode setup complete!");
  }

  /**
   * Setup scrcpy server for video streaming.
   * Kills existing processes, pushes server, and starts streaming.
   */
  private async setupScrcpy(): Promise<void> {
    const s = REDROID_SCRCPY_SERVER_SETTINGS;

    // Kill any existing scrcpy processes (from previous worker runs)
    console.log("Killing any existing scrcpy processes...");
    try {
      await this.execAsync(`adb -s ${this.adbTarget} shell pkill -f scrcpy`);
    } catch (err) {
      console.log("No existing scrcpy process to kill (or pkill failed):");
    }
    await this.sleep(500);

    // Remove old port forward
    console.log("Removing old port forwards...");
    try {
      await this.execAsync(`adb -s ${this.adbTarget} forward --remove-all`);
      await this.execAsync(`adb -s ${this.adbTarget} reverse --remove-all`);
    } catch (err) {
      console.warn("Failed to remove old port forwards:");
    }

    // Push scrcpy server
    console.log("Pushing scrcpy server...");
    await this.execAsync(
      `adb -s ${this.adbTarget} push ./assets/scrcpy/scrcpy-server /data/local/tmp/scrcpy-server.jar`,
    );

    // Get scrcpy version
    const scrcpyVersion = (await this.execAsync("cat ./assets/scrcpy/version"))
      .stdout;
    console.log(`Using scrcpy version: ${scrcpyVersion}`);

    // Setup port reverse for scrcpy abstract socket
    console.log("Setting up port reverse...");
    await this.execAsync(
      `adb -s ${this.adbTarget} reverse localabstract:scrcpy tcp:6767`,
    );

    // Start scrcpy server
    console.log("Starting scrcpy server...");
    const videoCodecOpts = `profile=${s.videoCodecOptions.profile},level=${s.videoCodecOptions.level},i-frame-interval=${s.videoCodecOptions.iFrameInterval}`;
    const scrcpyCmd = [
      `CLASSPATH=/data/local/tmp/scrcpy-server.jar app_process / com.genymobile.scrcpy.Server ${scrcpyVersion}`,
      // `send_device_meta=${s.sendDeviceMeta}`,
      // `send_codec_meta=${s.sendCodecMeta}`,
      // `send_frame_meta=${s.sendFrameMeta}`,
      `tunnel_forward=${s.tunnelForward}`,
      `audio=${s.audio}`,
      `control=${s.control}`,
      `cleanup=${s.cleanup}`,
      `raw_stream=${s.rawStream}`, //todo switch from raw_stream to non
      `max_size=${this.maxVideoSize}`,
      `max_fps=${s.maxFps}`,
      `video_bit_rate=${s.videoBitRate}`,
      `video_codec_options=${videoCodecOpts}`,
      // `video=${s.video}`,
    ].join(" ");

    this.scrcpyProc = spawn(
      "adb",
      ["-s", this.adbTarget!, "shell", scrcpyCmd],
      {
        stdio: "pipe",
      },
    );

    this.scrcpyProc.stdout?.on("data", (data) => {
      console.log("scrcpy:", data.toString().trim());
    });

    this.scrcpyProc.stderr?.on("data", (data) => {
      console.error("scrcpy err:", data.toString().trim());
      throw new Error(`scrcpy error: ${data.toString().trim()}`);
    });

    this.scrcpyProc.on("error", (err) => console.error("scrcpy error:", err));
    this.scrcpyProc.on("exit", (code) =>
      console.log("scrcpy exited with code:", code),
    );

    console.log("Scrcpy setup complete!");
  }

  /**
   * Spoof device properties using Magisk's resetprop to appear as a Samsung Galaxy S21 FE.
   * Requires root access (su) and Magisk installed on the device.
   */
  private async spoofWithMagisk(): Promise<void> {
    if (!this.adbTarget) {
      throw new Error("ADB target not set - call start() first");
    }

    console.log("Spoofing device properties with Magisk...");

    const spoofCmd = `su 0 sh -c 'resetprop ro.product.model SM-S9010 && resetprop ro.product.manufacturer samsung && resetprop ro.product.brand samsung && resetprop ro.product.name r9q && resetprop ro.product.device r9q && resetprop ro.product.board lahaina && resetprop ro.build.fingerprint samsung/r9qxxx/r9q:12/SP1A.210812.016.C1/S9010XXU1AVA1:user/release-keys && resetprop ro.build.id SP1A.210812.016.C1 && resetprop ro.build.display.id SP1A.210812.016.C1 && resetprop ro.build.version.release 12 && resetprop ro.build.version.sdk 31 && resetprop ro.build.version.security_patch 2022-01-01 && resetprop ro.build.type user && resetprop ro.build.tags release-keys && resetprop ro.bootloader S9010XXU1AVA1 && resetprop ro.hardware qcom && resetprop ro.board.platform lahaina && resetprop ro.boot.hardware qcom && resetprop ro.product.first_api_level 31 && resetprop ro.vendor.product.model SM-S9010 && resetprop ro.vendor.product.manufacturer samsung && resetprop ro.vendor.product.brand samsung && resetprop ro.system.product.model SM-S9010 && resetprop ro.system.product.manufacturer samsung && resetprop ro.system.product.brand samsung && resetprop ro.odm.product.model SM-S9010 && resetprop ro.odm.product.manufacturer samsung && resetprop ro.odm.product.brand samsung && resetprop ro.boot.verifiedbootstate green && resetprop ro.boot.flash.locked 1 && resetprop ro.boot.vbmeta.device_state locked && resetprop ro.secure 1 && resetprop ro.debuggable 0 && resetprop ro.adb.secure 1 && resetprop ro.boot.selinux enforcing && resetprop ro.build.selinux 1 && resetprop ro.kernel.qemu 0 && resetprop ro.kernel.qemu.gles 0 && resetprop ro.hardware.virtual_device 0 && resetprop ro.boot.qemu 0 && resetprop ro.bootmode unknown && resetprop gsm.version.baseband S9010XXU1AVA1 && resetprop ro.baseband S9010XXU1AVA1 && resetprop ro.serialno R5CT12345678 && resetprop ro.boot.serialno R5CT12345678 && resetprop persist.sys.dalvik.vm.lib.2 libart.so && resetprop dalvik.vm.isa.arm64.variant cortex-a76 && resetprop ro.product.cpu.abi arm64-v8a && resetprop ro.product.cpu.abilist arm64-v8a,armeabi-v7a,armeabi && resetprop ro.product.cpu.abilist64 arm64-v8a && resetprop ro.zygote zygote64_32 && resetprop ro.bionic.cpu_variant cortex-a76 && resetprop ro.soc.manufacturer Qualcomm && resetprop ro.soc.model SM8350 && settings put global device_name Galaxy_S21_FE && echo FULL_SPOOF_DONE'`;

    const result = await this.execAsyncSafe(
      `adb -s ${this.adbTarget} shell "${spoofCmd}"`,
    );

    if (result.stdout.includes("FULL_SPOOF_DONE")) {
      console.log("Device spoofing complete!");
    } else {
      console.warn("Spoofing may have failed:", result.stdout, result.stderr);
    }
  }

  /**
   * Get the current video dimensions that the adb device is at
   * Queries the device display size, checks rotation, and applies max_size scaling to match scrcpy's output size.
   */
  async getVideoSize(): Promise<{ width: number; height: number } | null> {
    if (!this.maxVideoSize) {
      throw new Error("maxVideoSize not set");
    }
    try {
      const result = await this.execAsync(
        `adb -s ${this.adbTarget} shell wm size`,
      );
      const match = result.stdout.match(/(\d+)x(\d+)/);
      if (match) {
        let width = parseInt(match[1]);
        let height = parseInt(match[2]);

        // Check display rotation and swap if landscape (rotation 1 or 3)
        const rotationResult = await this.execAsyncSafe(
          `adb -s ${this.adbTarget} shell dumpsys window | grep -E 'mCurrentRotation|rotation='`,
        );
        const rotationMatch = rotationResult.stdout.match(
          /(?:mCurrentRotation|rotation)=(\d)/,
        );
        const rotation = rotationMatch ? parseInt(rotationMatch[1]) : 0;
        if (rotation === 1 || rotation === 3) {
          [width, height] = [height, width];
        }

        // Apply max_size scaling (scrcpy scales the larger dimension)
        const maxSize = this.maxVideoSize;
        const maxDim = Math.max(width, height);
        if (maxDim > maxSize) {
          const scale = maxSize / maxDim;
          width = Math.floor(width * scale);
          height = Math.floor(height * scale);
        }
        return { width, height };
      }
    } catch (err) {
      console.warn("Failed to get video size:", err);
    }
    return null;
  }

  /**
   * Stop the redroid container without restarting.
   * Used to perform volume operations (save/restore) between stop and start.
   * ASYNC to avoid blocking the event loop during WebRTC signaling.
   */
  async stopContainer(): Promise<void> {
    const containerName = `${WORKER_NAME}-redroid-1`;
    console.log(`Stopping redroid container: ${containerName}`);

    // Stop video size polling
    if (this.videoSizeInterval) {
      clearInterval(this.videoSizeInterval);
      this.videoSizeInterval = null;
    }

    // Kill scrcpy process if running
    if (this.scrcpyProc) {
      this.scrcpyProc.kill();
      this.scrcpyProc = null;
    }

    try {
      await this.execAsync(`docker stop -t 0 ${containerName}`);
    } catch (e) {
      console.warn("Failed to stop redroid container:");
    }
    await this.sleep(1000);

    try {
      await this.execAsync(`docker rm ${containerName}`);
    } catch (e) {
      console.warn("Failed to remove redroid container:");
    }

    this.running = false;
    this.videoWidth = 0;
    this.videoHeight = 0;
  }

  /**
   * Recreate the redroid container (after removal).
   * Uses docker compose to recreate with proper config.
   * ASYNC to avoid blocking the event loop during WebRTC signaling.
   */
  async startContainer(): Promise<void> {
    console.log(`Recreating redroid container for project: ${WORKER_NAME}`);

    try {
      await this.execAsync(
        `docker compose -f /app/docker-compose.worker.yml -p ${WORKER_NAME} up -d redroid`,
      );
      // Note: running flag will be set in start() after ADB connects
    } catch (e) {
      console.error("Failed to recreate redroid container:", e);
      throw e;
    }
  }

  /**
   * Get the diff volume name for this worker
   */
  getDiffVolumeName(): string {
    return `${WORKER_NAME}-redroid-diff`;
  }
}

export const redroidRunner = RedroidRunner.getInstance();
