import net from "net";
import { scrcpy_config } from "./config.js";

class VideoHandler {
  private static instance: VideoHandler;
  private socket: net.Socket | null = null;
  private connected = false;
  private onDataCallback: ((data: Buffer) => void) | null = null;

  private constructor() {}

  static getInstance(): VideoHandler {
    if (!VideoHandler.instance) {
      VideoHandler.instance = new VideoHandler();
    }
    return VideoHandler.instance;
  }

  // Set callback for when video data arrives
  onData(callback: (data: Buffer) => void): void {
    this.onDataCallback = callback;
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(scrcpy_config.video_port, "127.0.0.1", () => {
        console.log("Video socket connected");
        this.connected = true;
        resolve();
      });

      this.socket.on("data", (data) => {
        // Forward raw H.264 data to callback
        if (this.onDataCallback) {
          this.onDataCallback(data);
        }
      });

      this.socket.on("error", (err) => {
        console.error("Video socket error:", err);
        this.connected = false;
        reject(err);
      });

      this.socket.on("close", () => {
        console.log("Video socket closed");
        this.connected = false;
      });
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
      this.connected = false;
    }
  }
}

export const videoHandler = VideoHandler.getInstance();
