import express from "express";
import expressWs from "express-ws";
import type { WebSocket } from "ws";
import { ERROR_CODE, MSG, type SignalMessage, type QueueMessage, type QueueInfoMessage, type QueueReadyMessage } from "../shared/types.js";
import type { Worker, Client } from "./types.js";
import { verifyToken, checkSubscription } from "./auth.js";
import {
  createWorker,
  registerWorker,
  getWorker,
  removeWorker,
  findAvailableWorkerWithGame,
  assignWorkerToClient,
  updateWorkerPing,
  sendStartToWorker,
  sendAnswerToWorker,
  sendIceCandidateToWorker,
  sendClientDisconnectedToWorker,
  sendPingToWorker,
  sendShutdownToWorker,
  getAllWorkers,
  sendClientGameToWorker,
} from "./workers.js";
import {
  createClient,
  getClient,
  removeClient,
  assignClientToWorker,
  updateClientPing,
  sendOfferToClient,
  sendIceCandidateToClient,
  sendErrorToClient,
  sendWorkerDisconnectedToClient,
  sendPingToClient,
  sendShutdownToClient,
  getAllClients,
  updateClientInput,
  sendToClient,
} from "./clients.js";
import {
  addToQueue,
  removeFromQueue,
  getQueuedClients,
  getQueuePosition,
  getAllQueuedClientIds,
} from "./queue.js";
import {
  SERVER_PORT as PORT,
  INPUT_TIMEOUT_THRESHOLD,
  PING_INTERVAL,
  PING_TIMEOUT_THRESHOLD,
  QUEUE_PROCESS_INTERVAL,
  QUEUE_TIMEOUT_THRESHOLD,
  CONNECTING_TIMEOUT_THRESHOLD,
} from "./consts.js";

// Verify required environment variables
const requiredEnvVars = ["SIGNAL_PORT", "SUPABASE_URL", "SUPABASE_SERVICE_KEY"];
const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v]);

if (missingEnvVars.length > 0) {
  console.error("Missing required environment variables:", missingEnvVars.join(", "));
  process.exit(1);
}



// Track websocket -> worker/client mapping
const wsToWorker = new Map<WebSocket, Worker>();
const wsToClient = new Map<WebSocket, Client>();

// Create Express app with WebSocket support
const { app } = expressWs(express());


// WebSocket endpoint
app.ws("/", (ws, req) => {
  const role = req.query.role as string | undefined;
  const token = req.query.token as string | undefined;

  if(!role){
    console.log("NO ROLE?")
    return;
  }

  else if (role === "worker") {
    handleWorkerConnection(ws);
  } else if (role==="client") {
    // Clients must be authenticated
    if (!token) {
      ws.send(JSON.stringify({ type: "error", message: "Authentication required" }));
      ws.close();
      return;
    }

    // Two-step auth: verify token first, then check subscription
    verifyToken(token).then(async (user) => {
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
          code: ERROR_CODE.NO_SUBSCRIPTION,
        }));
        ws.close();
        return;
      }

      console.log(`Client authenticated: ${user.id}`);
      handleClientConnection(ws, user.id);

      // Send authenticated message - client waits for this before sending messages (see websocket_api.ts)
      ws.send(JSON.stringify({ type: MSG.AUTHENTICATED }));
    });
  }else{
    console.log("incorrect role. skipping");
    return;
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

// Health check endpoint
app.get("/health", (_req, res) => {
  res.send("OK");
});

function handleWorkerMessage(worker: Worker, msg: SignalMessage): void {
  switch (msg.type) {
    case MSG.REGISTER:
      registerWorker(worker, msg);
      break;

    case MSG.PONG:
      updateWorkerPing(worker);
      break;

    case MSG.OFFER:
      // Forward offer to connected client
      if (worker.clientId) {
        const client = getClient(worker.clientId);
        if (client) {
          sendOfferToClient(client, msg.sdp);
        }
      }
      break;

    case MSG.ICE_CANDIDATE:
      // Forward ICE candidate to connected client
      if (worker.clientId) {
        const client = getClient(worker.clientId);
        if (client) {
          sendIceCandidateToClient(client, msg.candidate);
        }
      }
      break;

    case MSG.WORKER_CRASHED:
      // Worker is crashing, notify connected client and clean up
      console.log(`Worker ${worker.id} crashed: ${msg.reason}`);
      if (worker.clientId) {
        const client = getClient(worker.clientId);
        if (client) {
          sendWorkerDisconnectedToClient(client);
          removeClient(client.id);
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
      removeClient(client.id)
    }
  }

  // Remove worker from map BEFORE closing
    removeWorker(worker.id);
    sendShutdownToWorker(worker, "Timeout");
    worker.ws.close();
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
    case MSG.CLIENT_INPUTED:
      updateClientInput(client)
      break;

    case MSG.QUEUE:
      handleClientQueue(client, msg as QueueMessage);
      break;

    case MSG.START:
      handleClientWorkerStart(client);
      break;

    case MSG.PONG:
      // Already updated ping above
      break;

    case MSG.ANSWER:
      // Forward answer to connected worker
      if (client.workerId) {
        const worker = getWorker(client.workerId);
        if (worker) {
          sendAnswerToWorker(worker, msg.sdp);
        }
      }
      break;

    case MSG.ICE_CANDIDATE:
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

// Handle client joining the queue
function handleClientQueue(client: Client, msg: QueueMessage): void {
  const { appId } = msg;

  if (!appId) {
    sendErrorToClient(client, "No game specified in queue request");
    return;
  }

  // If client already has a worker assigned, clean up first
  if (client.workerId) {
    const oldWorker = getWorker(client.workerId);
    if (oldWorker) {
      sendClientDisconnectedToWorker(oldWorker);
      removeWorker(oldWorker.id);
    }
    client.workerId = null;
  }

  // If client is already in queue, just update game and send info
  if (client.connectionState === "queued") {
    client.game = appId;
    sendQueueInfoToClient(client);
    return;
  }

  // Set client game and queue state
  client.game = appId;
  client.connectionState = "queued";
  client.queuedAt = Date.now();

  // Add to queue
  addToQueue(client.id);

  // Send initial queue info
  sendQueueInfoToClient(client);

  console.log(`Client ${client.id} queued for game: ${appId}`);
}

// Send queue info message to client
function sendQueueInfoToClient(client: Client): void {
  const position = getQueuePosition(client.id);
  const msg: QueueInfoMessage = {
    type: MSG.QUEUE_INFO,
    position,
  };
  console.log(`Sending QUEUE_INFO to client ${client.id}: position ${position}`);
  sendToClient(client, msg);
}

// Send queue ready message to client
function sendQueueReadyToClient(client: Client): void {
  const msg: QueueReadyMessage = { type: MSG.QUEUE_READY };
  sendToClient(client, msg);
}

// Called by FUNCA when matching a client to a worker
function handleClientWorkerAssign(client: Client, worker: Worker): void {
  // Remove from queue
  removeFromQueue(client.id);

  // Pair them
  assignWorkerToClient(worker, client.id);
  assignClientToWorker(client, worker.id);

  // Track when assignment happened (for connecting timeout)
  client.assignedAt = Date.now();

  console.log(`Assigned worker ${worker.id} to client ${client.id} for game ${client.game}`);

  // Tell client they're ready to proceed
  sendQueueReadyToClient(client);
}

// Called when client sends START (after receiving QUEUE_READY and navigating to /app)
function handleClientWorkerStart(client: Client): void {
  // Prevent double START
  if (client.connectionState === "connected") {
    console.log(`Client ${client.id} already started, ignoring duplicate START`);
    return;
  }

  // Client should already have a worker assigned from queue process
  if (!client.workerId) {
    sendErrorToClient(client, "No worker assigned. Please rejoin the queue.");
    removeClient(client.id);
    client.ws.close();
    return;
  }

  const worker = getWorker(client.workerId);

  if (!worker) {
    // Worker died between QUEUE_READY and START
    sendErrorToClient(client, "Assigned worker is no longer available. Please rejoin the queue.");
    removeClient(client.id);
    client.ws.close();
    return;
  }

  if (!client.game) {
    sendErrorToClient(client, "No game selected. Please rejoin the queue.");
    removeClient(client.id);
    client.ws.close();
    return;
  }

  // Mark as connected and tell worker to start WebRTC
  client.connectionState = "connected";
  sendStartToWorker(worker);
  sendClientGameToWorker(worker, client.game);

  console.log(`Client ${client.id} started connection with worker ${worker.id}`);
}

function handleClientDisconnect(client: Client): void {
  // Check if already removed (e.g., by timeout handler)
  if (!getClient(client.id)) {
    return;
  }

  console.log(`Client ${client.id} disconnected`);

  // Remove from queue if queued
  if (client.connectionState === "queued") {
    removeFromQueue(client.id);
  }

  // Notify connected worker - worker will restart itself
  // Remove worker from pool since it needs to restart
  if (client.workerId) {
    const worker = getWorker(client.workerId);
    if (worker) {
      sendClientDisconnectedToWorker(worker);
      removeWorker(worker.id)
    }
  }

  removeClient(client.id);
  sendShutdownToClient(client, "Timeout");
  client.ws.close();
}



function checkPingPongTimeouts(): void {
  const now = Date.now();

  // Collect timed out workers and clients first, then process
  // This avoids issues with modifying collections during iteration
  const timedOutWorkers: string[] = [];
  const timedOutClients: string[] = [];

  for (const worker of getAllWorkers()) {
    if (now - worker.lastPing > PING_TIMEOUT_THRESHOLD) {
      timedOutWorkers.push(worker.id);
    }
  }

  for (const client of getAllClients()) {
    if (now - client.lastPing > PING_TIMEOUT_THRESHOLD) {
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

    handleClientDisconnect(client)
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

function checkClientTimedOutViaInput(): void {
  const now = Date.now();

  for (const client of getAllClients()) {
    // Only check input timeout for connected clients (not queued/waiting)
    if (client.connectionState === "connected" && now - client.lastInput > INPUT_TIMEOUT_THRESHOLD) {
      handleClientDisconnect(client);
    }
  }
}

// Heartbeat loop
setInterval(() => {
  sendPings();
  checkPingPongTimeouts();
  checkClientTimedOutViaInput()
}, PING_INTERVAL);

// FUNCA - Process queue and match clients to workers
function processQueue(): void {
  const queuedClientIds = getAllQueuedClientIds();

  for (const clientId of queuedClientIds) {
    const client = getClient(clientId);
    if (!client || !client.game) continue;

    // Find available worker for this client's game
    const worker = findAvailableWorkerWithGame(client.game);

    if (worker) {
      // Match found - assign worker to client
      handleClientWorkerAssign(client, worker);
    }
  }

  // Send queue info updates to all remaining queued clients
  for (const client of getQueuedClients()) {
    sendQueueInfoToClient(client);
  }
}

// Check for clients who have been in queue too long
function checkQueueTimeouts(): void {
  const now = Date.now();

  for (const client of getQueuedClients()) {
    if (client.queuedAt && now - client.queuedAt > QUEUE_TIMEOUT_THRESHOLD) {
      console.log(`Client ${client.id} timed out in queue`);
      sendErrorToClient(client, "Queue timeout - you've been waiting too long. Please try again.");
      removeFromQueue(client.id);
      removeClient(client.id);
      client.ws.close();
    }
  }
}

// Check for clients stuck in "connecting" state (got QUEUE_READY but never sent START)
function checkConnectingTimeouts(): void {
  const now = Date.now();

  for (const client of getAllClients()) {
    if (client.connectionState === "connecting" && client.assignedAt) {
      if (now - client.assignedAt > CONNECTING_TIMEOUT_THRESHOLD) {
        console.log(`Client ${client.id} timed out in connecting state`);
        sendErrorToClient(client, "Connection timeout - please try again.");
        handleClientDisconnect(client);
      }
    }
  }
}

// Queue processing loop (FUNCA)
setInterval(() => {
  processQueue();
  checkQueueTimeouts();
  checkConnectingTimeouts();
}, QUEUE_PROCESS_INTERVAL);

// Start server
app.listen(PORT, () => {
  console.log(`Signal server running on http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/`);
  console.log(`Ping interval: ${PING_INTERVAL}ms, Timeout: ${PING_TIMEOUT_THRESHOLD}ms`);
  console.log(`Queue process interval: ${QUEUE_PROCESS_INTERVAL}ms, Queue timeout: ${QUEUE_TIMEOUT_THRESHOLD}ms`);
});
