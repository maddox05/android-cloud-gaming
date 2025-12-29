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
} from "../shared/types.js";

import { GAMES_LIST, MSG, ERROR_CODE } from "../shared/types.js";

const { RTCPeerConnection, RTCSessionDescription } = wrtc;

if (!process.env.SIGNAL_URL) {
  console.error("SIGNAL_URL environment variable is required");
  process.exit(1); // this will just keep looping a restart, so dont let this happen ahha
}
const SIGNAL_SERVER_URL = `${process.env.SIGNAL_URL.includes("localhost") || process.env.SIGNAL_URL.includes("signal") ? "ws" : "wss"}://${process.env.SIGNAL_URL}?role=worker`;
console.log(`Signal server URL: ${SIGNAL_SERVER_URL}`);


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
  // if (process.env.TURN_URL) {
  //   iceServers.push({
  //     urls: process.env.TURN_URL,
  //     username: process.env.TURN_USERNAME || "",
  //     credential: process.env.TURN_CREDENTIAL || "",
  //   });
  // }

  const pc = new RTCPeerConnection({ iceServers });

  // Create data channel for video (sending H.264)
  videoChannel = pc.createDataChannel("video", {
    ordered: false,
    maxRetransmits: 0,
  });

  videoChannel.onopen = () => {
    console.log("Video channel open");
    // Start piping video data
    // let videoChunkCount = 0;
    videoHandler.setCallback((data) => {
      if (videoChannel && videoChannel.readyState === "open") {
        // videoChunkCount++;
        // console.log(
        //   `Video sent: chunk #${videoChunkCount}, ${data.length} bytes`
        // );
        {/* @ts-ignore */} // this used to be new Uint8Array(data) but thats a copy, it still works without a copy, so why copt it.
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
      console.log("  Local description type:", pc.localDescription?.type ?? "none");
      console.log("  Remote description type:", pc.remoteDescription?.type ?? "none");

      // Get connection stats for more insight
      try {
        const stats = await pc.getStats();
        stats.forEach((report) => {
          if (report.type === "candidate-pair" && report.state) {
            console.log(`  Candidate pair: ${report.state}, local: ${report.localCandidateId}, remote: ${report.remoteCandidateId}`);
          }
          if (report.type === "local-candidate") {
            console.log(`  Local candidate: ${report.candidateType} ${report.protocol} ${report.address}:${report.port}`);
          }
          if (report.type === "remote-candidate") {
            console.log(`  Remote candidate: ${report.candidateType} ${report.protocol} ${report.address}:${report.port}`);
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
}

function notifyCrashAndExit(reason: string): void {
  console.error(`Worker crashed: ${reason}`);

  // Notify signal server of crash so it can disconnect the client
  if (signalSocket && signalSocket.readyState === WebSocket.OPEN) {
    // const crashMsg: WorkerCrashedMessage = {
    //   type: "worker-crashed",
    //   reason: reason,
    // };
    // signalSocket.send(JSON.stringify(crashMsg));

    // we could send for debug logging but ehh
  }

  restart(1);
}

let isRestarting = false;

async function restart(exitCode:number = 0) {
  console.log("Restarting...");
  if (isRestarting) {
    console.log(">>> Already restarting, skipping");
    return;
  }
  isRestarting = true;

  console.log(">>> Restarting worker - exiting for Docker to restart container...");

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
async function initializeSession(gameId:string): Promise<void> {
  if (sessionStarted) {
    console.log("Session already started");
    return;
  }
  sessionStarted = true;

  console.log("Client wants to connect, initializing session...");

  // Start Redroid with the game package (kiosk mode)
  console.log(`Starting Redroid with game: ${gameId}...`);
  await redroidRunner.start(gameId);

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
    const register: RegisterMessage = { type: "register", games: GAMES_LIST };
    signalSocket!.send(JSON.stringify(register));
    console.log(`Registered with games: ${GAMES_LIST.join(", ")}`);
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

      case MSG.START: {
        // Client wants to connect - create peer connection and offer
        // (session initialization happens when WebRTC actually connects)
        console.log("Creating peer connection and offer...");
        peerConnection = await createPeerConnection();

        const offer = await peerConnection!.createOffer();
        await peerConnection!.setLocalDescription(offer);

        const offerMsg: OfferMessage = {
          type: MSG.OFFER,
          sdp: offer.sdp!,
        };
        signalSocket!.send(JSON.stringify(offerMsg));
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
        // Client sent ICE candidate
        if (peerConnection && msg.candidate) {
          await peerConnection.addIceCandidate(msg.candidate);
        }
        break;

      case MSG.CLIENT_DISCONNECTED:
        console.log("Client disconnected, restarting worker...");
        restart();
        break;



      case MSG.CLIENT_GAME_SELECTED:
        // Client's WebRTC is connected - NOW initialize the session
        console.log("Client choose game, initializing session...");
        try {
          await initializeSession(msg.gameId);

          // inputHandler.resetVideo();
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          notifyCrashAndExit(`Failed to initialize session: ${errorMessage}`);
        }
        break;

      case MSG.SHUTDOWN:
        console.log(`Shutdown requested: ${msg.reason}`);
        restart()
        break;
    }
  });

  signalSocket.on("close", async () => {
    console.log("Disconnected from signal server, restarting myself!");
    // sleep 5 secs
    await new Promise((resolve) => setTimeout(resolve, 5000));
    process.exit(0);
  })

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

main().catch((err) => {
  const errorMessage = err instanceof Error ? err.message : String(err);
  notifyCrashAndExit(errorMessage);
});
