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

  /**
   * Connect to scrcpy video socket.
   * IMPORTANT: This MUST be called BEFORE inputHandler.connect()
   * scrcpy expects connections in order: video first, then control
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(scrcpy_config.port, "127.0.0.1", () => {
        console.log("Video socket connected (first connection)");
        this.connected = true;
        resolve();
      });

      this.socket.on("data", (data) => {
        // Forward raw H.264 data to callback
        // With raw_stream=true, this is pure H.264 without any headers
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
