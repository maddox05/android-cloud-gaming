// Shared types for Android Cloud Gaming
// Used by: signal server, pod server, frontend

// ============================================
// WebSocket Signal Messages
// ============================================

/** Client requests to start a streaming session */
export interface StartMessage {
  type: "start";
}

/** Pod sends SDP offer to client */
export interface OfferMessage {
  type: "offer";
  sdp: string;
}

/** Client sends SDP answer to pod */
export interface AnswerMessage {
  type: "answer";
  sdp: string;
}

/** ICE candidate exchange (bidirectional) */
export interface IceCandidateMessage {
  type: "ice-candidate";
  candidate: RTCIceCandidateInit | null;
}

/** Error message from signal server */
export interface ErrorMessage {
  type: "error";
  message: string;
}

/** Signal server notifies pod that client disconnected */
export interface ClientDisconnectedMessage {
  type: "client-disconnected";
}

/** Worker registers with signal server */
export interface RegisterMessage {
  type: "register";
  game: string;
}

/** Ping message from signal server */
export interface PingMessage {
  type: "ping";
}

/** Pong response to signal server */
export interface PongMessage {
  type: "pong";
}

/** Signal server tells worker/client to shutdown */
export interface ShutdownMessage {
  type: "shutdown";
  reason: string;
}

/** Signal server notifies client that worker disconnected */
export interface WorkerDisconnectedMessage {
  type: "worker-disconnected";
}

/** Union of all signal messages */
export type SignalMessage =
  | StartMessage
  | OfferMessage
  | AnswerMessage
  | IceCandidateMessage
  | ErrorMessage
  | ClientDisconnectedMessage
  | RegisterMessage
  | PingMessage
  | PongMessage
  | ShutdownMessage
  | WorkerDisconnectedMessage;

/** Signal message types for type guards */
export type SignalMessageType = SignalMessage["type"];

// ============================================
// Input Messages (WebRTC Data Channel)
// ============================================

/** Drag/touch input event */
export interface DragInputMessage {
  type: "drag";
  action: "start" | "move" | "end" | "cancel";
  pointerId: number;
  xPercent: number;
  yPercent: number;
}

/** Click/mouse button event */
export interface ClickInputMessage {
  type: "click";
  action: "down" | "up";
  button: 0 | 1 | 2; // left, middle, right
  xPercent: number;
  yPercent: number;
}

/** Union of all input messages */
export type InputMessage = DragInputMessage | ClickInputMessage;

/** Input message types for type guards */
export type InputMessageType = InputMessage["type"];

// ============================================
// WebSocket Connection Roles
// ============================================

export type ConnectionRole = "pod" | "client";

// ============================================
// Type Guards
// ============================================

export function isSignalMessage(msg: unknown): msg is SignalMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const type = (msg as { type?: unknown }).type;
  return (
    type === "start" ||
    type === "offer" ||
    type === "answer" ||
    type === "ice-candidate" ||
    type === "error" ||
    type === "client-disconnected" ||
    type === "register" ||
    type === "ping" ||
    type === "pong" ||
    type === "shutdown" ||
    type === "worker-disconnected"
  );
}

export function isInputMessage(msg: unknown): msg is InputMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const type = (msg as { type?: unknown }).type;
  return type === "drag" || type === "click";
}
