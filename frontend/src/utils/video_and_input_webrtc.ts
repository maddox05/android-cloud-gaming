import { websocketAPI } from "./websocket_api";
import {
  ERROR_CODE,
  MSG,
  type InputMessage,
  type ErrorCode,
  type TurnInfo,
} from "../../../shared/types";
import { STUN_SERVERS } from "../../../shared/const";

type Unsubscribe = () => void;

class VideoInputWebRTC {
  private static instance: VideoInputWebRTC;

  private pc: RTCPeerConnection | null = null;
  private inputChannel: RTCDataChannel | null = null;
  private videoChannel: RTCDataChannel | null = null;
  private unsubscribers: (() => void)[] = [];
  private turnServers: TurnInfo | null = null;

  // Callback arrays
  private onVideoCallbacks: ((data: ArrayBuffer) => void)[] = [];
  private onErrorCallbacks: ((
    code: ErrorCode | undefined,
    message: string
  ) => void)[] = [];
  private onDisconnectedCallbacks: (() => void)[] = [];

  private constructor() {}

  setTurnServers(turnInfo: TurnInfo | undefined): void {
    this.turnServers = turnInfo ?? null;
    console.log("[WebRTC] TURN servers set:", turnInfo ? turnInfo.length : 0);
  }

  static getInstance(): VideoInputWebRTC {
    if (!VideoInputWebRTC.instance) {
      VideoInputWebRTC.instance = new VideoInputWebRTC();
    }
    return VideoInputWebRTC.instance;
  }

  onVideo(callback: (data: ArrayBuffer) => void): Unsubscribe {
    this.onVideoCallbacks.push(callback);
    return () => {
      this.onVideoCallbacks = this.onVideoCallbacks.filter(
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

  onDisconnected(callback: () => void): Unsubscribe {
    this.onDisconnectedCallbacks.push(callback);
    return () => {
      this.onDisconnectedCallbacks = this.onDisconnectedCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }

  private notifyVideo(data: ArrayBuffer): void {
    this.onVideoCallbacks.forEach((cb) => cb(data));
  }

  private notifyError(code: ErrorCode | undefined, message: string): void {
    this.onErrorCallbacks.forEach((cb) => cb(code, message));
  }

  private notifyDisconnected(): void {
    this.onDisconnectedCallbacks.forEach((cb) => cb());
  }

  async connect(): Promise<void> {
    // Merge STUN servers with any TURN servers we received
    const iceServers: RTCIceServer[] = [
      ...STUN_SERVERS,
      ...(this.turnServers ?? []),
    ];
    console.log("[WebRTC] Using ICE servers:", iceServers.length, "(STUN:", STUN_SERVERS.length, "+ TURN:", this.turnServers?.length ?? 0, ")");

    // Create peer connection
    this.pc = new RTCPeerConnection({ iceServers });

    // Handle incoming offer
    const unsubOffer = websocketAPI.onOffer(async (sdp) => {
      try {
        console.log("Received offer");
        await this.pc!.setRemoteDescription({ type: "offer", sdp });
        const answer = await this.pc!.createAnswer();
        await this.pc!.setLocalDescription(answer);
        websocketAPI.sendAnswer(answer.sdp!);
      } catch (err) {
        console.error("Failed to handle offer:", err);
        this.notifyError(
          ERROR_CODE.WEBRTC_FAILED,
          "Failed to establish connection to worker"
        );
      }
    });
    this.unsubscribers.push(unsubOffer);

    // Handle ICE candidates from signal server
    const unsubIce = websocketAPI.onIceCandidate(async (candidate) => {
      try {
        await this.pc!.addIceCandidate(candidate);
      } catch (err) {
        console.error("Failed to add ICE candidate:", err);
      }
    });
    this.unsubscribers.push(unsubIce);

    // Send our ICE candidates to signal server
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        websocketAPI.sendIceCandidate(event.candidate.toJSON());
      }
    };

    // Handle data channels from worker
    this.pc.ondatachannel = (event) => {
      const channel = event.channel;
      console.log("Data channel:", channel.label);

      if (channel.label === "video") {
        this.videoChannel = channel;
        channel.binaryType = "arraybuffer";

        channel.onopen = () => {
          console.log("Video channel open");
        };

        channel.onmessage = (e) => {
          this.notifyVideo(e.data);
        };
      } else if (channel.label === "input") {
        this.inputChannel = channel;

        channel.onopen = () => {
          console.log("Input channel ready");
        };
      }
    };

    // Monitor connection state
    this.pc.onconnectionstatechange = () => {
      console.log("[WebRTC] Connection state:", this.pc?.connectionState);

      if (
        this.pc?.connectionState === "failed" ||
        this.pc?.connectionState === "disconnected"
      ) {
        this.notifyDisconnected();
        this.close();
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log(
        "[WebRTC] ICE connection state:",
        this.pc?.iceConnectionState
      );
    };

    this.pc.onicegatheringstatechange = () => {
      console.log("[WebRTC] ICE gathering state:", this.pc?.iceGatheringState);
    };

    this.pc.onsignalingstatechange = () => {
      console.log("[WebRTC] Signaling state:", this.pc?.signalingState);
    };

    // Handle errors from signal server
    const unsubError = websocketAPI.onError(() => {
      this.close();
    });
    this.unsubscribers.push(unsubError);

    // Handle Shutdowns
    const unsubShutdown = websocketAPI.onShutdown(() => {
      this.close();
    });
    this.unsubscribers.push(unsubShutdown);
  }

  sendInput(msg: InputMessage): void {
    if (this.inputChannel && this.inputChannel.readyState === "open") {
      websocketAPI.sendInputEvent();
      this.inputChannel.send(JSON.stringify(msg));
    }
  }

  resetVideo(): void {
    if (this.inputChannel && this.inputChannel.readyState === "open") {
      this.inputChannel.send(JSON.stringify({ type: MSG.RESET_VIDEO }));
      console.log("[WebRTC] Sent reset-video request");
    }
  }

  close(): void {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
    if (this.videoChannel) {
      this.videoChannel.close();
      this.videoChannel = null;
    }
    if (this.inputChannel) {
      this.inputChannel.close();
      this.inputChannel = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    // Clear all state
    this.turnServers = null;
    this.onVideoCallbacks = [];
    this.onErrorCallbacks = [];
    this.onDisconnectedCallbacks = [];
  }
}

export const videoInputWebRTC = VideoInputWebRTC.getInstance();
