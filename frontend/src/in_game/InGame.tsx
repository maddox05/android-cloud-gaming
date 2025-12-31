import { useState, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { videoInputWebRTC } from "../utils/video_and_input_webrtc";
import { H264Decoder } from "../utils/decoder";
import { websocketAPI } from "../utils/websocket_api";
import Canvas from "./canvas/Canvas";
import { getGameName } from "./helpers";
import { CONNECTION_STATUS, type ConnectionStatus } from "../types";
import {
  ERROR_CODE,
  type ErrorCode,
  type InputMessage,
} from "../../../shared/types";
import "./InGame.css";

export default function InGame() {
  const navigate = useNavigate();
  const { appId } = useParams<{ appId: string }>();

  const [status, setStatus] = useState<ConnectionStatus>(
    CONNECTION_STATUS.CONNECTING
  );
  const [statusMessage, setStatusMessage] = useState("Connecting...");
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
      decoderRef.current = new H264Decoder(canvas);
    }
  }, []);

  function handleExit(reason?: string) {
    if (reason) {
      window.alert(`Exiting game: ${reason}`);
    }
    cleanup();
    websocketAPI.close();
    window.location.href = "/";
  }

  if (!initialized.current) {
    initialized.current = true;
    console.log("Starting InGame connection");

    if (!appId) {
      alert("No game specified. Please select a game from the home page.");
      setTimeout(() => navigate("/"), 0);
    } else {
      const handleSignalError = (
        code: ErrorCode | undefined,
        message: string
      ) => {
        setStatus(CONNECTION_STATUS.ERROR);
        setStatusMessage(`Error: ${message}`);

        if (code === ERROR_CODE.NO_WORKERS_AVAILABLE) {
          alert("No game servers available. Please try again later.");
        } else if (code === ERROR_CODE.WEBRTC_FAILED) {
          alert("WebRTC connection failed. Please try another wifi network.");
        } else if (code === ERROR_CODE.CONNECTION_TIMEOUT) {
          alert("AFK? Not on my watch. Connection timed out.");
        } else {
          alert(`An error occurred: ${message}. Returning to home page.`);
        }
        handleExit();
      };

      function handleWebRTCError(code: ErrorCode | undefined, message: string) {
        console.error("Error from WEBRTC:", code, message);
        setStatus(CONNECTION_STATUS.ERROR);
        setStatusMessage(`Error: ${message}`);

        if (code === ERROR_CODE.WEBRTC_FAILED) {
          alert(
            "Client (you) WebRTC connection failed. This is most likely a server issue. please contact support."
          );
        } else {
          alert(`An error occurred: ${message}. Returning to home page.`);
        }
        handleExit();
      }

      const handleDisconnected = () => {
        console.log("Disconnected from Worker");
        setStatus(CONNECTION_STATUS.DISCONNECTED);
        setStatusMessage("Connection to worker lost");
        // no need to exit as if disconnected happens, signal server will follow up and exit us.
      };

      const handleVideoData = (data: ArrayBuffer) => {
        setStatus(CONNECTION_STATUS.CONNECTED);
        setStatusMessage("Connected");
        if (decoderRef.current) {
          decoderRef.current.appendData(data);
        }
      };

      websocketAPI.onShutdown(handleExit);
      websocketAPI.onError(handleSignalError);

      (async () => {
        try {
          if (!websocketAPI.isConnected()) {
            window.alert("You need to wait in the queue!");
            window.location.href = "/";
            return;
          }
          setLoadingMessage("Setting up worker...");

          // Subscribe to callbacks before connecting
          videoInputWebRTC.onVideo(handleVideoData);
          videoInputWebRTC.onError(handleWebRTCError);
          videoInputWebRTC.onDisconnected(handleDisconnected);

          await videoInputWebRTC.connect();

          if (canvasRef.current && !decoderRef.current) {
            decoderRef.current = new H264Decoder(canvasRef.current);
          }

          setStatus(CONNECTION_STATUS.CONNECTING);
          websocketAPI.sendStart();
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
          setStatusMessage("Connection failed");
          alert("Failed to connect to server. Returning to home page.");
          handleExit();
        }
      })();
    }
  }

  const sendInput = useCallback((msg: InputMessage) => {
    videoInputWebRTC.sendInput(msg);
  }, []);

  const gameName = appId ? getGameName(appId) : "Loading...";
  const isLoading = status === CONNECTION_STATUS.CONNECTING;

  return (
    <div className="app-container">
      <div className="app-header">
        <h1>{gameName}</h1>
        <button className="back-btn" onClick={() => handleExit()}>
          Exit
        </button>
      </div>

      <div className={`status-bar ${status}`}>{statusMessage}</div>

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
