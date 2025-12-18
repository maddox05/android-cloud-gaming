import net from "net";
import { scrcpy_config } from "./config.js";
import { redroidRunner } from "./redriod_runner.js";
import { InputMessage } from "./types.js";

// scrcpy control message types (from control_msg.h)
const SC_CONTROL_MSG_TYPE_INJECT_TOUCH_EVENT = 2;

// Android MotionEvent actions
const AMOTION_EVENT_ACTION_DOWN = 0;
const AMOTION_EVENT_ACTION_UP = 1;
const AMOTION_EVENT_ACTION_MOVE = 2;

// Android MotionEvent buttons
const AMOTION_EVENT_BUTTON_PRIMARY = 1 << 0;

class InputHandler {
  private static instance: InputHandler;
  private socket: net.Socket | null = null;
  private connected = false;

  private constructor() {}

  static getInstance(): InputHandler {
    if (!InputHandler.instance) {
      InputHandler.instance = new InputHandler();
    }
    return InputHandler.instance;
  }

  // Connect to scrcpy control socket (must be called AFTER video socket connects)
  async connect(): Promise<void> {
    if (this.connected) return;

    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(scrcpy_config.port, "127.0.0.1", () => {
        console.log("Input/Control socket connected");
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

      // Control socket can receive device messages (e.g., clipboard)
      // For MVP we ignore them
      this.socket.on("data", (data) => {
        // Device messages - ignore for now
      });
    });
  }

  /**
   * Build scrcpy INJECT_TOUCH_EVENT message (32 bytes total)
   * Format from scrcpy protocol:
   * - type: u8 (1 byte) = 2 for inject touch
   * - action: u8 (1 byte)
   * - pointerId: i64 BE (8 bytes)
   * - x: i32 BE (4 bytes)
   * - y: i32 BE (4 bytes)
   * - screenWidth: u16 BE (2 bytes)
   * - screenHeight: u16 BE (2 bytes)
   * - pressure: u16 BE (2 bytes) - fixed point 0-0xFFFF
   * - actionButton: i32 BE (4 bytes)
   * - buttons: i32 BE (4 bytes)
   */
  private buildTouchMessage(
    action: number,
    pointerId: number,
    x: number,
    y: number,
    pressure: number
  ): Buffer {
    const buf = Buffer.alloc(32);
    let offset = 0;

    const screenWidth = redroidRunner.getScreenWidth();
    const screenHeight = redroidRunner.getScreenHeight();

    // Message type (1 byte)
    buf.writeUInt8(SC_CONTROL_MSG_TYPE_INJECT_TOUCH_EVENT, offset);
    offset += 1;

    // Action (1 byte)
    buf.writeUInt8(action, offset);
    offset += 1;

    // Pointer ID (8 bytes, big-endian signed 64-bit)
    buf.writeBigInt64BE(BigInt(pointerId), offset);
    offset += 8;

    // Position X (4 bytes, big-endian signed 32-bit)
    buf.writeInt32BE(Math.floor(x), offset);
    offset += 4;

    // Position Y (4 bytes, big-endian signed 32-bit)
    buf.writeInt32BE(Math.floor(y), offset);
    offset += 4;

    // Screen width (2 bytes, big-endian unsigned 16-bit)
    buf.writeUInt16BE(screenWidth, offset);
    offset += 2;

    // Screen height (2 bytes, big-endian unsigned 16-bit)
    buf.writeUInt16BE(screenHeight, offset);
    offset += 2;

    // Pressure (2 bytes, fixed-point 0-0xFFFF)
    buf.writeUInt16BE(Math.floor(pressure * 0xffff), offset);
    offset += 2;

    // Action button (4 bytes) - the button that triggered this action
    const actionButton = action === AMOTION_EVENT_ACTION_DOWN ? AMOTION_EVENT_BUTTON_PRIMARY : 0;
    buf.writeInt32BE(actionButton, offset);
    offset += 4;

    // Buttons (4 bytes) - currently pressed buttons
    const buttons =
      action === AMOTION_EVENT_ACTION_UP ? 0 : AMOTION_EVENT_BUTTON_PRIMARY;
    buf.writeInt32BE(buttons, offset);

    return buf;
  }

  sendInput(msg: InputMessage): void {
    if (!this.socket || !this.connected) {
      console.warn("Input socket not connected");
      return;
    }

    let action: number;
    let pointerId = 0;
    let x: number;
    let y: number;
    let pressure = 1.0;

    if (msg.type === "drag") {
      pointerId = msg.pointerId;
      x = msg.x;
      y = msg.y;

      switch (msg.action) {
        case "start":
          action = AMOTION_EVENT_ACTION_DOWN;
          break;
        case "move":
          action = AMOTION_EVENT_ACTION_MOVE;
          break;
        case "end":
        case "cancel":
          action = AMOTION_EVENT_ACTION_UP;
          pressure = 0;
          break;
        default:
          return;
      }
    } else if (msg.type === "click") {
      x = msg.x;
      y = msg.y;
      action = msg.action === "down" ? AMOTION_EVENT_ACTION_DOWN : AMOTION_EVENT_ACTION_UP;
      pressure = msg.action === "down" ? 1.0 : 0;
    } else {
      return;
    }

    const buf = this.buildTouchMessage(action, pointerId, x, y, pressure);
    this.socket.write(buf);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
      this.connected = false;
    }
  }
}

export const inputHandler = InputHandler.getInstance();
