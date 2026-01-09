import type { WebSocket } from "ws";
import type Worker from "./Worker.js";
import {
  registerClient,
  unregisterClient,
  setClientWs,
  removeClientWs,
  generateClientId,
  amIAlreadyInGame,
} from "./registry.js";
import {
  addToQueue,
  removeFromQueue,
  getQueuePosition,
  getQueueLength,
  amIQueued,
} from "./queue.js";
import type { AccessType } from "./types.js";
import {
  ERROR_CODE,
  MSG,
  FREE_USER_MAX_VIDEO_SIZE,
  type SignalMessage,
  type QueueMessage,
  type ErrorMessage,
  type ErrorCode,
  type TurnInfo,
} from "../shared/types.js";
import {
  INPUT_TIMEOUT_THRESHOLD,
  CONNECTING_TIMEOUT_THRESHOLD,
} from "./consts.js";
import { logSession } from "./db/database.js";
import { MAX_SESSION_TIME_MS, FREE_USER_MAX_TIME_MS } from "../shared/const.js";

export type ClientConnectionState =
  | "waiting"
  | "queued"
  | "connecting"
  | "connected";

export default class Client {
  // Identity
  readonly id: string;
  readonly userId: string;
  readonly ws: WebSocket;
  readonly accessType: AccessType; //user free or paid

  // Pairing - direct reference
  worker: Worker | null = null;

  // State
  connectionState: ClientConnectionState = "waiting";
  game: string | null = null;
  turnInfo: TurnInfo | null = null;
  maxVideoSize: number = FREE_USER_MAX_VIDEO_SIZE; // Default ULD

  // Timestamps
  lastPing: number;
  lastInput: number;
  queuedAt: number | null = null;
  assignedAt: number | null = null;

  // Time tracking for free users (milliseconds)
  timeUsedTodayMs: number = 0;

  // Cleanup flag
  private isDisconnected = false;

  constructor(ws: WebSocket, userId: string, accessType: AccessType) {
    this.id = generateClientId();
    this.userId = userId;
    this.ws = ws;
    this.accessType = accessType;
    this.lastPing = Date.now();
    this.lastInput = Date.now();

    // Register in registry
    registerClient(this);
    setClientWs(ws, this);

    // Setup event handlers
    this.setupEventHandlers();

    console.log(`Client ${this.id} (user: ${userId}) connected`);
  }

  private setupEventHandlers(): void {
    this.ws.on("message", (data) => {
      try {
        const msg: SignalMessage = JSON.parse(data.toString());
        this.handleMessage(msg);
      } catch (err) {
        console.error(`Client ${this.id} invalid message:`, err);
      }
    });

    this.ws.on("close", () => {
      this.disconnect("connection_closed");
    });

    this.ws.on("error", (err) => {
      console.error(`Client ${this.id} error:`, err.message);
    });
  }

  // ============================================
  // Message Handling
  // ============================================

  private handleMessage(msg: SignalMessage): void {
    // Any message resets ping timer
    this.lastPing = Date.now();

    switch (msg.type) {
      case MSG.CLIENT_INPUTED:
        this.lastInput = Date.now();
        break;

      case MSG.QUEUE:
        this.handleQueue(msg as QueueMessage);
        break;

      case MSG.CLIENT_STARTED:
        this.handleClientStarted();
        break;

      case MSG.PONG:
        // Already updated ping above
        break;

      case MSG.ANSWER:
        this.forwardAnswerToWorker(msg.sdp);
        break;

      case MSG.ICE_CANDIDATE:
        this.forwardIceCandidateToWorker(msg.candidate);
        break;

      default:
        // Discard unknown messages (but they still reset timeout)
        break;
    }
  }
  // checks if the user ia allowed to queue with the given options, and any bad state the user may have had
  private handleQueue(msg: QueueMessage): void {
    const { appId, maxVideoSize } = msg;

    if (!appId) {
      this.sendError(
        ERROR_CODE.INVALID_REQUEST,
        "No game specified in queue request"
      );
      return;
    }

    // If already has worker, clean up first
    if (this.worker) {
      // this should never happen
      this.worker.handleClientRequeued();
      this.worker = null;
    }

    // If already queued, just update game
    if (this.connectionState === "queued") {
      // this should never happen
      this.game = appId;
      this.sendQueueInfo();
      return;
    }

    // Set state and add to queue
    this.game = appId;

    // Free users can only use ULD quality
    // if free user somehow changed thier maxvideo size to smth else, chaneg it it to what they are allowed
    if (this.accessType === "free") {
      this.maxVideoSize = FREE_USER_MAX_VIDEO_SIZE;
    } else {
      this.maxVideoSize = maxVideoSize ?? FREE_USER_MAX_VIDEO_SIZE;
    }

    this.connectionState = "queued";
    this.queuedAt = Date.now();

    // check if userId is already in queue or in game, then user cannot queue again.
    // user always has to queue before being in game, so i dont need to do these checks anywhere else
    if (amIQueued(this)) {
      this.sendError(
        ERROR_CODE.ALREADY_IN_QUEUE,
        "You are already in the queue"
      );
      return;
    }

    if (amIAlreadyInGame(this)) {
      this.sendError(ERROR_CODE.ALREADY_IN_GAME, "You are already in a game");
      return;
    }

    addToQueue(this);

    this.sendQueueInfo();

    console.log(
      `Client ${this.id} queued for game: ${appId} (maxVideoSize: ${this.maxVideoSize})`
    );
  }

  private handleClientStarted(): void {
    // Prevent double CLIENT_STARTED
    if (this.connectionState === "connected") {
      console.log(
        `Client ${this.id} already started, ignoring duplicate CLIENT_STARTED`
      );
      return;
    }

    if (!this.worker) {
      this.sendError(
        ERROR_CODE.NO_WORKERS_AVAILABLE,
        "No worker assigned. Please rejoin the queue."
      );
      this.disconnect("no_worker");
      return;
    }

    if (!this.game) {
      this.sendError(
        ERROR_CODE.INVALID_REQUEST,
        "No game selected. Please rejoin the queue."
      );
      this.disconnect("no_game");
      return;
    }

    // Mark as connected and tell worker to start with game info
    // (worker already has turnInfo from queue assignment)
    this.connectionState = "connected";
    this.worker.sendWorkerStart(this.game, this.maxVideoSize);

    console.log(
      `Client ${this.id} started connection with worker ${this.worker.id}`
    );
  }

  private forwardAnswerToWorker(sdp: string): void {
    if (this.worker) {
      this.worker.sendAnswer(sdp);
    }
  }

  private forwardIceCandidateToWorker(
    candidate: RTCIceCandidateInit | null
  ): void {
    if (this.worker) {
      this.worker.sendIceCandidate(candidate);
    }
  }

  // ============================================
  // Sending Messages
  // ============================================

  send(msg: SignalMessage): void {
    if (this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  sendError(code: ErrorCode, message: string): void {
    const error: ErrorMessage = { type: MSG.ERROR, code, message };
    this.send(error);
  }

  sendPing(): void {
    this.send({ type: MSG.PING });
  }

  sendOffer(sdp: string): void {
    this.send({ type: MSG.OFFER, sdp });
  }

  sendIceCandidate(candidate: RTCIceCandidateInit | null): void {
    this.send({ type: MSG.ICE_CANDIDATE, candidate });
  }

  sendShutdown(reason: string): void {
    this.send({ type: MSG.SHUTDOWN, reason });
  }

  sendQueueInfo(): void {
    const position = getQueuePosition(this);
    const total = getQueueLength();
    this.send({ type: MSG.QUEUE_INFO, position, total });
    console.log(
      `Sending QUEUE_INFO to client ${this.id}: position ${position}/${total}`
    );
  }

  sendQueueReady(): void {
    this.send({
      type: MSG.QUEUE_READY,
      turnInfo: this.turnInfo ?? undefined,
    });
  }

  sendAuthenticated(): void {
    this.send({ type: MSG.AUTHENTICATED });
  }

  // ============================================
  // Pairing
  // ============================================

  assignWorker(worker: Worker): void {
    this.worker = worker;
    this.connectionState = "connecting";
    this.assignedAt = Date.now();

    // Bidirectional link
    worker.client = this;
    worker.status = "busy";

    console.log(`Client ${this.id} assigned to worker ${worker.id}`);
  }

  // ============================================
  // Timeout Checks (called from intervals)
  // ============================================

  checkPingTimeout(now: number, threshold: number): boolean {
    return now - this.lastPing > threshold;
  }

  checkInputTimeout(now: number): boolean {
    if (this.connectionState !== "connected") return false;
    return now - this.lastInput > INPUT_TIMEOUT_THRESHOLD;
  }

  checkConnectingTimeout(now: number): boolean {
    if (this.connectionState !== "connecting" || !this.assignedAt) return false;
    return now - this.assignedAt > CONNECTING_TIMEOUT_THRESHOLD;
  }

  // uses assignedAt, as thats when a worker was taken for this client
  checkIsAtMaxSessionDuration(now: number): boolean {
    if (this.connectionState !== "connected" || !this.assignedAt) return false; // its not possible to not be connected while being at max session duration, as checkConnectingTimeout would have caught it earlier
    return now - this.assignedAt > MAX_SESSION_TIME_MS;
    //    3:30 - 3:00 = 0:30 > 1hr? no (all in ms tho)
  }

  // Check if free user has exceeded daily time limit
  checkIfTimeUsed(now: number): boolean {
    // Paid users have no daily limit
    if (this.accessType === "paid") return false;

    // Only check when connected with an active session
    if (this.connectionState !== "connected" || !this.assignedAt) return false;

    const currentSessionTime = now - this.assignedAt;
    return this.timeUsedTodayMs + currentSessionTime >= FREE_USER_MAX_TIME_MS;
  }

  // ============================================
  // Disconnect
  // ============================================

  disconnect(reason: string): void {
    // Prevent double disconnect
    if (this.isDisconnected) return;
    this.isDisconnected = true;

    console.log(`Client ${this.id} disconnecting: ${reason}`);

    // Log session if client was actually in a game
    if (
      this.connectionState === "connected" &&
      this.game !== null &&
      this.assignedAt !== null
    ) {
      logSession({
        user_id: this.userId,
        package_name: this.game,
        max_video_size: this.maxVideoSize,
        started_at: this.assignedAt,
        ended_at: Date.now(),
        ended_reason: reason,
      }).catch((err) => {
        console.error(`Failed to log session for client ${this.id}:`, err);
      });
    }

    // Remove from queue if queued
    if (this.connectionState === "queued") {
      removeFromQueue(this);
    }

    // Notify and disconnect paired worker (without it calling back to us)
    if (this.worker) {
      const worker = this.worker;
      this.worker = null; // Clear reference first
      worker.client = null; // Clear bidirectional
      worker.sendClientDisconnected();
      worker.disconnect("client_disconnected");
    }

    // Unregister
    unregisterClient(this.id);
    removeClientWs(this.ws);

    // Send shutdown and close
    this.sendShutdown(reason);
    this.ws.close();

    console.log(`Client ${this.id} removed`);
  }
}
