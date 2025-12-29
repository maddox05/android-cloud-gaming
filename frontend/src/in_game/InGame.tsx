import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  connect,
  type WebRTCConnection,
} from "../utils/video_and_input_webrtc";
import { H264Decoder } from "../utils/decoder";
import { websocketAPI } from "../utils/websocket_api";
import Canvas from "./canvas/Canvas";
import { getGameName } from "./helpers";
import { CONNECTION_STATUS, type ConnectionStatus } from "../types";
import { ERROR_CODE, type ErrorCode } from "../../../shared/types";
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

  const connectionRef = useRef<WebRTCConnection | null>(null);
  const decoderRef = useRef<H264Decoder | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasStartedConnection = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (decoderRef.current) {
      decoderRef.current.reset();
      decoderRef.current = null;
    }
    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }
  }, []);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
    // Initialize decoder if we're already connected
    if (!decoderRef.current) {
      decoderRef.current = new H264Decoder(canvas);
    }
  }, []);

  function handleExit() {
    cleanup();
    navigate("/");
  }

  useEffect(() => {
    if (hasStartedConnection.current) {
      return;
    }
    hasStartedConnection.current = true;
    console.log("Starting InGame connection");

    if (!appId) {
      alert("No game specified. Please select a game from the home page.");
      handleExit();
      return;
    }

    const handleSignalError = (
      code: ErrorCode | undefined,
      message: string
    ) => {
      setStatus(CONNECTION_STATUS.ERROR);
      setStatusMessage(`Error: ${message}`);

      if (code === ERROR_CODE.NO_WORKERS_AVAILABLE) {
        alert("No game servers available. Please try again later.");
        navigate("/");
      } else if (code === ERROR_CODE.WEBRTC_FAILED) {
        alert("WebRTC connection failed. Please try another wifi network.");
        navigate("/");
      } else {
        alert(`An error occurred: ${message}. Returning to home page.`);
        navigate("/");
      }
      websocketAPI.close();
    };

    function handleWebRTCError(code: ErrorCode | undefined, message: string) {
      console.error("Error from WEBRTC:", code, message);
      setStatus(CONNECTION_STATUS.ERROR);
      setStatusMessage(`Error: ${message}`);

      if (code === ERROR_CODE.WEBRTC_FAILED) {
        alert(
          "Client (you) WebRTC connection failed. This is most likely a server issue. please contact support."
        );
        return;
      } else {
        alert(`An error occurred: ${message}. Returning to home page.`);
        navigate("/");
      }
    }

    const handleDisconnected = () => {
      console.log("Disconnected from Worker");
      setStatus(CONNECTION_STATUS.DISCONNECTED);
      setStatusMessage("Connection to worker lost");
      navigate("/");
    };

    const handleVideoData = (data: ArrayBuffer) => {
      if (decoderRef.current) {
        decoderRef.current.appendData(data);
      }
    };

    const startConnection = async () => {
      try {
        if (!websocketAPI.isConnected()) {
          window.alert("You need to wait in the queue!");
          navigate("/");
          return;
        }
        setLoadingMessage("Setting up worker...");
        websocketAPI.onShutdown(handleExit); // TODO MAKE SURE WE UNSUB FROM THESE ON CLEANUP
        const conn = await connect(
          handleVideoData,
          handleWebRTCError,
          handleDisconnected
        );
        connectionRef.current = conn;

        // Initialize decoder if canvas is ready
        if (canvasRef.current && !decoderRef.current) {
          decoderRef.current = new H264Decoder(canvasRef.current);
        }

        // Wait for connection to be fully established
        intervalRef.current = setInterval(() => {
          if (!connectionRef.current) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
          }
          if (websocketAPI.isConnected()) {
            setStatus(CONNECTION_STATUS.CONNECTED);
            websocketAPI.onError(handleSignalError);
            websocketAPI.sendStart(); // Game already set during queue process
            setStatusMessage("Starting...");
            if (intervalRef.current) clearInterval(intervalRef.current);
          }
        }, 100);

        // Timeout after 30 seconds
        timeoutRef.current = setTimeout(() => {
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (connectionRef.current) {
            setStatus((currentStatus) => {
              if (currentStatus === CONNECTION_STATUS.CONNECTING) {
                handleSignalError(
                  ERROR_CODE.CONNECTION_TIMEOUT,
                  "Connection timed out"
                );
              }
              return currentStatus;
            });
          }
        }, 30000);
      } catch (err) {
        console.error("Failed to connect:", err);
        setStatus(CONNECTION_STATUS.ERROR);
        setStatusMessage("Connection failed");
        alert("Failed to connect to server. Returning to home page.");
        navigate("/");
      }
    };

    startConnection();

    return () => {
      cleanup();
    };
  }, [appId, navigate, cleanup, handleExit]);

  const sendInput = useCallback(
    (msg: Parameters<WebRTCConnection["sendInput"]>[0]) => {
      connectionRef.current?.sendInput(msg);
    },
    []
  );

  const gameName = appId ? getGameName(appId) : "Loading...";
  const isLoading = status === CONNECTION_STATUS.CONNECTING;

  return (
    <div className="app-container">
      <div className="app-header">
        <h1>{gameName}</h1>
        <button className="back-btn" onClick={handleExit}>
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
