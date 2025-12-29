import net from "net";
import { scrcpy_config, redroid_config } from "./config.js";
import { InputMessage } from "../shared/types.js";

// scrcpy control message types
const SC_CONTROL_MSG_TYPE_INJECT_TOUCH_EVENT = 2;
const SC_CONTROL_MSG_TYPE_RESET_VIDEO = 17;

// Android MotionEvent actions
const ACTION_DOWN = 0;
const ACTION_UP = 1;
const ACTION_MOVE = 2;

// Touch pointer ID - use simple ID for finger touch
const POINTER_ID_FINGER = BigInt(0); // todo allow for multiple inputs at same time

class InputHandler {
  private static instance: InputHandler;
  private socket: net.Socket | null = null;
  private connected = false;
  private screenWidth = redroid_config.width;
  private screenHeight = redroid_config.height;
  private touchBuffer = Buffer.alloc(32);  // Pre-allocated, reused for every touch
  private constructor() {}


  static getInstance(): InputHandler {
    if (!InputHandler.instance) {
      InputHandler.instance = new InputHandler();
    }
    return InputHandler.instance;
  }


  async connect(): Promise<void> {
    if (this.connected) return;

    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(scrcpy_config.port, "127.0.0.1", () => {
        console.log("Input/Control socket connected");
        this.socket!.setNoDelay(true);  // Disable Nagle's algorithm for lower latency
        this.connected = true;
        resolve();
      });

      this.socket.on("error", (err) => {
        console.error("Input socket error:", err);
        this.connected = false;
        reject(err);
      });

      this.socket.on("close", () => {
        console.log("Input socket closed");
        this.connected = false;
      });

      this.socket.on("data", (data) => {
        // Device messages - ignore for now
      });
    });
  }

  /**
   * Build scrcpy INJECT_TOUCH_EVENT message
   * Format based on py-scrcpy-client and scrcpy source:
   * - type: u8 (1 byte)
   * - action: u8 (1 byte)
   * - pointerId: i64 BE (8 bytes)
   * - x: i32 BE (4 bytes)
   * - y: i32 BE (4 bytes)
   * - width: u16 BE (2 bytes)
   * - height: u16 BE (2 bytes)
   * - pressure: u16 BE (2 bytes) - 0xFFFF for touch
   * - actionButton: i32 BE (4 bytes) - 1 for primary
   * - buttons: i32 BE (4 bytes) - 1 for primary
   */
  private buildTouchMessage(
    action: number,
    xPercent: number,
    yPercent: number
  ): Buffer {
    const buf = this.touchBuffer;  // Reuse pre-allocated buffer

    const x = xPercent * this.screenWidth;
    const y = yPercent * this.screenHeight;

    // Message type (1 byte)
    buf.writeUInt8(SC_CONTROL_MSG_TYPE_INJECT_TOUCH_EVENT, 0);
    // Action (1 byte)
    buf.writeUInt8(action, 1);
    // Pointer ID (8 bytes) - use 0 for single finger
    buf.writeBigInt64BE(POINTER_ID_FINGER, 2);
    // Position X (4 bytes)
    buf.writeInt32BE(Math.floor(x), 10);
    // Position Y (4 bytes)
    buf.writeInt32BE(Math.floor(y), 14);
    // Screen width (2 bytes)
    buf.writeUInt16BE(this.screenWidth, 18);
    // Screen height (2 bytes)
    buf.writeUInt16BE(this.screenHeight, 20);
    // Pressure (2 bytes) - 0xFFFF for full pressure, 0 for UP
    buf.writeUInt16BE(action === ACTION_UP ? 0 : 0xFFFF, 22);
    // Action button (4 bytes) - 0 for touch
    buf.writeUInt32BE(0, 24);
    // Buttons (4 bytes) - 0 for touch
    buf.writeUInt32BE(0, 28);

    return buf;
  }

  sendInput(msg: InputMessage): void {
    if (!this.socket || !this.connected) {
      console.warn("Input socket not connected");
      return;
    }

    let action: number;
    let xPercent: number;
    let yPercent: number;

    if (msg.type === "drag") {
      xPercent = msg.xPercent;
      yPercent = msg.yPercent;

      switch (msg.action) {
        case "start":
          action = ACTION_DOWN;
          break;
        case "move":
          action = ACTION_MOVE;
          break;
        case "end":
        case "cancel":
          action = ACTION_UP;
          break;
        default:
          return;
      }
    } else if (msg.type === "click") {
      xPercent = msg.xPercent;
      yPercent = msg.yPercent;
      action = msg.action === "down" ? ACTION_DOWN : ACTION_UP;
    } else {
      return;
    }

    const buf = this.buildTouchMessage(action, xPercent, yPercent);
    this.socket.write(buf);
  }


  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
      this.connected = false;
    }
  }

  /**
   * Send RESET_VIDEO control message to scrcpy
   * This forces scrcpy to send a fresh SPS/PPS/IDR sequence
   * Useful when a new client connects and needs an immediate keyframe
   */
  resetVideo(): void {
    if (!this.socket || !this.connected) {
      console.warn("Cannot reset video: control socket not connected");
      return;
    }

    const buf = Buffer.alloc(1);
    buf.writeUInt8(SC_CONTROL_MSG_TYPE_RESET_VIDEO, 0);
    this.socket.write(buf);
    console.log("Sent RESET_VIDEO to scrcpy");
  }
}

export const inputHandler = InputHandler.getInstance();
