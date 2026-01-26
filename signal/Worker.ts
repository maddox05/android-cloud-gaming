import type { WebSocket } from "ws";
import type Client from "./Client.js";
import {
  registerWorker,
  unregisterWorker,
  setWorkerWs,
  removeWorkerWs,
  generateWorkerId,
} from "./registry.js";
import {
  MSG,
  type SignalMessage,
  type RegisterMessage,
  type ErrorMessage,
  ERROR_CODE,
  type TurnInfo,
} from "../shared/types.js";
import { GAMES_LIST } from "../shared/const.js";

export type WorkerStatus = "available" | "busy";

export default class Worker {
  // Identity
  readonly id: string;
  readonly ws: WebSocket;

  turnInfo: TurnInfo | null = null;

  // Pairing - direct reference
  client: Client | null = null;

  // State
  status: WorkerStatus = "available";
  games: string[] = [];

  // Timestamps
  lastPing: number;

  // Cleanup flag
  private isDisconnected = false;

  // Registration flag (worker must send REGISTER before being available)
  private isRegistered = false;

  constructor(ws: WebSocket) {
    this.id = generateWorkerId();
    this.ws = ws;
    this.lastPing = Date.now();

    // Only add to wsToWorker, not workerRegistry (until registered)
    setWorkerWs(ws, this);

    // Setup event handlers
    this.setupEventHandlers();

    console.log(`Worker ${this.id} connected (awaiting registration)`);
  }

  private setupEventHandlers(): void {
    this.ws.on("message", (data) => {
      try {
        const msg: SignalMessage = JSON.parse(data.toString());
        this.handleMessage(msg);
      } catch (err) {
        console.error(`Worker ${this.id} invalid message:`, err);
      }
    });

    this.ws.on("close", () => {
      this.disconnect("connection_closed");
    });

    this.ws.on("error", (err) => {
      console.error(`Worker ${this.id} error:`, err.message);
    });
  }

  // ============================================
  // Message Handling
  // ============================================

  private handleMessage(msg: SignalMessage): void {
    switch (msg.type) {
      case MSG.REGISTER:
        const msgTyped = msg as RegisterMessage;
        if (
          !msgTyped.games ||
          !Array.isArray(msgTyped.games) ||
          (msgTyped.games.length === 0 &&
            JSON.stringify(msgTyped.games) !==
              JSON.stringify(GAMES_LIST.map((game) => game.slug))) // TODO remove this if worker ever has not ALL games
        ) {
          console.error(`Worker ${this.id} sent invalid games array`);
          this.sendShutdown("invalid_games");
          return;
        }
        this.handleRegister(msg as RegisterMessage);
        break;

      case MSG.PONG:
        this.lastPing = Date.now();
        break;

      case MSG.OFFER:
        this.forwardOfferToClient(msg.sdp);
        break;

      case MSG.ICE_CANDIDATE:
        this.forwardIceCandidateToClient(msg.candidate);
        break;

      case MSG.ERROR:
        this.forwardErrorToClient(msg as ErrorMessage);
        break;

      default:
        console.log(`Worker ${this.id} sent unknown message:`, msg.type);
    }
  }

  private handleRegister(msg: RegisterMessage): void {
    this.games = msg.games;
    this.isRegistered = true;

    // Now add to registry (available for queue matching)
    registerWorker(this);

    console.log(`Worker ${this.id} registered with games: ${msg.games}`);
  }

  private forwardOfferToClient(sdp: string): void {
    if (this.client) {
      this.client.sendOffer(sdp);
    }
  }

  private forwardIceCandidateToClient(
    candidate: RTCIceCandidateInit | null,
  ): void {
    if (this.client) {
      this.client.sendIceCandidate(candidate);
    }
  }

  private forwardErrorToClient(msg: ErrorMessage): void {
    if (this.client) {
      this.client.sendError(msg.code!, msg.message);
      console.log(
        `Forwarded error to client ${this.client.id}: ${msg.code} - ${msg.message}`,
      );
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

  sendPing(): void {
    this.send({ type: MSG.PING });
  }

  sendWorkerStart(gameId: string, maxVideoSize: number): void {
    if (!this.client) {
      console.error(
        `Worker ${this.id}: Cannot send WORKER_START - no client assigned`,
      );
      return;
    }
    this.send({
      type: MSG.WORKER_START,
      gameId,
      turnInfo: this.turnInfo ?? undefined,
      maxVideoSize,
      userId: this.client.userId,
    });
  }

  sendAnswer(sdp: string): void {
    this.send({ type: MSG.ANSWER, sdp });
  }

  sendIceCandidate(candidate: RTCIceCandidateInit | null): void {
    this.send({ type: MSG.ICE_CANDIDATE, candidate });
  }

  sendShutdown(reason: string): void {
    this.send({ type: MSG.SHUTDOWN, reason });
  }

  // ============================================
  // Timeout Checks
  // ============================================

  checkPingTimeout(now: number, threshold: number): boolean {
    return now - this.lastPing > threshold;
  }

  // ============================================
  // Disconnect
  // ============================================

  disconnect(reason: string): void {
    // Prevent double disconnect
    if (this.isDisconnected) return;
    this.isDisconnected = true;

    console.log(`Worker ${this.id} disconnecting: ${reason}`);

    // Notify and disconnect paired client (without it calling back to us)
    if (this.client) {
      const client = this.client;
      this.client = null; // Clear reference first
      client.worker = null; // Clear bidirectional
      client.disconnect("worker_disconnected");
    }

    // Unregister (only if was registered)
    if (this.isRegistered) {
      unregisterWorker(this.id);
    }
    removeWorkerWs(this.ws);

    // Send shutdown and close

    this.sendShutdown(reason);
    this.ws.close();

    console.log(`Worker ${this.id} removed`);
  }

  // Called when client requeues (switches games)
  handleClientRequeued(): void {
    if (this.isDisconnected) return;

    this.client = null;
    this.disconnect("client_requeued");
  }

  // Called when client notifies us of disconnect (avoid circular disconnect)
  handleClientDisconnected(): void {
    if (this.isDisconnected) return;

    this.client = null;
    this.disconnect("client_disconnected");
  }
}
