import { WebSocketServer, WebSocket } from "ws";
import type { SignalMessage } from "../shared/types.js";
import type { Worker, Client } from "./types.js";
import { verifyToken, checkSubscription } from "./auth.js";
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
  sendClientConnectedToWorker,
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

// Verify required environment variables
const requiredEnvVars = ["SIGNAL_PORT", "SUPABASE_URL", "SUPABASE_SERVICE_KEY"];
const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v]);

if (missingEnvVars.length > 0) {
  console.error("Missing required environment variables:", missingEnvVars.join(", "));
  process.exit(1);
}

const PORT = parseInt(process.env.SIGNAL_PORT!, 10);

const PING_INTERVAL = 5000;
const TIMEOUT_THRESHOLD = 15000;

// Track websocket -> worker/client mapping
const wsToWorker = new Map<WebSocket, Worker>();
const wsToClient = new Map<WebSocket, Client>();

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const role = url.searchParams.get("role");
  const token = url.searchParams.get("token");

  if (role === "worker") {
    handleWorkerConnection(ws);
  } else {
    // Buffer messages while authenticating
    const messageQueue: string[] = [];
    const bufferHandler = (data: Buffer) => {
      messageQueue.push(data.toString());
    };
    ws.on("message", bufferHandler);

    // Clients must be authenticated
    if (!token) {
      ws.send(JSON.stringify({ type: "error", message: "Authentication required" }));
      ws.close();
      return;
    }

    // Two-step auth: verify token first, then check subscription
    verifyToken(token).then(async (user) => {
      // Remove buffer handler
      ws.off("message", bufferHandler);

      if (!user) {
        ws.send(JSON.stringify({ type: "error", message: "Invalid or expired token" }));
        ws.close();
        return;
      }

      // Check subscription status
      const hasSubscription = await checkSubscription(user.id, user.email);
      if (!hasSubscription) {
        console.log(`User ${user.id} (${user.email}) rejected - no active subscription`);
        ws.send(JSON.stringify({
          type: "error",
          message: "Active subscription required. Please subscribe to play.",
          code: "NO_SUBSCRIPTION"
        }));
        ws.close();
        return;
      }

      console.log(`Client authenticated: ${user.id}`);
      const client = handleClientConnection(ws, user.id);

      // Process buffered messages
      for (const data of messageQueue) {
        const msg: SignalMessage = JSON.parse(data);
        handleClientMessage(client, msg);
      }
    });
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

    case "worker-crashed":
      // Worker is crashing, notify connected client and clean up
      console.log(`Worker ${worker.id} crashed: ${msg.reason}`);
      if (worker.clientId) {
        const client = getClient(worker.clientId);
        if (client) {
          sendWorkerDisconnectedToClient(client);
          releaseClient(client);
        }
      }
      removeWorker(worker.id);
      break;

    default:
      console.log(`Worker ${worker.id} sent unknown message:`, msg.type);
  }
}

function handleWorkerDisconnect(worker: Worker): void {
  // Check if already removed (e.g., by timeout handler)
  if (!getWorker(worker.id)) {
    return;
  }

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

function handleClientConnection(ws: WebSocket, userId: string): Client {
  const client = createClient(ws, userId);
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

  return client;
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

    case "connected":
      // Client's WebRTC connection is established, notify worker
      if (client.workerId) {
        const worker = getWorker(client.workerId);
        if (worker) {
          sendClientConnectedToWorker(worker);
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
    // Remove client and close connection - don't keep them waiting
    removeClient(client.id);
    client.ws.close();
    return;
  }

  // Pair them
  assignWorkerToClient(worker, client.id);
  assignClientToWorker(client, worker.id);

  // Tell worker to start WebRTC connection
  sendStartToWorker(worker);
}

function handleClientDisconnect(client: Client): void {
  // Check if already removed (e.g., by timeout handler)
  if (!getClient(client.id)) {
    return;
  }

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



function checkTimeouts(): void {
  const now = Date.now();

  // Collect timed out workers and clients first, then process
  // This avoids issues with modifying collections during iteration
  const timedOutWorkers: string[] = [];
  const timedOutClients: string[] = [];

  for (const worker of getAllWorkers()) {
    if (now - worker.lastPing > TIMEOUT_THRESHOLD) {
      timedOutWorkers.push(worker.id);
    }
  }

  for (const client of getAllClients()) {
    if (now - client.lastPing > TIMEOUT_THRESHOLD) {
      timedOutClients.push(client.id);
    }
  }

  // Process timed out workers
  for (const workerId of timedOutWorkers) {
    const worker = getWorker(workerId);
    if (!worker) continue; // Already removed

    console.log(`Worker ${worker.id} timed out`);

    // Disconnect paired client first
    if (worker.clientId) {
      const client = getClient(worker.clientId);
      if (client) {
        // Clear the client's workerId to prevent close handler from double-processing
        client.workerId = null;
        // Remove client from map BEFORE closing to prevent close handler duplicate work
        removeClient(client.id);
        sendShutdownToClient(client, "Worker timed out");
        client.ws.close();
      }
    }

    // Remove worker from map BEFORE closing
    removeWorker(worker.id);
    sendShutdownToWorker(worker, "Timeout");
    worker.ws.close();
  }

  // Process timed out clients
  for (const clientId of timedOutClients) {
    const client = getClient(clientId);
    if (!client) continue; // Already removed (e.g., paired worker timed out first)

    console.log(`Client ${client.id} timed out`);

    // Notify paired worker - it will restart itself
    if (client.workerId) {
      const worker = getWorker(client.workerId);
      if (worker) {
        // Clear worker's clientId to prevent close handler from double-processing
        worker.clientId = null;
        sendClientDisconnectedToWorker(worker);
        removeWorker(worker.id);
      }
    }

    // Remove client from map BEFORE closing
    removeClient(client.id);
    sendShutdownToClient(client, "Timeout");
    client.ws.close();
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
