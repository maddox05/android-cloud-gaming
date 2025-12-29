import { websocketAPI } from "./websocket_api";
import {
  ERROR_CODE,
  type InputMessage,
  type ErrorCode,
} from "../../../shared/types";

export interface WebRTCConnection {
  sendInput: (msg: InputMessage) => void;
  close: () => void;
}

export async function connect(
  onVideo: (data: ArrayBuffer) => void,
  onError: (code: ErrorCode | undefined, message: string) => void,
  onDisconnected: () => void
): Promise<WebRTCConnection> {
  // ICE servers config with TURN for NAT traversal
  const iceServers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ];

  // Create peer connection
  const pc = new RTCPeerConnection({ iceServers });

  let inputChannel: RTCDataChannel | null = null;
  let videoChannel: RTCDataChannel | null = null;
  const unsubscribers: (() => void)[] = [];

  // Handle incoming offer
  const unsubOffer = websocketAPI.onOffer(async (sdp) => {
    try {
      console.log("Received offer");
      await pc.setRemoteDescription({ type: "offer", sdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      websocketAPI.sendAnswer(answer.sdp!);
    } catch (err) {
      console.error("Failed to handle offer:", err);
      onError(
        ERROR_CODE.WEBRTC_FAILED,
        "Failed to establish connection to worker"
      ); // singal server and this use same code, but one is from client one is not
    }
  });
  unsubscribers.push(unsubOffer);

  // Handle ICE candidates from signal server
  const unsubIce = websocketAPI.onIceCandidate(async (candidate) => {
    try {
      await pc.addIceCandidate(candidate);
    } catch (err) {
      console.error("Failed to add ICE candidate:", err);
    }
  });
  unsubscribers.push(unsubIce);

  // Send our ICE candidates to signal server
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      websocketAPI.sendIceCandidate(event.candidate.toJSON());
    }
  };

  // Handle data channels from worker
  pc.ondatachannel = (event) => {
    const channel = event.channel;
    console.log("Data channel:", channel.label);

    if (channel.label === "video") {
      videoChannel = channel;
      channel.binaryType = "arraybuffer";

      channel.onopen = () => {
        console.log("Video channel open");
      };

      channel.onmessage = (e) => {
        onVideo(e.data);
      };
    } else if (channel.label === "input") {
      inputChannel = channel;

      channel.onopen = () => {
        console.log("Input channel ready");
      };
    }
  };

  // Monitor connection state
  pc.onconnectionstatechange = () => {
    console.log("[WebRTC] Connection state:", pc.connectionState);

    if (
      pc.connectionState === "failed" ||
      pc.connectionState === "disconnected"
    ) {
      onDisconnected();
      // todo could send server that I failed the webrtc connection
    }
  };

  pc.oniceconnectionstatechange = () => {
    console.log("[WebRTC] ICE connection state:", pc.iceConnectionState);
  };

  pc.onicegatheringstatechange = () => {
    console.log("[WebRTC] ICE gathering state:", pc.iceGatheringState);
  };

  pc.onsignalingstatechange = () => {
    console.log("[WebRTC] Signaling state:", pc.signalingState);
  };

  // Handle errors from signal server
  const unsubError = websocketAPI.onError(() => {
    closeConnection();
  });
  unsubscribers.push(unsubError);

  // Handle Shutdowns
  const unsubShutdown = websocketAPI.onShutdown(() => {
    closeConnection();
  });
  unsubscribers.push(unsubShutdown);

  function closeConnection() {
    unsubscribers.forEach((unsub) => unsub());
    if (videoChannel) videoChannel.close();
    if (inputChannel) inputChannel.close();
    pc.close();
  }

  // Return connection control
  return {
    sendInput: (msg: InputMessage) => {
      if (inputChannel && inputChannel.readyState === "open") {
        websocketAPI.sendInputEvent(); // TODO RElook at arcitexture its spagetti code
        inputChannel.send(JSON.stringify(msg));
      }
    },
    close: closeConnection,
  };
}
