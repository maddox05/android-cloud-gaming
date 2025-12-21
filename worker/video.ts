import net from "net";
import { scrcpy_config } from "./config.js";

class VideoHandler {
  private static instance: VideoHandler;
  private socket: net.Socket | null = null;
  private connected = false;
  private onDataCallback: ((data: Buffer) => void) | null = null;
  private pendingData: Buffer[] = [];  // Buffer data until callback is set

  private constructor() {}

  static getInstance(): VideoHandler {
    if (!VideoHandler.instance) {
      VideoHandler.instance = new VideoHandler();
    }
    return VideoHandler.instance;
  }

  setCallback(callback: (data: Buffer) => void): void {
    this.onDataCallback = callback;

    // Flush any buffered data
    if (this.pendingData.length > 0) {
      console.log(`Flushing ${this.pendingData.length} buffered chunks`);
      for (const data of this.pendingData) {
        callback(data);
      }
      this.pendingData = [];
    }
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
        console.log("Received video data:", data.length, "bytes");

        if (this.onDataCallback) {
          this.onDataCallback(data);
        } else {
          // Buffer data until callback is set (don't lose SPS/PPS!)
          this.pendingData.push(Buffer.from(data));
          console.log("Buffering chunk (no callback yet), total buffered:", this.pendingData.length);
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
    this.onDataCallback = null;
    this.pendingData = [];
  }
}

export const videoHandler = VideoHandler.getInstance();
