import WebSocket from "ws";
import wrtc from "@roamhq/wrtc";
import { redroidRunner } from "./redriod_runner.js";
import { videoHandler } from "./video.js";
import { inputHandler } from "./input.js";
import type {
  InputMessage,
  SignalMessage,
  OfferMessage,
  IceCandidateMessage,
} from "../../shared/types.js";

const { RTCPeerConnection, RTCSessionDescription } = wrtc;

if (!process.env.SIGNAL_URL) {
  console.error("SIGNAL_URL environment variable is required");
  process.exit(1);
}
const SIGNAL_SERVER_URL = process.env.SIGNAL_URL;

type PC = InstanceType<typeof RTCPeerConnection>;
type DataChannel = ReturnType<PC["createDataChannel"]>;

let peerConnection: PC | null = null;
let videoChannel: DataChannel | null = null;
let inputChannel: DataChannel | null = null;

async function createPeerConnection(): Promise<PC> {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  // Create data channel for video (sending H.264)
  videoChannel = pc.createDataChannel("video", {
    ordered: false,
    maxRetransmits: 0,
  });

  videoChannel.onopen = () => {
    console.log("Video channel open");
    // Start piping video data
    let videoChunkCount = 0;
    videoHandler.onData((data) => {
      if (videoChannel && videoChannel.readyState === "open") {
        videoChunkCount++;
        console.log(`Video sent: chunk #${videoChunkCount}, ${data.length} bytes`);
        // Convert Node Buffer to Uint8Array for WebRTC
        videoChannel.send(new Uint8Array(data));
      }
    });
  };

  // Create data channel for input (receiving)
  // Using unordered + maxRetransmits:0 for lowest latency
  // Trade-off: events may drop or arrive out of order
  inputChannel = pc.createDataChannel("input", {
    ordered: false,
    maxRetransmits: 0,
  });

  inputChannel.onopen = () => {
    console.log("Input channel open");
  };

  inputChannel.onmessage = (event) => {
    try {
      const msg: InputMessage = JSON.parse(event.data);
      console.log("Input received:", msg.type, msg.action, `(${msg.x}, ${msg.y})`);
      inputHandler.sendInput(msg);
    } catch (e) {
      console.error("Invalid input message:", e);
    }
  };

  pc.onicecandidate = (event) => {
    if (
      event.candidate &&
      signalSocket &&
      signalSocket.readyState === WebSocket.OPEN
    ) {
      const iceMsg: IceCandidateMessage = {
        type: "ice-candidate",
        candidate: event.candidate.toJSON(),
      };
      signalSocket.send(JSON.stringify(iceMsg));
    }
  };

  pc.onconnectionstatechange = () => {
    console.log("Connection state:", pc.connectionState);
    if (
      pc.connectionState === "disconnected" ||
      pc.connectionState === "failed"
    ) {
      cleanup(); // todo for much later, change this to just become a open pod again.
    }
  };

  return pc;
}

function cleanup() {
  if (videoChannel) {
    videoChannel.close();
    videoChannel = null;
  }
  if (inputChannel) {
    inputChannel.close();
    inputChannel = null;
  }
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
}

let signalSocket: WebSocket | null = null;

async function connectToSignalServer() {
  signalSocket = new WebSocket(SIGNAL_SERVER_URL);

  signalSocket.on("open", () => {
    console.log("Connected to signal server");
  });

  signalSocket.on("message", async (data) => {
    const msg: SignalMessage = JSON.parse(data.toString());
    console.log("Signal message:", msg.type);

    switch (msg.type) {
      case "start": {
        // Client wants to connect, create offer
        console.log("Creating peer connection and offer...");
        peerConnection = await createPeerConnection();

        const offer = await peerConnection!.createOffer();
        await peerConnection!.setLocalDescription(offer);

        const offerMsg: OfferMessage = {
          type: "offer",
          sdp: offer.sdp!,
        };
        signalSocket!.send(JSON.stringify(offerMsg));
        break;
      }

      case "answer":
        // Client sent answer
        if (peerConnection) {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription({ type: "answer", sdp: msg.sdp })
          );
          console.log("Remote description set");
        }
        break;

      case "ice-candidate":
        // Client sent ICE candidate
        if (peerConnection && msg.candidate) {
          await peerConnection.addIceCandidate(msg.candidate);
        }
        break;

      case "client-disconnected":
        console.log("Client disconnected, cleaning up...");
        cleanup();
        break;
    }
  });

  signalSocket.on("close", () => {
    console.log("Signal server disconnected, reconnecting in 3s...");
    setTimeout(connectToSignalServer, 3000);
  });

  signalSocket.on("error", (err) => {
    console.error("Signal socket error:", err);
  });
}

async function main() {
  console.log("Starting Pod...");

  // Start Redroid
  console.log("Starting Redroid...");
  await redroidRunner.start();

  // Connect to scrcpy sockets in ORDER: video first, then control
  // scrcpy uses a single abstract socket - connections are served in order
  console.log("Connecting to scrcpy video socket (first)...");
  await videoHandler.connect();
  console.log("Connecting to scrcpy control socket (second)...");
  await inputHandler.connect();

  // Connect to signal server
  console.log("Connecting to signal server...");
  await connectToSignalServer();

  console.log("Pod ready!");

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    cleanup();
    videoHandler.disconnect();
    inputHandler.disconnect();
    await redroidRunner.stop();
    process.exit(0);
  });
}

main().catch(console.error);
