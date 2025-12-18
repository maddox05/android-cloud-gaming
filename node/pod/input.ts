import net from "net";
import { scrcpy_config, redroid_config } from "./config.js";
import { InputMessage } from "./types.js";

// scrcpy control message types
const CONTROL_MSG_TYPE_INJECT_TOUCH = 2;

// Android MotionEvent actions
const AMOTION_EVENT_ACTION_DOWN = 0;
const AMOTION_EVENT_ACTION_UP = 1;
const AMOTION_EVENT_ACTION_MOVE = 2;

// Android MotionEvent buttons
const AMOTION_EVENT_BUTTON_PRIMARY = 1;

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

  async connect(): Promise<void> {
    if (this.connected) return;

    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(scrcpy_config.input_port, "127.0.0.1", () => {
        console.log("Input socket connected");
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
    });
  }

  // Build scrcpy touch injection message
  // Format: type(1) + action(1) + pointerId(8) + position(point) + pressure(2) + actionButton(4) + buttons(4)
  // position: x(4) + y(4) + screenWidth(2) + screenHeight(2)
  private buildTouchMessage(action: number, pointerId: number, x: number, y: number, pressure: number): Buffer {
    const buf = Buffer.alloc(32);
    let offset = 0;

    // Message type
    buf.writeUInt8(CONTROL_MSG_TYPE_INJECT_TOUCH, offset);
    offset += 1;

    // Action
    buf.writeUInt8(action, offset);
    offset += 1;

    // Pointer ID (64-bit)
    buf.writeBigInt64BE(BigInt(pointerId), offset);
    offset += 8;

    // Position X (as float ratio 0-1, stored as fixed point)
    const screenWidth = redroid_config.redroid_width;
    const screenHeight = redroid_config.redroid_height;

    buf.writeInt32BE(Math.floor(x), offset);
    offset += 4;

    // Position Y
    buf.writeInt32BE(Math.floor(y), offset);
    offset += 4;

    // Screen width
    buf.writeUInt16BE(screenWidth, offset);
    offset += 2;

    // Screen height
    buf.writeUInt16BE(screenHeight, offset);
    offset += 2;

    // Pressure (0-65535)
    buf.writeUInt16BE(Math.floor(pressure * 65535), offset);
    offset += 2;

    // Action button
    buf.writeUInt32BE(action === AMOTION_EVENT_ACTION_DOWN ? AMOTION_EVENT_BUTTON_PRIMARY : 0, offset);
    offset += 4;

    // Buttons
    buf.writeUInt32BE(action === AMOTION_EVENT_ACTION_UP ? 0 : AMOTION_EVENT_BUTTON_PRIMARY, offset);

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
