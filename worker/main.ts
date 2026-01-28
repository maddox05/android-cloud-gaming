import WebSocket from "ws";
import wrtc from "@roamhq/wrtc";
import { redroidRunner } from "./redriod_runner.js";
import { videoHandler } from "./video.js";
import { inputHandler } from "./input.js";
import { ScrcpyServer } from "./base_socket.js";
import { initializeWithGameSave, saveGameState } from "./game_save_manager.js";
import { clearDiffVolume } from "./volume_manager.js";
import { ENABLE_GAME_SAVES } from "../shared/const.js";
// Create scrcpy server and register handlers (video first, then input)
const scrcpyServer = ScrcpyServer.getInstance();
scrcpyServer.addHandler(videoHandler);
scrcpyServer.addHandler(inputHandler);
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
  process.exit(1);
}

if (!process.env.WORKER_PASSWORD) {
  console.error("WORKER_PASSWORD environment variable is required");
  process.exit(1);
}

const SIGNAL_SERVER_URL = `${
  process.env.SIGNAL_URL.includes("localhost") ||
  process.env.SIGNAL_URL.includes("signal")
    ? "ws"
    : "wss"
}://${process.env.SIGNAL_URL}?role=worker&password=${encodeURIComponent(process.env.WORKER_PASSWORD!)}`;
console.log(`Signal server URL: ${SIGNAL_SERVER_URL}`);

type PC = InstanceType<typeof RTCPeerConnection>;
type DataChannel = ReturnType<PC["createDataChannel"]>;

class Worker {
  private static instance: Worker | null = null;

  private peerConnection: PC | null = null;
  private videoChannel: DataChannel | null = null;
  private inputChannel: DataChannel | null = null;
  private currentTurnServers: RTCIceServer[] | null = null;
  private currentUserId: string | null = null;
  private isRestarting = false;
  private hasStarted = false;
  private signalSocket: WebSocket | null = null;

  private constructor() {}

  static getInstance(): Worker {
    if (!Worker.instance) {
      Worker.instance = new Worker();
    }
    return Worker.instance;
  }

  private async createPeerConnection(): Promise<PC> {
    const iceServers: RTCIceServer[] = [
      ...STUN_SERVERS,
      ...(this.currentTurnServers ?? []),
    ];
    console.log(
      `[WebRTC] Using ICE servers: ${iceServers.length} (STUN: ${
        STUN_SERVERS.length
      } + TURN: ${this.currentTurnServers?.length ?? 0})`,
    );

    const pc = new RTCPeerConnection({ iceServers });

    this.videoChannel = pc.createDataChannel("video", {
      ordered: false,
      maxRetransmits: 0,
    });

    this.videoChannel.onopen = () => {
      console.log("Video channel open");
      // let videoChunkCount = 0;
      videoHandler.setCallback((data) => {
        if (this.videoChannel && this.videoChannel.readyState === "open") {
          // videoChunkCount++;
          // console.log(
          //   `Video sent: chunk #${videoChunkCount}, ${data.length} bytes`,
          // );
          /* @ts-ignore */
          this.videoChannel.send(data);
        }
      });
    };

    this.inputChannel = pc.createDataChannel("input", {
      ordered: false,
      maxRetransmits: 0,
    });

    this.inputChannel.onopen = () => {
      console.log("Input channel open");
    };

    this.inputChannel.onmessage = (event) => {
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
        event.candidate.candidate &&
        this.signalSocket &&
        this.signalSocket.readyState === WebSocket.OPEN
      ) {
        const iceMsg: IceCandidateMessage = {
          type: MSG.ICE_CANDIDATE,
          candidate: event.candidate.toJSON(),
        };
        this.signalSocket.send(JSON.stringify(iceMsg));
      }
    };

    pc.onconnectionstatechange = async () => {
      console.log("[WebRTC] Connection state:", pc.connectionState);
      if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed"
      ) {
        console.log("[WebRTC] Connection failed/disconnected - diagnostics:");
        console.log("  ICE connection state:", pc.iceConnectionState);
        console.log("  ICE gathering state:", pc.iceGatheringState);
        console.log("  Signaling state:", pc.signalingState);
        console.log(
          "  Local description type:",
          pc.localDescription?.type ?? "none",
        );
        console.log(
          "  Remote description type:",
          pc.remoteDescription?.type ?? "none",
        );

        try {
          const stats = await pc.getStats();
          stats.forEach((report) => {
            if (report.type === "candidate-pair" && report.state) {
              console.log(
                `  Candidate pair: ${report.state}, local: ${report.localCandidateId}, remote: ${report.remoteCandidateId}`,
              );
            }
            if (report.type === "local-candidate") {
              console.log(
                `  Local candidate: ${report.candidateType} ${report.protocol} ${report.address}:${report.port}`,
              );
            }
            if (report.type === "remote-candidate") {
              console.log(
                `  Remote candidate: ${report.candidateType} ${report.protocol} ${report.address}:${report.port}`,
              );
            }
          });
        } catch (e) {
          console.log("  Could not get stats:", e);
        }

        if (
          this.signalSocket &&
          this.signalSocket.readyState === WebSocket.OPEN
        ) {
          const errorMsg: ErrorMessage = {
            type: MSG.ERROR,
            code: ERROR_CODE.WEBRTC_FAILED,
            message: `WebRTC connection ${pc.connectionState}: ICE ${pc.iceConnectionState}`,
          };
          this.signalSocket.send(JSON.stringify(errorMsg));
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));

        this.restart();
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

  private webrtcCleanup(): void {
    if (this.videoChannel) {
      this.videoChannel.close();
      this.videoChannel = null;
    }
    if (this.inputChannel) {
      this.inputChannel.close();
      this.inputChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.currentTurnServers = null;
    this.currentUserId = null;
  }

  private notifyCrashAndExit(reason: string): void {
    console.error(`Worker crashed: ${reason}`);

    if (this.signalSocket && this.signalSocket.readyState === WebSocket.OPEN) {
      const errorMsg: ErrorMessage = {
        type: MSG.ERROR,
        code: ERROR_CODE.WORKER_CRASHED,
        message: "Rip",
      };
      this.signalSocket.send(JSON.stringify(errorMsg));
    }

    this.restart(1);
  }

  private async restart(exitCode: number = 0): Promise<void> {
    console.log("Restarting...");
    if (this.isRestarting) {
      console.log(">>> Already restarting, skipping");
      return;
    }
    this.isRestarting = true;

    if (this.hasStarted && this.currentUserId) {
      try {
        console.log("Saving users game state before restart...");
        scrcpyServer.close();

        await redroidRunner.stopContainer();
        if (ENABLE_GAME_SAVES) {
          await saveGameState(this.currentUserId);
        }
        await clearDiffVolume();
      } catch (err) {
        console.error("Failed to save game state during restart:", err);
      }
    } else {
      scrcpyServer.close();
    }

    this.webrtcCleanup();

    if (this.signalSocket) {
      this.signalSocket.removeAllListeners();
      this.signalSocket.close();
      this.signalSocket = null;
    }

    console.log(`>>> Calling process.exit(${exitCode}) NOW`);
    process.exit(exitCode);
  }

  private async initializeSession(
    gameId: string,
    maxVideoSize: number,
  ): Promise<void> {
    console.log("Client wants to connect, initializing session...");

    console.log("Preparing container for game saves...");
    await redroidRunner.stopContainer();

    if (this.currentUserId && ENABLE_GAME_SAVES) {
      await initializeWithGameSave(this.currentUserId);
    }

    await redroidRunner.startContainer();

    console.log(
      `Starting Redroid with game: ${gameId}, maxVideoSize: ${maxVideoSize}...`,
    );

    // Start scrcpy server listening BEFORE starting redroid (scrcpy will connect to us)
    console.log("Starting scrcpy server...");
    await scrcpyServer.listen();

    await redroidRunner.start(gameId, maxVideoSize);
    videoHandler.setCanSendVideo(true);
    inputHandler.resetVideo();

    this.hasStarted = true;

    console.log("Session initialized!");
  }

  private async connectToSignalServer(): Promise<void> {
    this.signalSocket = new WebSocket(SIGNAL_SERVER_URL);

    this.signalSocket.on("open", () => {
      console.log("Connected to signal server");

      const register: RegisterMessage = {
        type: MSG.REGISTER,
        games: GAMES_LIST.map((g) => g.id),
      };
      this.signalSocket!.send(JSON.stringify(register));
      console.log(
        `Registered with games: ${GAMES_LIST.map((g) => g.id).join(", ")}`,
      );
      console.log("Waiting for client to connect...");
    });

    this.signalSocket.on("message", async (data) => {
      const msg: SignalMessage = JSON.parse(data.toString());
      if (msg.type !== MSG.PING) {
        console.log("Signal message:", msg.type);
      }

      switch (msg.type) {
        case MSG.PING: {
          const pong: PongMessage = { type: MSG.PONG };
          this.signalSocket!.send(JSON.stringify(pong));
          break;
        }

        case MSG.WORKER_START: {
          const workerStartMsg = msg as WorkerStartMessage;
          console.log(
            "Creating peer connection, offer, and initializing session...",
            workerStartMsg.turnInfo ? "(with TURN)" : "(no TURN)",
            `userId: ${workerStartMsg.userId}`,
          );
          try {
            this.currentTurnServers = workerStartMsg.turnInfo ?? null;
            this.currentUserId = workerStartMsg.userId;

            this.peerConnection = await this.createPeerConnection();

            const offer = await this.peerConnection!.createOffer();
            await this.peerConnection!.setLocalDescription(offer);

            const offerMsg: OfferMessage = {
              type: MSG.OFFER,
              sdp: offer.sdp!,
            };
            this.signalSocket!.send(JSON.stringify(offerMsg));

            const maxVideoSize =
              workerStartMsg.maxVideoSize ?? FREE_USER_MAX_VIDEO_SIZE;
            await this.initializeSession(workerStartMsg.gameId, maxVideoSize);
          } catch (err) {
            const errorMessage =
              err instanceof Error ? err.message : String(err);
            this.notifyCrashAndExit(`Failed to start worker: ${errorMessage}`);
          }
          break;
        }

        case MSG.ANSWER:
          if (this.peerConnection) {
            await this.peerConnection.setRemoteDescription(
              new RTCSessionDescription({ type: "answer", sdp: msg.sdp }),
            );
            console.log("Remote description set");
          }
          break;

        case MSG.ICE_CANDIDATE:
          if (
            !msg.candidate ||
            typeof msg.candidate !== "object" ||
            typeof msg.candidate.candidate !== "string" ||
            msg.candidate.candidate.length === 0
          ) {
            return;
          }
          if (this.peerConnection && msg.candidate) {
            console.log("Adding remote ICE candidate...");
            await this.peerConnection.addIceCandidate(msg.candidate);
            console.log("Added remote ICE candidate!");
          }
          break;

        case MSG.SHUTDOWN:
          console.log(`Shutdown requested: ${msg.reason}`);
          this.restart();
          break;
      }
    });

    this.signalSocket.on("close", async () => {
      console.log("signalSocket on close!");
      this.restart();
    });

    this.signalSocket.on("error", (err) => {
      console.error("Signal socket error:", err);
    });
  }

  async start(): Promise<void> {
    console.log("Starting Worker...");

    console.log("Connecting to signal server...");
    await redroidRunner.stopContainer();

    await this.connectToSignalServer();

    console.log("Worker ready and waiting for client!");
    this.isRestarting = false;
  }

  handleUncaughtException(err: Error): void {
    const errorMessage = err instanceof Error ? err.message : String(err);
    this.notifyCrashAndExit(`Uncaught exception: ${errorMessage}`);
  }

  handleUnhandledRejection(reason: unknown): void {
    const errorMessage =
      reason instanceof Error ? reason.message : String(reason);
    this.notifyCrashAndExit(`Unhandled rejection: ${errorMessage}`);
  }
}

const worker = Worker.getInstance();

process.on("uncaughtException", (err) => {
  worker.handleUncaughtException(err);
});

process.on("unhandledRejection", (reason) => {
  worker.handleUnhandledRejection(reason);
});

worker.start().catch((err) => {
  const errorMessage = err instanceof Error ? err.message : String(err);
  worker.handleUncaughtException(new Error(errorMessage));
});
