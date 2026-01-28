import { BaseConnectionHandler } from "./base_socket.js";

class VideoHandler extends BaseConnectionHandler {
  private static instance: VideoHandler;
  private onDataCallback: ((data: Buffer) => void) | null = null;
  private canSendVideo = false;

  private constructor() {
    super("Video");
  }

  setCanSendVideo(value: boolean) {
    this.canSendVideo = value;
  }

  static getInstance(): VideoHandler {
    if (!VideoHandler.instance) {
      VideoHandler.instance = new VideoHandler();
    }
    return VideoHandler.instance;
  }

  setCallback(callback: (data: Buffer) => void): void {
    this.onDataCallback = callback;
  }

  protected onData(data: Buffer): void {
    if (this.onDataCallback && this.canSendVideo) {
      this.onDataCallback(data);
    }
  }

  protected onClose(): void {
    this.onDataCallback = null;
  }
}

export const videoHandler = VideoHandler.getInstance();
