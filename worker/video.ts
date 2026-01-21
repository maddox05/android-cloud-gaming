import { BaseConnectionHandler } from "./base_socket.js";

class VideoHandler extends BaseConnectionHandler {
  private static instance: VideoHandler;
  private onDataCallback: ((data: Buffer) => void) | null = null;
  private pendingData: Buffer[] = [];

  private constructor() {
    super("Video");
  }

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

  protected onData(data: Buffer): void {
    if (this.onDataCallback) {
      this.onDataCallback(data);
    } else {
      // Buffer data until callback is set (don't lose SPS/PPS!)
      this.pendingData.push(data);
    }
  }

  protected onClose(): void {
    this.onDataCallback = null;
    this.pendingData = [];
  }
}

export const videoHandler = VideoHandler.getInstance();
