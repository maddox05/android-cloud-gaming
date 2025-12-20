import { WebSocketServer, WebSocket } from "ws";
import type { SignalMessage } from "../shared/types.js";
import type { Worker, Client } from "./types.js";
import {
  createWorker,
  registerWorker,
  getWorker,
  removeWorker,
  findAvailableWorker,
  assignWorkerToClient,
  updateWorkerPing,
  sendStartToWorker,
  sendAnswerToWorker,
  sendIceCandidateToWorker,
  sendClientDisconnectedToWorker,
  sendPingToWorker,
  sendShutdownToWorker,
  getAllWorkers,
} from "./workers.js";
import {
  createClient,
  getClient,
  removeClient,
  assignClientToWorker,
  releaseClient,
  updateClientPing,
  sendOfferToClient,
  sendIceCandidateToClient,
  sendErrorToClient,
  sendWorkerDisconnectedToClient,
  sendPingToClient,
  sendShutdownToClient,
  getAllClients,
} from "./clients.js";

if (!process.env.SIGNAL_PORT) {
  console.error("SIGNAL_PORT environment variable is required");
  process.exit(1);
}
const PORT = parseInt(process.env.SIGNAL_PORT, 10);

const PING_INTERVAL = 5000;
const TIMEOUT_THRESHOLD = 15000;

// Track websocket -> worker/client mapping
const wsToWorker = new Map<WebSocket, Worker>();
const wsToClient = new Map<WebSocket, Client>();

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const role = url.searchParams.get("role");

  if (role === "worker") {
    handleWorkerConnection(ws);
  } else {
    handleClientConnection(ws);
  }
});

function handleWorkerConnection(ws: WebSocket): void {
  const worker = createWorker(ws);
  wsToWorker.set(ws, worker);

  ws.on("message", (data) => {
    const msg: SignalMessage = JSON.parse(data.toString());
    handleWorkerMessage(worker, msg);
  });

  ws.on("close", () => {
    handleWorkerDisconnect(worker);
    wsToWorker.delete(ws);
  });

  ws.on("error", (err) => {
    console.error(`Worker ${worker.id} error:`, err.message);
  });
}

function handleWorkerMessage(worker: Worker, msg: SignalMessage): void {
  switch (msg.type) {
    case "register":
      registerWorker(worker, msg);
      break;

    case "pong":
      updateWorkerPing(worker);
      break;

    case "offer":
      // Forward offer to connected client
      if (worker.clientId) {
        const client = getClient(worker.clientId);
        if (client) {
          sendOfferToClient(client, msg.sdp);
        }
      }
      break;

    case "ice-candidate":
      // Forward ICE candidate to connected client
      if (worker.clientId) {
        const client = getClient(worker.clientId);
        if (client) {
          sendIceCandidateToClient(client, msg.candidate);
        }
      }
      break;

    default:
      console.log(`Worker ${worker.id} sent unknown message:`, msg.type);
  }
}

function handleWorkerDisconnect(worker: Worker): void {
  console.log(`Worker ${worker.id} disconnected`);

  // Notify connected client
  if (worker.clientId) {
    const client = getClient(worker.clientId);
    if (client) {
      sendWorkerDisconnectedToClient(client);
      releaseClient(client);
    }
  }

  removeWorker(worker.id);
}

function handleClientConnection(ws: WebSocket): void {
  const client = createClient(ws);
  wsToClient.set(ws, client);

  ws.on("message", (data) => {
    const msg: SignalMessage = JSON.parse(data.toString());
    handleClientMessage(client, msg);
  });

  ws.on("close", () => {
    handleClientDisconnect(client);
    wsToClient.delete(ws);
  });

  ws.on("error", (err) => {
    console.error(`Client ${client.id} error:`, err.message);
  });
}

function handleClientMessage(client: Client, msg: SignalMessage): void {
  // Any message from client resets their ping timer
  updateClientPing(client);

  switch (msg.type) {
    case "start":
      handleClientStart(client);
      break;

    case "pong":
      // Already updated ping above
      break;

    case "answer":
      // Forward answer to connected worker
      if (client.workerId) {
        const worker = getWorker(client.workerId);
        if (worker) {
          sendAnswerToWorker(worker, msg.sdp);
        }
      }
      break;

    case "ice-candidate":
      // Forward ICE candidate to connected worker
      if (client.workerId) {
        const worker = getWorker(client.workerId);
        if (worker) {
          sendIceCandidateToWorker(worker, msg.candidate);
        }
      }
      break;

    default:
      // Discard other messages but they still reset timeout
      break;
  }
}

function handleClientStart(client: Client): void {
  // Find first available worker
  const worker = findAvailableWorker();

  if (!worker) {
    sendErrorToClient(client, "No workers available");
    return;
  }

  // Pair them
  assignWorkerToClient(worker, client.id);
  assignClientToWorker(client, worker.id);

  // Tell worker to start WebRTC connection
  sendStartToWorker(worker);
}

function handleClientDisconnect(client: Client): void {
  console.log(`Client ${client.id} disconnected`);

  // Notify connected worker - worker will restart itself
  // Remove worker from pool since it needs to restart
  if (client.workerId) {
    const worker = getWorker(client.workerId);
    if (worker) {
      sendClientDisconnectedToWorker(worker);
      removeWorker(worker.id);
    }
  }

  removeClient(client.id);
}

function disconnectWorker(worker: Worker, reason: string): void {
  sendShutdownToWorker(worker, reason);
  worker.ws.close();
}

function disconnectClient(client: Client, reason: string): void {
  sendShutdownToClient(client, reason);
  client.ws.close();
}

function checkTimeouts(): void {
  const now = Date.now();

  // Check workers
  for (const worker of getAllWorkers()) {
    if (now - worker.lastPing > TIMEOUT_THRESHOLD) {
      console.log(`Worker ${worker.id} timed out`);

      // Disconnect paired client first
      if (worker.clientId) {
        const client = getClient(worker.clientId);
        if (client) {
          disconnectClient(client, "Worker timed out");
        }
      }

      disconnectWorker(worker, "Timeout");
    }
  }

  // Check clients
  for (const client of getAllClients()) {
    if (now - client.lastPing > TIMEOUT_THRESHOLD) {
      console.log(`Client ${client.id} timed out`);

      // Notify paired worker - it will restart itself
      // Remove worker from pool since it needs to restart
      if (client.workerId) {
        const worker = getWorker(client.workerId);
        if (worker) {
          sendClientDisconnectedToWorker(worker);
          removeWorker(worker.id);
        }
      }

      disconnectClient(client, "Timeout");
    }
  }
}

function sendPings(): void {
  for (const worker of getAllWorkers()) {
    sendPingToWorker(worker);
  }
  for (const client of getAllClients()) {
    sendPingToClient(client);
  }
}

// Heartbeat loop
setInterval(() => {
  sendPings();
  checkTimeouts();
}, PING_INTERVAL);

console.log(`Signal server running on ws://localhost:${PORT}`);
console.log(`Ping interval: ${PING_INTERVAL}ms, Timeout: ${TIMEOUT_THRESHOLD}ms`);
