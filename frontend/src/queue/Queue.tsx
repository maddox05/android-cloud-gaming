import { useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { websocketAPI, type QueueInfo } from "../utils/websocket_api";
import { getGameName } from "../in_game/helpers";
import { ERROR_CODE, type ErrorCode } from "../../../shared/types";
import "./Queue.css";

const ESTIMATED_SECONDS_PER_PLAYER = 60;

export default function Queue() {
  const navigate = useNavigate();
  const { appId } = useParams<{ appId: string }>();

  const [position, setPosition] = useState<number | null>(null);
  const [timeInQueue, setTimeInQueue] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);

  const initialized = useRef(false);
  const queueStartTime = useRef<number | null>(null);
  const timerInterval = useRef<number | null>(null);

  function handleExit() {
    if (timerInterval.current) clearInterval(timerInterval.current);
    websocketAPI.close();
    window.location.href = "/";
  }

  if (!initialized.current) {
    initialized.current = true;

    if (!appId) {
      setError("No game specified");
    } else {
      const handleError = (code: ErrorCode | undefined, message: string) => {
        console.error("Queue error:", message);
        if (code === ERROR_CODE.NO_SUBSCRIPTION) {
          window.alert(`Subscription error: ${message}`);
          handleExit();
          return;
        } else if (code === ERROR_CODE.AUTH_FAILED) {
          window.alert(`Failed to authenticate: ${message}`);
          handleExit();
          return;
        }
        setError(message);
      };

      const handleShutdown = () => {
        console.log("Disconnected from server");
        setError("Connection lost");
      };

      const handleQueueInfo = (info: QueueInfo) => {
        console.log("Received queue info:", info);
        if (queueStartTime.current === null) {
          queueStartTime.current = Date.now();
          timerInterval.current = setInterval(() => {
            if (queueStartTime.current) {
              const elapsed = Math.floor(
                (Date.now() - queueStartTime.current) / 1000
              );
              setTimeInQueue(elapsed);
            }
          }, 1000);
        }
        setPosition(info.position);
        setIsConnecting(false);
      };

      const handleQueueReady = () => {
        console.log("Queue ready - navigating to game");
        if (timerInterval.current) clearInterval(timerInterval.current);
        navigate(`/app/${appId}`);
      };

      websocketAPI.onError(handleError);
      websocketAPI.onShutdown(handleShutdown);
      websocketAPI.onQueueInfo(handleQueueInfo);
      websocketAPI.onQueueReady(handleQueueReady);

      (async () => {
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
      })();
    }
  }

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

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
