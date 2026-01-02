// Shared types for Android Cloud Gaming
// Used by: signal server, pod server, frontend

// ============================================
// Message Type Constants
// ============================================
export interface Game {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
}
export const MSG = {
  // Signal messages
  CLIENT_STARTED: "client-started", // client -> signal: client is ready to connect after QUEUE_READY
  WORKER_START: "worker-start", // signal -> worker: start WebRTC + session with gameId
  OFFER: "offer",
  ANSWER: "answer",
  ICE_CANDIDATE: "ice-candidate",
  ERROR: "error",
  REGISTER: "register", // worker registers to singal server
  PING: "ping",
  PONG: "pong",
  SHUTDOWN: "shutdown",
  AUTHENTICATED: "authenticated",
  // Queue messages
  QUEUE: "queue", // client -> server: join queue for a game
  QUEUE_INFO: "queue-info", // server -> client: queue position updates
  QUEUE_READY: "queue-ready", // server -> client: worker assigned, proceed to game
  // Input messages
  DRAG: "drag",
  CLICK: "click",
  RESET_VIDEO: "reset-video",
  CLIENT_INPUTED: "client-inputed", // Client sends to signal for heartbeat
} as const;

/** TURN server credentials for WebRTC connection */
export type TurnInfo = RTCIceServer[];

// ============================================
// WebSocket Signal Messages
// ============================================

/** Client notifies signal server it's ready to connect after QUEUE_READY */
export interface ClientStartedMessage {
  type: typeof MSG.CLIENT_STARTED;
}

/** Signal server tells worker to start WebRTC and session with specific game */
export interface WorkerStartMessage {
  type: typeof MSG.WORKER_START;
  gameId: string;
  turnInfo?: TurnInfo;
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
  WEBRTC_FAILED: "WEBRTC_FAILED",
  INVALID_REQUEST: "INVALID_REQUEST",
  QUEUE_TIMEOUT: "QUEUE_TIMEOUT",
  SESSION_TIMEOUT: "SESSION_TIMEOUT",
} as const;

/** Error codes for error messages */
export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

/** Error message from signal server */
export interface ErrorMessage {
  type: typeof MSG.ERROR;
  code?: ErrorCode;
  message: string;
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

/** Signal server confirms client authentication */
export interface AuthenticatedMessage {
  type: typeof MSG.AUTHENTICATED;
}

/** Client requests to join queue for a game */
export interface QueueMessage {
  type: typeof MSG.QUEUE;
  appId: string;
}

/** Server sends queue position updates to client */
export interface QueueInfoMessage {
  type: typeof MSG.QUEUE_INFO;
  position: number;
}

/** Server notifies client that worker is assigned and ready */
export interface QueueReadyMessage {
  type: typeof MSG.QUEUE_READY;
  turnInfo?: TurnInfo;
}

/** Client notifies signal server that it has clicked smth on the screen */
export interface ClientInputed {
  // client will send data but server doesnt care.
  type: typeof MSG.CLIENT_INPUTED;
}

/** Union of all signal messages */
export type SignalMessage =
  | ClientStartedMessage
  | WorkerStartMessage
  | OfferMessage
  | AnswerMessage
  | IceCandidateMessage
  | ErrorMessage
  | RegisterMessage
  | PingMessage
  | PongMessage
  | ShutdownMessage
  | AuthenticatedMessage
  | QueueMessage
  | QueueInfoMessage
  | QueueReadyMessage
  | ClientInputed;

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

/** Reset video request - triggers scrcpy to resend SPS/PPS/IDR */
export interface ResetVideoInputMessage {
  type: typeof MSG.RESET_VIDEO;
}

/** Union of all input messages */
export type InputMessage =
  | DragInputMessage
  | ClickInputMessage
  | ResetVideoInputMessage;

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
    type === MSG.CLIENT_STARTED ||
    type === MSG.WORKER_START ||
    type === MSG.OFFER ||
    type === MSG.ANSWER ||
    type === MSG.ICE_CANDIDATE ||
    type === MSG.ERROR ||
    type === MSG.REGISTER ||
    type === MSG.PING ||
    type === MSG.PONG ||
    type === MSG.SHUTDOWN ||
    type === MSG.AUTHENTICATED ||
    type === MSG.QUEUE ||
    type === MSG.QUEUE_INFO ||
    type === MSG.QUEUE_READY ||
    type === MSG.CLIENT_INPUTED
  );
}

export function isInputMessage(msg: unknown): msg is InputMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const type = (msg as { type?: unknown }).type;
  return type === MSG.DRAG || type === MSG.CLICK || type === MSG.RESET_VIDEO;
}
