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

/** Union of all signal messages */
export type SignalMessage =
  | StartMessage
  | OfferMessage
  | AnswerMessage
  | IceCandidateMessage
  | ErrorMessage
  | ClientDisconnectedMessage;

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
  x: number;
  y: number;
}

/** Click/mouse button event */
export interface ClickInputMessage {
  type: "click";
  action: "down" | "up";
  button: 0 | 1 | 2; // left, middle, right
  x: number;
  y: number;
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
    type === "client-disconnected"
  );
}

export function isInputMessage(msg: unknown): msg is InputMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const type = (msg as { type?: unknown }).type;
  return type === "drag" || type === "click";
}
