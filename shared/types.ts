// Shared types for Android Cloud Gaming
// Used by: signal server, pod server, frontend

// ============================================
// Message Type Constants
// ============================================

export const GAMES_LIST = [
  "com.supercell.clashroyale",
]

export const MSG = {
  // Signal messages
  START: "start", // starts client and worker connection process (they start talking webrtc shit) info has been exchanged through singaling, and we now tell signal server hey we want to talk to each other now
  OFFER: "offer",
  ANSWER: "answer",
  ICE_CANDIDATE: "ice-candidate",
  ERROR: "error",
  CLIENT_DISCONNECTED: "client-disconnected",
  REGISTER: "register",
  PING: "ping",
  PONG: "pong",
  SHUTDOWN: "shutdown",
  WORKER_DISCONNECTED: "worker-disconnected",
  WORKER_CRASHED: "worker-crashed",
  CONNECTED: "connected",
  AUTHENTICATED: "authenticated",
  // Input messages
  DRAG: "drag",
  CLICK: "click",
  CLIENT_GAME_SELECTED: "client-game-selected",
} as const;

// ============================================
// WebSocket Signal Messages
// ============================================

/** Client requests to start a streaming session */
export interface StartMessage {
  type: typeof MSG.START;
}

/** Pod sends SDP offer to client */
export interface OfferMessage {
  type: typeof MSG.OFFER;
  sdp: string;
}

/** Client sends SDP answer to pod */
export interface AnswerMessage {
  type: typeof MSG.ANSWER;
  sdp: string;
}

/** ICE candidate exchange (bidirectional) */
export interface IceCandidateMessage {
  type: typeof MSG.ICE_CANDIDATE;
  candidate: RTCIceCandidateInit | null;
}

/** Error code constants */
export const ERROR_CODE = {
  NO_SUBSCRIPTION: "NO_SUBSCRIPTION",
  NO_WORKERS_AVAILABLE: "NO_WORKERS_AVAILABLE",
  AUTH_FAILED: "AUTH_FAILED",
  CONNECTION_TIMEOUT: "CONNECTION_TIMEOUT",
  WORKER_CRASHED: "WORKER_CRASHED",
  WEBRTC_FAILED: "WEBRTC_FAILED",
} as const;

/** Error codes for error messages */
export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

/** Error message from signal server */
export interface ErrorMessage {
  type: typeof MSG.ERROR;
  code?: ErrorCode;
  message: string;
}

/** Signal server notifies pod that client disconnected */
export interface ClientDisconnectedMessage {
  type: typeof MSG.CLIENT_DISCONNECTED;
}

/** Worker registers with signal server */
export interface RegisterMessage {
  type: typeof MSG.REGISTER;
  games: string[];
}

/** Ping message from signal server */
export interface PingMessage {
  type: typeof MSG.PING;
}

/** Pong response to signal server */
export interface PongMessage {
  type: typeof MSG.PONG;
}

/** Signal server tells worker/client to shutdown */
export interface ShutdownMessage {
  type: typeof MSG.SHUTDOWN;
  reason: string;
}

/** Signal server notifies client that worker disconnected */
export interface WorkerDisconnectedMessage {
  type: typeof MSG.WORKER_DISCONNECTED;
}

/** Worker notifies signal server that it crashed */
export interface WorkerCrashedMessage {
  type: typeof MSG.WORKER_CRASHED;
  reason: string;
}

/** Client notifies signal server that WebRTC is connected */
export interface ConnectedMessage {
  type: typeof MSG.CONNECTED;
}

/** Signal server confirms client authentication */
export interface AuthenticatedMessage {
  type: typeof MSG.AUTHENTICATED;
}



/** Client notifies signal server that it has selected a game */
export interface ClientGameSelectedMessage {
  type: typeof MSG.CLIENT_GAME_SELECTED;
  gameId: string;
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
  | WorkerDisconnectedMessage
  | WorkerCrashedMessage
  | ConnectedMessage
  | AuthenticatedMessage
  | ClientGameSelectedMessage;

/** Signal message types for type guards */
export type SignalMessageType = SignalMessage["type"];

// ============================================
// Input Messages (WebRTC Data Channel)
// ============================================

/** Drag/touch input event */
export interface DragInputMessage {
  type: typeof MSG.DRAG;
  action: "start" | "move" | "end" | "cancel";
  pointerId: number;
  xPercent: number;
  yPercent: number;
}

/** Click/mouse button event */
export interface ClickInputMessage {
  type: typeof MSG.CLICK;
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
    type === MSG.START ||
    type === MSG.OFFER ||
    type === MSG.ANSWER ||
    type === MSG.ICE_CANDIDATE ||
    type === MSG.ERROR ||
    type === MSG.CLIENT_DISCONNECTED ||
    type === MSG.REGISTER ||
    type === MSG.PING ||
    type === MSG.PONG ||
    type === MSG.SHUTDOWN ||
    type === MSG.WORKER_DISCONNECTED ||
    type === MSG.WORKER_CRASHED ||
    type === MSG.CONNECTED ||
    type === MSG.AUTHENTICATED ||
    type === MSG.CLIENT_GAME_SELECTED
  );
}

export function isInputMessage(msg: unknown): msg is InputMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const type = (msg as { type?: unknown }).type;
  return type === MSG.DRAG || type === MSG.CLICK;
}
