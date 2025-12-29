import type { WebSocket } from "ws";
import type Worker from "./Worker.js";
import {
  registerClient,
  unregisterClient,
  setClientWs,
  removeClientWs,
  generateClientId,
} from "./registry.js";
import {
  addToQueue,
  removeFromQueue,
  getQueuePosition,
} from "./queue.js";
import {
  ERROR_CODE,
  MSG,
  type SignalMessage,
  type QueueMessage,
  type ErrorMessage,
  type ErrorCode,
} from "../shared/types.js";
import {
  INPUT_TIMEOUT_THRESHOLD,
  CONNECTING_TIMEOUT_THRESHOLD,
} from "./consts.js";

export type ClientConnectionState = "waiting" | "queued" | "connecting" | "connected";

export default class Client {
  // Identity
  readonly id: string;
  readonly userId: string;
  readonly ws: WebSocket;

  // Pairing - direct reference
  worker: Worker | null = null;

  // State
  connectionState: ClientConnectionState = "waiting";
  game: string | null = null;

  // Timestamps
  lastPing: number;
  lastInput: number;
  queuedAt: number | null = null;
  assignedAt: number | null = null;

  // Cleanup flag
  private isDisconnected = false;

  constructor(ws: WebSocket, userId: string) {
    this.id = generateClientId();
    this.userId = userId;
    this.ws = ws;
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

      case MSG.START:
        this.handleStart();
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

  private handleQueue(msg: QueueMessage): void {
    const { appId } = msg;

    if (!appId) {
      this.sendError(ERROR_CODE.INVALID_REQUEST, "No game specified in queue request");
      return;
    }

    // If already has worker, clean up first
    if (this.worker) { // this should never happen
      this.worker.handleClientRequeued();
      this.worker = null;
    }

    // If already queued, just update game
    if (this.connectionState === "queued") { // this should never happen
      this.game = appId;
      this.sendQueueInfo();
      return;
    }

    // Set state and add to queue
    this.game = appId;
    this.connectionState = "queued";
    this.queuedAt = Date.now();

    addToQueue(this.id);
    this.sendQueueInfo();

    console.log(`Client ${this.id} queued for game: ${appId}`);
  }

  private handleStart(): void {
    // Prevent double START
    if (this.connectionState === "connected") {
      console.log(`Client ${this.id} already started, ignoring duplicate START`);
      return;
    }

    if (!this.worker) {
      this.sendError(ERROR_CODE.NO_WORKERS_AVAILABLE, "No worker assigned. Please rejoin the queue.");
      this.disconnect("no_worker");
      return;
    }

    if (!this.game) {
      this.sendError(ERROR_CODE.INVALID_REQUEST, "No game selected. Please rejoin the queue.");
      this.disconnect("no_game");
      return;
    }

    // Mark as connected and tell worker to start
    this.connectionState = "connected";
    this.worker.sendStart();
    this.worker.sendClientGame(this.game);

    console.log(`Client ${this.id} started connection with worker ${this.worker.id}`);
  }

  private forwardAnswerToWorker(sdp: string): void {
    if (this.worker) {
      this.worker.sendAnswer(sdp);
    }
  }

  private forwardIceCandidateToWorker(candidate: RTCIceCandidateInit | null): void {
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
    const position = getQueuePosition(this.id);
    this.send({ type: MSG.QUEUE_INFO, position });
    console.log(`Sending QUEUE_INFO to client ${this.id}: position ${position}`);
  }

  sendQueueReady(): void {
    this.send({ type: MSG.QUEUE_READY });
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

  // ============================================
  // Disconnect
  // ============================================

  disconnect(reason: string): void {
    // Prevent double disconnect
    if (this.isDisconnected) return;
    this.isDisconnected = true;

    console.log(`Client ${this.id} disconnecting: ${reason}`);

    // Remove from queue if queued
    if (this.connectionState === "queued") {
      removeFromQueue(this.id);
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

  // Called when worker notifies us of disconnect (avoid circular disconnect)
  handleWorkerDisconnected(): void {
    if (this.isDisconnected) return;

    this.worker = null;
    this.disconnect("worker_disconnected");
  }
}
