import { useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { videoInputWebRTC } from "../utils/video_and_input_webrtc";
import { H264Decoder } from "../utils/decoder";
import { websocketAPI } from "../utils/websocket_api";
import { showAlert } from "../services/alertService";
import Canvas from "./canvas/Canvas";
import { CONNECTION_STATUS, type ConnectionStatus } from "../types";
import {
  ERROR_CODE,
  type ErrorCode,
  type InputMessage,
} from "../../../shared/types";
import "./InGame.css";

export default function InGame() {
  const { appId } = useParams<{ appId: string }>();

  const [status, setStatus] = useState<ConnectionStatus>(
    CONNECTION_STATUS.CONNECTING
  );
  const [loadingMessage, setLoadingMessage] = useState(
    "Connecting to server..."
  );

  const decoderRef = useRef<H264Decoder | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const initialized = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  const cleanup = () => {
    try {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    } catch (e) {
      timeoutRef.current = null;

      console.error("Failed to clear timeout:", e);
    }
    try {
      if (decoderRef.current) {
        decoderRef.current.reset();
        decoderRef.current = null;
      }
    } catch (e) {
      decoderRef.current = null;

      console.error("Failed to reset decoder:", e);
    }
    try {
      videoInputWebRTC.close();
    } catch (e) {
      console.error("Failed to close connection:", e);
    }
  };

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
    if (!decoderRef.current) {
      decoderRef.current = new H264Decoder(canvas, () =>
        videoInputWebRTC.resetVideo()
      );
    }
  }, []);

  function handleExit(reason?: string) {
    if (reason) {
      showAlert({
        type: "info",
        title: "Exiting Game",
        message: reason,
        onCloseRedirect: "/",
      });
    }
    cleanup();
    websocketAPI.close();
    if (!reason) {
      window.location.href = "/";
    }
  }

  if (!initialized.current) {
    initialized.current = true;
    console.log("Starting InGame connection");

    if (!appId) {
      showAlert({
        type: "error",
        title: "No Game Selected",
        message: "No game specified. Please select a game from the home page.",
        onCloseRedirect: "/",
      });
    } else {
      const handleSignalError = (
        code: ErrorCode | undefined,
        message: string
      ) => {
        setStatus(CONNECTION_STATUS.ERROR);

        if (code === ERROR_CODE.NO_WORKERS_AVAILABLE) {
          showAlert({
            type: "error",
            title: "Server Unavailable",
            message: "No game servers available. Please try again later.",
            onCloseRedirect: "/",
          });
        } else if (code === ERROR_CODE.WEBRTC_FAILED) {
          showAlert({
            type: "error",
            title: "Connection Failed",
            message: "WebRTC connection failed. Please try another wifi network.",
            onCloseRedirect: "/",
          });
        } else if (code === ERROR_CODE.CONNECTION_TIMEOUT) {
          showAlert({
            type: "warning",
            title: "Connection Timeout",
            message: "AFK? Not on my watch. Connection timed out.",
            onCloseRedirect: "/",
          });
        } else if (code === ERROR_CODE.WORKER_CRASHED) {
          showAlert({
            type: "error",
            title: "Server Crashed",
            message: `The game server crashed: ${message}`,
            onCloseRedirect: "/",
          });
        } else {
          showAlert({
            type: "error",
            title: "Error",
            message: `${message}. Returning to home page.`,
            onCloseRedirect: "/",
          });
        }
        cleanup();
        websocketAPI.close();
      };

      function handleWebRTCError(code: ErrorCode | undefined, message: string) {
        console.error("Error from WEBRTC:", code, message);
        setStatus(CONNECTION_STATUS.ERROR);

        if (code === ERROR_CODE.WEBRTC_FAILED) {
          showAlert({
            type: "error",
            title: "Connection Error",
            message: "Client (you) WebRTC connection failed. This is most likely a server issue.",
            link: { href: "https://discord.gg/U4QYdzXEnr", label: "Get Help on Discord" },
            onCloseRedirect: "/",
          });
        } else {
          showAlert({
            type: "error",
            title: "Error",
            message: `${message}. Returning to home page.`,
            onCloseRedirect: "/",
          });
        }
        cleanup();
        websocketAPI.close();
      }

      const handleDisconnectedFromWebRTC = () => {
        console.log("Disconnected from Worker");
        setStatus(CONNECTION_STATUS.DISCONNECTED);
        // no need to exit as if disconnected happens, signal server will follow up and exit us.
      };

      const handleVideoData = (data: ArrayBuffer) => {
        setStatus(CONNECTION_STATUS.CONNECTED);
        if (decoderRef.current) {
          decoderRef.current.appendData(data);
        }
      };

      websocketAPI.onShutdown(handleExit);
      websocketAPI.onError(handleSignalError);

      (async () => {
        try {
          if (!websocketAPI.isConnected()) {
            showAlert({
              type: "warning",
              title: "Queue Required",
              message: "You need to wait in the queue!",
              onCloseRedirect: "/",
            });
            return;
          }
          setLoadingMessage("Setting up worker...");

          // Subscribe to callbacks before connecting
          videoInputWebRTC.onVideo(handleVideoData);
          videoInputWebRTC.onError(handleWebRTCError);
          videoInputWebRTC.onDisconnected(handleDisconnectedFromWebRTC);

          await videoInputWebRTC.connect();

          if (canvasRef.current && !decoderRef.current) {
            decoderRef.current = new H264Decoder(canvasRef.current, () =>
              videoInputWebRTC.resetVideo()
            );
          }

          setStatus(CONNECTION_STATUS.CONNECTING);
          websocketAPI.sendClientStarted();
          setLoadingMessage("Waiting on worker...");

          timeoutRef.current = setTimeout(() => {
            setStatus((currentStatus) => {
              if (currentStatus === CONNECTION_STATUS.CONNECTING) {
                handleSignalError(
                  ERROR_CODE.CONNECTION_TIMEOUT,
                  "Connection timed out"
                );
              }
              return currentStatus;
            });
          }, 30000);
        } catch (err) {
          console.error("Failed to connect:", err);
          setStatus(CONNECTION_STATUS.ERROR);
          showAlert({
            type: "error",
            title: "Connection Failed",
            message: "Failed to connect to server. Returning to home page.",
            onCloseRedirect: "/",
          });
          cleanup();
          websocketAPI.close();
        }
      })();
    }
  }

  const sendInput = useCallback((msg: InputMessage) => {
    videoInputWebRTC.sendInput(msg);
  }, []);

  const isLoading = status === CONNECTION_STATUS.CONNECTING;

  return (
    <div className="app-container">
      <Canvas sendInput={sendInput} onCanvasReady={handleCanvasReady} />

      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>{loadingMessage}</p>
        </div>
      )}
    </div>
  );
}
