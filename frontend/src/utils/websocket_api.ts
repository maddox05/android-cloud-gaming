import { config } from "../config";
import { getAccessToken } from "./supabase";
import {
  MSG,
  type SignalMessage,
  type ErrorCode,
  type OfferMessage,
  type IceCandidateMessage,
  type ErrorMessage,
  type QueueInfoMessage,
  type QueueReadyMessage,
  type TurnInfo,
} from "../../../shared/types";

export interface QueueInfo {
  position: number;
}

type Unsubscribe = () => void;

class WebSocketAPI {
  private ws: WebSocket | null = null;

  private onOfferCallbacks: ((sdp: string) => void)[] = [];
  private onIceCandidateCallbacks: ((
    candidate: RTCIceCandidateInit
  ) => void)[] = [];
  private onErrorCallbacks: ((
    code: ErrorCode | undefined,
    message: string
  ) => void)[] = [];
  private onQueueInfoCallbacks: ((info: QueueInfo) => void)[] = [];
  private onQueueReadyCallbacks: ((turnInfo?: TurnInfo) => void)[] = [];
  private onShutdownCallbacks: ((reason: string) => void)[] = [];

  async connect(): Promise<void> {
    // Already connected or connecting
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      console.log("Already connected/connecting, skipping");
      return;
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      const url = `${config.SIGNAL_URL}?role=client&token=${encodeURIComponent(
        token
      )}`;
      console.log("Connecting to signal server");

      this.ws = new WebSocket(url);

      await this.waitForOpen();

      // Wait for AUTHENTICATED or ERROR message
      await new Promise<void>((resolve, reject) => {
        this.ws!.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === MSG.AUTHENTICATED) {
            resolve();
          } else if (msg.type === MSG.ERROR) {
            this.handleMessage(event); // Let the normal handler process the error
            reject(new Error("Authentication failed"));
          }
        };
        this.ws!.onclose = () =>
          reject(new Error("Connection closed during authentication"));
      });

      // Now set up the real handlers
      this.ws.onmessage = (event) => this.handleMessage(event);
      this.ws.onclose = () => {
        this.notifyShutdown("signal_server_connection_closed");
        this.close();
      };

      console.log("Connected and authenticated to signal server");
    } catch (error) {
      console.error("WebSocket connection error:", error);
      this.notifyError(undefined, "Failed to connect to signal server");
      throw error;
    }
  }

  private waitForOpen(): Promise<void> {
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
      console.log("Signal message received:", msg.type, msg);
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

      case MSG.SHUTDOWN:
        console.log("Client received shutdown:", msg.reason);
        this.notifyShutdown(msg.reason);
        break;

      case MSG.QUEUE_INFO: {
        console.log("WebSocketAPI received QUEUE_INFO:", msg);
        const queueMsg = msg as QueueInfoMessage;
        const info: QueueInfo = {
          position: queueMsg.position,
        };
        console.log(
          "Calling",
          this.onQueueInfoCallbacks.length,
          "queue info callbacks"
        );
        this.onQueueInfoCallbacks.forEach((cb) => cb(info));
        break;
      }

      case MSG.QUEUE_READY: {
        const queueReadyMsg = msg as QueueReadyMessage;
        console.log("Queue ready - worker assigned", queueReadyMsg.turnInfo ? "(with TURN)" : "(no TURN)");
        this.onQueueReadyCallbacks.forEach((cb) => cb(queueReadyMsg.turnInfo));
        break;
      }

      default:
        console.warn("Unknown signal message type:", msg.type);
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

  private notifyShutdown(reason: string): void {
    this.onShutdownCallbacks.forEach((cb) => cb(reason));
  }

  // Public API: Register callbacks
  onOffer(callback: (sdp: string) => void): Unsubscribe {
    this.onOfferCallbacks.push(callback);
    return () => {
      this.onOfferCallbacks = this.onOfferCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }

  onIceCandidate(
    callback: (candidate: RTCIceCandidateInit) => void
  ): Unsubscribe {
    this.onIceCandidateCallbacks.push(callback);
    return () => {
      this.onIceCandidateCallbacks = this.onIceCandidateCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }

  onError(
    callback: (code: ErrorCode | undefined, message: string) => void
  ): Unsubscribe {
    this.onErrorCallbacks.push(callback);
    return () => {
      this.onErrorCallbacks = this.onErrorCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }

  onQueueInfo(callback: (info: QueueInfo) => void): Unsubscribe {
    this.onQueueInfoCallbacks.push(callback);
    return () => {
      this.onQueueInfoCallbacks = this.onQueueInfoCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }

  onQueueReady(callback: (turnInfo?: TurnInfo) => void): Unsubscribe {
    this.onQueueReadyCallbacks.push(callback);
    return () => {
      this.onQueueReadyCallbacks = this.onQueueReadyCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }

  onShutdown(callback: (reason: string) => void): Unsubscribe {
    this.onShutdownCallbacks.push(callback);
    return () => {
      this.onShutdownCallbacks = this.onShutdownCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }

  // Public API: Send messages
  sendQueue(appId: string): void {
    this.send({ type: MSG.QUEUE, appId });
  }

  sendClientStarted(): void {
    this.send({ type: MSG.CLIENT_STARTED });
  }

  sendAnswer(sdp: string): void {
    this.send({ type: MSG.ANSWER, sdp });
  }

  sendIceCandidate(candidate: RTCIceCandidateInit): void {
    this.send({ type: MSG.ICE_CANDIDATE, candidate });
  }

  sendInputEvent(): void {
    this.send({ type: MSG.CLIENT_INPUTED });
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
    this.onQueueInfoCallbacks = [];
    this.onQueueReadyCallbacks = [];
    this.onShutdownCallbacks = [];
  }
}

export const websocketAPI = new WebSocketAPI();
