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
  ErrorMessage,
  WorkerStartMessage,
} from "../shared/types.js";
import { STUN_SERVERS } from "../shared/const.js";

import { MSG, ERROR_CODE, FREE_USER_MAX_VIDEO_SIZE } from "../shared/types.js";
import { GAMES_LIST } from "../shared/const.js";

const { RTCPeerConnection, RTCSessionDescription } = wrtc;

if (!process.env.SIGNAL_URL) {
  console.error("SIGNAL_URL environment variable is required");
  process.exit(1); // this will just keep looping a restart, so dont let this happen ahha
}
const SIGNAL_SERVER_URL = `${
  process.env.SIGNAL_URL.includes("localhost") ||
  process.env.SIGNAL_URL.includes("signal")
    ? "ws"
    : "wss"
}://${process.env.SIGNAL_URL}?role=worker`;
console.log(`Signal server URL: ${SIGNAL_SERVER_URL}`);

type PC = InstanceType<typeof RTCPeerConnection>;
type DataChannel = ReturnType<PC["createDataChannel"]>;

let peerConnection: PC | null = null;
let videoChannel: DataChannel | null = null;
let inputChannel: DataChannel | null = null;

// TURN servers received from signal server
let currentTurnServers: RTCIceServer[] | null = null;

async function createPeerConnection(): Promise<PC> {
  // Merge STUN servers with any TURN servers we received
  const iceServers: RTCIceServer[] = [
    ...STUN_SERVERS,
    ...(currentTurnServers ?? []),
  ];
  console.log(
    `[WebRTC] Using ICE servers: ${iceServers.length} (STUN: ${
      STUN_SERVERS.length
    } + TURN: ${currentTurnServers?.length ?? 0})`
  );

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
        // this used to be new Uint8Array(data) but thats a copy, it still works without a copy, so why copt it.

        /* @ts-ignore */
        videoChannel.send(data);
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
      const msg: InputMessage = JSON.parse(event.data); // TODO validate is actual input msg

      inputHandler.sendInput(msg as InputMessage);
    } catch (e) {
      console.error("Invalid input message:", e);
    }
  };

  pc.onicecandidate = (event) => {
    if (
      event.candidate &&
      event.candidate.candidate &&
      signalSocket &&
      signalSocket.readyState === WebSocket.OPEN
    ) {
      const iceMsg: IceCandidateMessage = {
        type: MSG.ICE_CANDIDATE,
        candidate: event.candidate.toJSON(),
      };

      signalSocket.send(JSON.stringify(iceMsg));
    }
  };

  pc.onconnectionstatechange = async () => {
    console.log("[WebRTC] Connection state:", pc.connectionState);
    if (
      pc.connectionState === "disconnected" ||
      pc.connectionState === "failed"
    ) {
      // Log detailed diagnostics before restarting
      console.log("[WebRTC] Connection failed/disconnected - diagnostics:");
      console.log("  ICE connection state:", pc.iceConnectionState);
      console.log("  ICE gathering state:", pc.iceGatheringState);
      console.log("  Signaling state:", pc.signalingState);
      console.log(
        "  Local description type:",
        pc.localDescription?.type ?? "none"
      );
      console.log(
        "  Remote description type:",
        pc.remoteDescription?.type ?? "none"
      );

      // Get connection stats for more insight
      try {
        const stats = await pc.getStats();
        stats.forEach((report) => {
          if (report.type === "candidate-pair" && report.state) {
            console.log(
              `  Candidate pair: ${report.state}, local: ${report.localCandidateId}, remote: ${report.remoteCandidateId}`
            );
          }
          if (report.type === "local-candidate") {
            console.log(
              `  Local candidate: ${report.candidateType} ${report.protocol} ${report.address}:${report.port}`
            );
          }
          if (report.type === "remote-candidate") {
            console.log(
              `  Remote candidate: ${report.candidateType} ${report.protocol} ${report.address}:${report.port}`
            );
          }
        });
      } catch (e) {
        console.log("  Could not get stats:", e);
      }

      // Send error to signal server so client can be notified
      if (signalSocket && signalSocket.readyState === WebSocket.OPEN) {
        const errorMsg: ErrorMessage = {
          type: MSG.ERROR,
          code: ERROR_CODE.WEBRTC_FAILED,
          message: `WebRTC connection ${pc.connectionState}: ICE ${pc.iceConnectionState}`,
        };
        signalSocket.send(JSON.stringify(errorMsg));
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));

      restart();
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

  return pc;
}

function webrtc_cleanup() {
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
  currentTurnServers = null;
}

function notifyCrashAndExit(reason: string): void {
  console.error(`Worker crashed: ${reason}`);

  // Notify signal server of crash so it can inform the client
  if (signalSocket && signalSocket.readyState === WebSocket.OPEN) {
    const errorMsg: ErrorMessage = {
      type: MSG.ERROR,
      code: ERROR_CODE.WORKER_CRASHED,
      message: "Rip", // todo add back reason, ommited for now for security
    };
    signalSocket.send(JSON.stringify(errorMsg));
  }

  restart(1);
}

let isRestarting = false;

async function restart(exitCode: number = 0) {
  console.log("Restarting...");
  if (isRestarting) {
    console.log(">>> Already restarting, skipping");
    return;
  }
  isRestarting = true;

  console.log(
    ">>> Restarting worker - exiting for Docker to restart container..."
  );

  // Cleanup WebRTC
  webrtc_cleanup();

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
  process.exit(exitCode);
}

let signalSocket: WebSocket | null = null;
let sessionStarted = false;

/**
 * Initialize the session - start redroid, connect video/input, create peer connection
 * Called when a client wants to connect (receives "start" message)
 */
async function initializeSession(gameId: string, maxVideoSize: number): Promise<void> {
  if (sessionStarted) {
    console.log("Session already started");
    return;
  }
  sessionStarted = true;

  console.log("Client wants to connect, initializing session...");

  // Start Redroid with the game package (kiosk mode)
  console.log(`Starting Redroid with game: ${gameId}, maxVideoSize: ${maxVideoSize}...`);
  await redroidRunner.start(gameId, maxVideoSize);

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

    // Register with signal server
    const register: RegisterMessage = {
      type: MSG.REGISTER,
      games: GAMES_LIST.map((g) => g.id),
    };
    signalSocket!.send(JSON.stringify(register));
    console.log(
      `Registered with games: ${GAMES_LIST.map((g) => g.id).join(", ")}`
    );
    console.log("Waiting for client to connect...");
  });

  signalSocket.on("message", async (data) => {
    const msg: SignalMessage = JSON.parse(data.toString());
    if (msg.type !== MSG.PING) {
      console.log("Signal message:", msg.type);
    }

    switch (msg.type) {
      case MSG.PING: {
        // Respond with pong
        const pong: PongMessage = { type: MSG.PONG };
        signalSocket!.send(JSON.stringify(pong));
        break;
      }

      case MSG.WORKER_START: {
        // Signal server tells us to start - create peer connection and initialize session
        const workerStartMsg = msg as WorkerStartMessage;
        console.log(
          "Creating peer connection, offer, and initializing session...",
          workerStartMsg.turnInfo ? "(with TURN)" : "(no TURN)"
        );
        try {
          // Store TURN servers before creating peer connection
          currentTurnServers = workerStartMsg.turnInfo ?? null;

          peerConnection = await createPeerConnection();

          const offer = await peerConnection!.createOffer();
          await peerConnection!.setLocalDescription(offer);

          const offerMsg: OfferMessage = {
            type: MSG.OFFER,
            sdp: offer.sdp!,
          };
          signalSocket!.send(JSON.stringify(offerMsg));

          // Initialize the session with the game
          const maxVideoSize = workerStartMsg.maxVideoSize ?? FREE_USER_MAX_VIDEO_SIZE;
          await initializeSession(workerStartMsg.gameId, maxVideoSize);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          notifyCrashAndExit(`Failed to start worker: ${errorMessage}`);
        }
        break;
      }

      case MSG.ANSWER:
        // Client sent answer
        if (peerConnection) {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription({ type: "answer", sdp: msg.sdp })
          );
          console.log("Remote description set");
        }
        break;

      case MSG.ICE_CANDIDATE:
        /**
                   * some candidates send null candidates differently this one sends a fucking empty string (Firefox)
           * Adding remote ICE candidate... {
worker-1   |   candidate: '',
worker-1   |   sdpMLineIndex: 0,
worker-1   |   sdpMid: '0',
worker-1   |   usernameFragment: '33135709'
worker-1   | }
           */
        if (
          !msg.candidate ||
          typeof msg.candidate !== "object" ||
          typeof msg.candidate.candidate !== "string" ||
          msg.candidate.candidate.length === 0
        ) {
          // end-of-candidates or malformed → ignore
          return;
        }
        if (peerConnection && msg.candidate) {
          console.log("Adding remote ICE candidate...", msg.candidate);
          await peerConnection.addIceCandidate(msg.candidate);
          console.log("Added remote ICE candidate!");
        }
        break;

      case MSG.SHUTDOWN:
        console.log(`Shutdown requested: ${msg.reason}`);
        restart();
        break;
    }
  });

  signalSocket.on("close", async () => {
    console.log("Disconnected from signal server, restarting myself!");
    // sleep 5 secs
    await new Promise((resolve) => setTimeout(resolve, 5000));
    process.exit(0);
  });

  signalSocket.on("error", (err) => {
    console.error("Signal socket error:", err);
  });
}

async function main() {
  console.log("Starting Worker...");

  // Restart redroid on worker startup to ensure fresh state
  redroidRunner.restartContainer();

  // Only connect to signal server initially
  // Redroid/video/input will be started when a client connects
  console.log("Connecting to signal server...");
  await connectToSignalServer();

  console.log("Worker ready and waiting for client!");
  isRestarting = false;
}

// Catch unhandled errors from event callbacks (like onmessage)
process.on("uncaughtException", (err) => {
  const errorMessage = err instanceof Error ? err.message : String(err);
  notifyCrashAndExit(`Uncaught exception: ${errorMessage}`);
});

process.on("unhandledRejection", (reason) => {
  const errorMessage =
    reason instanceof Error ? reason.message : String(reason);
  notifyCrashAndExit(`Unhandled rejection: ${errorMessage}`);
});

main().catch((err) => {
  const errorMessage = err instanceof Error ? err.message : String(err);
  notifyCrashAndExit(errorMessage);
});
