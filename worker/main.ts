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
  RegisterMessage,
  PongMessage,
  WorkerCrashedMessage,
} from "../shared/types.js";

const { RTCPeerConnection, RTCSessionDescription } = wrtc;

if (!process.env.SIGNAL_URL) {
  console.error("SIGNAL_URL environment variable is required");
  process.exit(1);
}
const SIGNAL_SERVER_URL = `${process.env.SIGNAL_URL.includes("localhost") || process.env.SIGNAL_URL.includes("signal") ? "ws" : "wss"}://${process.env.SIGNAL_URL}?role=worker`;
console.log(`Signal server URL: ${SIGNAL_SERVER_URL}`);


const GAME = "com.supercell.clashroyale";
const MAX_RECONNECT_DELAY = 30000;
let reconnectDelay = 1000;

type PC = InstanceType<typeof RTCPeerConnection>;
type DataChannel = ReturnType<PC["createDataChannel"]>;

let peerConnection: PC | null = null;
let videoChannel: DataChannel | null = null;
let inputChannel: DataChannel | null = null;

async function createPeerConnection(): Promise<PC> {
  const iceServers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
  ];

  // Add TURN server if configured (recommended for reliable connectivity)
  if (process.env.TURN_URL) {
    iceServers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME || "",
      credential: process.env.TURN_CREDENTIAL || "",
    });
  }

  const pc = new RTCPeerConnection({ iceServers });

  // Create data channel for video (sending H.264)
  videoChannel = pc.createDataChannel("video", {
    ordered: false,
    maxRetransmits: 0,
  });

  videoChannel.onopen = () => {
    console.log("Video channel open");
    // Start piping video data
    let videoChunkCount = 0;
    videoHandler.setCallback((data) => {
      if (videoChannel && videoChannel.readyState === "open") {
        videoChunkCount++;
        console.log(
          `Video sent: chunk #${videoChunkCount}, ${data.length} bytes`
        );
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

      inputHandler.sendInput(msg as InputMessage);
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
      restart();
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

function notifyCrashAndExit(reason: string): void {
  console.error(`Worker crashed: ${reason}`);

  // Notify signal server of crash so it can disconnect the client
  if (signalSocket && signalSocket.readyState === WebSocket.OPEN) {
    const crashMsg: WorkerCrashedMessage = {
      type: "worker-crashed",
      reason: reason,
    };
    signalSocket.send(JSON.stringify(crashMsg));
  }

  // Cleanup resources
  cleanup();
  videoHandler.disconnect();
  inputHandler.disconnect();

  // Exit with error code - Docker will restart the container
  process.exit(1);
}

let isRestarting = false;

async function restart() {
  console.log(">>> restart() called, isRestarting:", isRestarting);
  if (isRestarting) {
    console.log(">>> Already restarting, skipping");
    return;
  }
  isRestarting = true;

  console.log(">>> Restarting worker - exiting for Docker to restart container...");

  // Cleanup WebRTC
  cleanup();

  // Close signal socket
  if (signalSocket) {
    signalSocket.removeAllListeners();
    signalSocket.close();
    signalSocket = null;
  }

  // Disconnect from scrcpy
  videoHandler.disconnect();
  inputHandler.disconnect();

  // Exit - Docker restart policy will restart the container fresh
  console.log(">>> Calling process.exit(0) NOW");
  process.exit(0);
}

let signalSocket: WebSocket | null = null;
let sessionStarted = false;

/**
 * Initialize the session - start redroid, connect video/input, create peer connection
 * Called when a client wants to connect (receives "start" message)
 */
async function initializeSession(): Promise<void> {
  if (sessionStarted) {
    console.log("Session already started");
    return;
  }
  sessionStarted = true;

  console.log("Client wants to connect, initializing session...");

  // Start Redroid with the game package (kiosk mode)
  console.log(`Starting Redroid with game: ${GAME}...`);
  await redroidRunner.start(GAME);

  // Connect to scrcpy sockets in ORDER: video first, then control
  // scrcpy uses a single abstract socket - connections are served in order
  console.log("Connecting to scrcpy video socket (first)...");
  await videoHandler.connect();
  console.log("Connecting to scrcpy control socket (second)...");
  await inputHandler.connect();

  console.log("Session initialized!");
}

async function connectToSignalServer() {
  signalSocket = new WebSocket(SIGNAL_SERVER_URL);

  signalSocket.on("open", () => {
    console.log("Connected to signal server");
    // Reset reconnect delay on successful connection
    reconnectDelay = 1000;
    // Register with signal server
    const register: RegisterMessage = { type: "register", game: GAME };
    signalSocket!.send(JSON.stringify(register));
    console.log(`Registered with game: ${GAME}`);
    console.log("Waiting for client to connect...");
  });

  signalSocket.on("message", async (data) => {
    const msg: SignalMessage = JSON.parse(data.toString());
    if (msg.type !== "ping") {
      console.log("Signal message:", msg.type);
    }

    switch (msg.type) {
      case "ping": {
        // Respond with pong
        const pong: PongMessage = { type: "pong" };
        signalSocket!.send(JSON.stringify(pong));
        break;
      }

      case "start": {
        // Client wants to connect - create peer connection and offer
        // (session initialization happens when WebRTC actually connects)
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
        console.log("Client disconnected, restarting worker...");
        restart();
        break;

      case "client-connected":
        // Client's WebRTC is connected - NOW initialize the session
        console.log("Client WebRTC connected, initializing session...");
        try {
          await initializeSession();

          // inputHandler.resetVideo();
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          notifyCrashAndExit(`Failed to initialize session: ${errorMessage}`);
        }
        break;

      case "shutdown":
        console.log(`Shutdown requested: ${msg.reason}`);
        cleanup();
        process.exit(0);
    }
  });

  signalSocket.on("close", () => {
    console.log("Disconnected from signal server, restarting myself!");
// TODO wait for 2 secs
    process.exit(0);})

  signalSocket.on("error", (err) => {
    console.error("Signal socket error:", err);
  });
}

async function main() {
  console.log("Starting Worker...");
  console.log(`Game: ${GAME}`);

  // Restart redroid on worker startup to ensure fresh state
  redroidRunner.restartContainer();

  // Only connect to signal server initially
  // Redroid/video/input will be started when a client connects
  console.log("Connecting to signal server...");
  await connectToSignalServer();

  console.log("Worker ready and waiting for client!");
  isRestarting = false;
  reconnectDelay = 1000;
}

main().catch((err) => {
  const errorMessage = err instanceof Error ? err.message : String(err);
  notifyCrashAndExit(errorMessage);
});
