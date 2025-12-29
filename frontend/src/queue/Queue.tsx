import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { websocketAPI, type QueueInfo } from "../utils/websocket_api";
import { getGameName } from "../in_game/helpers";
import { ERROR_CODE, type ErrorCode } from "../../../shared/types";
import "./Queue.css";

// Estimated seconds per player ahead in queue
const ESTIMATED_SECONDS_PER_PLAYER = 60;

export default function Queue() {
  const navigate = useNavigate();
  const { appId } = useParams<{ appId: string }>();

  const [position, setPosition] = useState<number | null>(null);
  const [timeInQueue, setTimeInQueue] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);

  const queueStartTime = useRef<number | null>(null);

  const handleExit = useCallback(() => {
    websocketAPI.close();
    navigate("/");
  }, [navigate]);

  // Close websocket on page unload (refresh, close tab)
  // Note: Don't close on unmount - we need the connection when navigating to InGame
  useEffect(() => {
    const handleBeforeUnload = () => {
      websocketAPI.close();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Timer to update timeInQueue every second
  useEffect(() => {
    if (isConnecting || error || position === null) return;

    const interval = setInterval(() => {
      if (queueStartTime.current) {
        const elapsed = Math.floor(
          (Date.now() - queueStartTime.current) / 1000
        );
        setTimeInQueue(elapsed);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnecting, error, position]);

  useEffect(() => {
    if (!appId) {
      setError("No game specified");
      return;
    }

    const handleError = (code: ErrorCode | undefined, message: string) => {
      console.error("Queue error:", message);
      if (code === ERROR_CODE.NO_SUBSCRIPTION) {
        window.alert(`Subscription error: ${message}`);
        navigate("/");
      } else if (code === ERROR_CODE.AUTH_FAILED) {
        window.alert(`Failed to authenticate: ${message}`);
        navigate("/");
      }
      setError(message);
    };

    const handleShutdown = () => {
      console.log("Disconnected from server");
      setError("Connection lost");
    };

    const handleQueueInfo = (info: QueueInfo) => {
      console.log("Received queue info:", info);

      // Set start time on first queue info received
      if (queueStartTime.current === null) {
        queueStartTime.current = Date.now();
      }

      setPosition(info.position);
      setIsConnecting(false);
    };

    const handleQueueReady = () => {
      console.log("Queue ready - navigating to game");
      navigate(`/app/${appId}`);
    };

    // Register callbacks synchronously BEFORE any async work
    const unsubError = websocketAPI.onError(handleError);
    const unsubShutdown = websocketAPI.onShutdown(handleShutdown);
    const unsubQueueInfo = websocketAPI.onQueueInfo(handleQueueInfo);
    const unsubQueueReady = websocketAPI.onQueueReady(handleQueueReady);

    const startQueue = async () => {
      try {
        console.log("Connecting to signal server...");
        await websocketAPI.connect();
        console.log("Connected, sending QUEUE for appId:", appId);
        websocketAPI.sendQueue(appId);
      } catch (err) {
        console.error("Failed to connect:", err);
        setError("Failed to connect to server");
        setIsConnecting(false);
      }
    };

    startQueue();

    return () => {
      // Cleanup subscriptions
      unsubError();
      unsubShutdown();
      unsubQueueInfo();
      unsubQueueReady();
    };
  }, [appId, navigate]);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Calculate estimated wait based on position
  const estimatedWaitSeconds =
    position !== null
      ? Math.max(0, position * ESTIMATED_SECONDS_PER_PLAYER)
      : 0;

  const gameName = appId ? getGameName(appId) : "Loading...";

  return (
    <div className="queue-container">
      <div className="queue-card">
        <h1 className="queue-title">Waiting in Queue</h1>
        <p className="queue-game">{gameName}</p>

        {isConnecting && (
          <div className="queue-loading">
            <div className="spinner"></div>
            <p>Connecting to server...</p>
          </div>
        )}

        {error && (
          <div className="queue-error">
            <p>{error}</p>
            <button className="queue-btn" onClick={handleExit}>
              Return Home
            </button>
          </div>
        )}

        {!isConnecting && !error && position !== null && (
          <div className="queue-info">
            <div className="queue-stat">
              <span className="queue-stat-label">Position</span>
              <span className="queue-stat-value">{position}</span>
            </div>

            <div className="queue-stat">
              <span className="queue-stat-label">Estimated Wait</span>
              <span className="queue-stat-value">
                {estimatedWaitSeconds === 0
                  ? "Any moment..."
                  : `~${formatTime(estimatedWaitSeconds)}`}
              </span>
            </div>

            <div className="queue-stat">
              <span className="queue-stat-label">Time in Queue</span>
              <span className="queue-stat-value">
                {formatTime(timeInQueue)}
              </span>
            </div>

            <div className="queue-progress">
              <div className="spinner"></div>
              <p>Waiting for available server...</p>
            </div>
          </div>
        )}

        <button className="queue-btn queue-btn-secondary" onClick={handleExit}>
          Leave Queue
        </button>
      </div>
    </div>
  );
}
