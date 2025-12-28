import { websocketAPI } from "./websocket_api";
import { ERROR_CODE, type InputMessage, type ErrorCode } from "../../../shared/types";

export interface WebRTCConnection {
  sendInput: (msg: InputMessage) => void;
  close: () => void;
}

export async function connect(
  onVideo: (data: ArrayBuffer) => void,
  onError: (code: ErrorCode | undefined, message: string) => void,
  onDisconnected: () => void
): Promise<WebRTCConnection> {
  // Connect to signal server
  await websocketAPI.connect(); // webrtc is the one who establishes the websocket connection to signaling server

  // Create peer connection
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

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
      onError(ERROR_CODE.WEBRTC_FAILED, "Failed to establish connection");
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
        websocketAPI.sendConnected();
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
    console.log("Connection state:", pc.connectionState);

    if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
      onDisconnected();
    }
  };

  // Handle errors from signal server
  const unsubError = websocketAPI.onError((code, message) => {
    onError(code, message);
  });
  unsubscribers.push(unsubError);

  // Handle worker disconnection
  const unsubWorkerDisconnected = websocketAPI.onWorkerDisconnected(() => {
    onError(ERROR_CODE.WORKER_CRASHED, "Worker disconnected");
    onDisconnected();
  });
  unsubscribers.push(unsubWorkerDisconnected);

  // Handle signal server disconnection
  const unsubDisconnect = websocketAPI.onDisconnect(() => {
    onDisconnected();
  });
  unsubscribers.push(unsubDisconnect);



  // Return connection control
  return {
    sendInput: (msg: InputMessage) => {
      if (inputChannel && inputChannel.readyState === "open") {
        websocketAPI.sendInputEvent(); // TODO RElook at arcitexture its spagetti code
        inputChannel.send(JSON.stringify(msg));
      }
    },
    close: () => {
      unsubscribers.forEach((unsub) => unsub());
      if (videoChannel) videoChannel.close();
      if (inputChannel) inputChannel.close();
      pc.close();
      websocketAPI.close();
    },
  };
}
