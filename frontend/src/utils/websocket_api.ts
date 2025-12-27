import { config } from "../config";
import { getAccessToken } from "./supabase";
import {
  MSG,
  type SignalMessage,
  type ErrorCode,
  type OfferMessage,
  type IceCandidateMessage,
  type ErrorMessage,
} from "../../../shared/types";

type Unsubscribe = () => void;

class WebSocketAPI {
  private ws: WebSocket | null = null;

  private onOfferCallbacks: ((sdp: string) => void)[] = [];
  private onIceCandidateCallbacks: ((candidate: RTCIceCandidateInit) => void)[] = [];
  private onErrorCallbacks: ((code: ErrorCode | undefined, message: string) => void)[] = [];
  private onDisconnectCallbacks: (() => void)[] = [];
  private onWorkerDisconnectedCallbacks: (() => void)[] = [];

  async connect(): Promise<void> {
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      const url = `${config.SIGNAL_URL}?role=client&token=${encodeURIComponent(token)}`;
      console.log("Connecting to signal server");

      this.ws = new WebSocket(url);

      await this.waitForOpen();

      console.log("Connected to signal server");

      this.ws.onclose = () => {
        console.log("Disconnected from signal server");
        this.notifyDisconnect();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };
    } catch (error) {
      console.error("WebSocket connection error:", error);
      this.notifyError(undefined, "Failed to connect to signal server");
      throw error;
    }
  }

  private async waitForOpen(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error("WebSocket not initialized"));
        return;
      }

      this.ws.onopen = () => resolve();
      this.ws.onerror = () => {
        this.notifyError(undefined, "Connection error");
        reject(new Error("Failed to connect to signal server"));
      };
    });
  }

  private handleMessage(event: MessageEvent): void {
    const msg = JSON.parse(event.data) as SignalMessage;

    if (msg.type !== MSG.PING) {
      console.log("Signal message:", msg.type);
    }

    switch (msg.type) {
      case MSG.PING:
        this.send({ type: MSG.PONG });
        break;

      case MSG.OFFER:
        this.onOfferCallbacks.forEach((cb) => cb((msg as OfferMessage).sdp));
        break;

      case MSG.ICE_CANDIDATE: {
        const candidate = (msg as IceCandidateMessage).candidate;
        if (candidate) {
          this.onIceCandidateCallbacks.forEach((cb) => cb(candidate));
        }
        break;
      }

      case MSG.ERROR: {
        const errorMsg = msg as ErrorMessage;
        console.error("Signal error:", errorMsg.message);
        this.notifyError(errorMsg.code, errorMsg.message);
        break;
      }

      case MSG.WORKER_DISCONNECTED:
        console.log("Worker disconnected");
        this.onWorkerDisconnectedCallbacks.forEach((cb) => cb());
        break;

      case MSG.SHUTDOWN:
        console.log("Server shutdown:", msg.reason);
        this.notifyError(undefined, "Server shutdown: " + msg.reason);
        break;
    }
  }

  private send(msg: SignalMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private notifyError(code: ErrorCode | undefined, message: string): void {
    this.onErrorCallbacks.forEach((cb) => cb(code, message));
  }

  private notifyDisconnect(): void {
    this.onDisconnectCallbacks.forEach((cb) => cb());
  }

  // Public API: Register callbacks
  onOffer(callback: (sdp: string) => void): Unsubscribe {
    this.onOfferCallbacks.push(callback);
    return () => {
      this.onOfferCallbacks = this.onOfferCallbacks.filter((cb) => cb !== callback);
    };
  }

  onIceCandidate(callback: (candidate: RTCIceCandidateInit) => void): Unsubscribe {
    this.onIceCandidateCallbacks.push(callback);
    return () => {
      this.onIceCandidateCallbacks = this.onIceCandidateCallbacks.filter((cb) => cb !== callback);
    };
  }

  onError(callback: (code: ErrorCode | undefined, message: string) => void): Unsubscribe {
    this.onErrorCallbacks.push(callback);
    return () => {
      this.onErrorCallbacks = this.onErrorCallbacks.filter((cb) => cb !== callback);
    };
  }

  onDisconnect(callback: () => void): Unsubscribe {
    this.onDisconnectCallbacks.push(callback);
    return () => {
      this.onDisconnectCallbacks = this.onDisconnectCallbacks.filter((cb) => cb !== callback);
    };
  }

  onWorkerDisconnected(callback: () => void): Unsubscribe {
    this.onWorkerDisconnectedCallbacks.push(callback);
    return () => {
      this.onWorkerDisconnectedCallbacks = this.onWorkerDisconnectedCallbacks.filter((cb) => cb !== callback);
    };
  }

  // Public API: Send messages
  sendChosenGame(gameId: string): void {
    this.send({ type: MSG.CLIENT_GAME_SELECTED, gameId });
  }

  sendStart(): void {
    this.send({ type: MSG.START });
  }

  sendAnswer(sdp: string): void {
    this.send({ type: MSG.ANSWER, sdp });
  }

  sendIceCandidate(candidate: RTCIceCandidateInit): void {
    this.send({ type: MSG.ICE_CANDIDATE, candidate });
  }

  sendConnected(): void {
    this.send({ type: MSG.CONNECTED });
  }

  // Public API: Connection management
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.onOfferCallbacks = [];
    this.onIceCandidateCallbacks = [];
    this.onErrorCallbacks = [];
    this.onDisconnectCallbacks = [];
    this.onWorkerDisconnectedCallbacks = [];
  }
}

export const websocketAPI = new WebSocketAPI();
