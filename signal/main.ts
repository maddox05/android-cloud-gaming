import express from "express";
import expressWs from "express-ws";
import Client from "./Client.js";
import Worker from "./Worker.js";
import { getAllClients, getAllWorkers } from "./registry.js";
import { processQueue, checkQueueTimeouts } from "./queue.js";
import { verifyToken, checkSubscription } from "./auth.js";
import { ERROR_CODE, MSG } from "../shared/types.js";
import {
  SERVER_PORT as PORT,
  PING_INTERVAL,
  PING_TIMEOUT_THRESHOLD,
  QUEUE_PROCESS_INTERVAL,
} from "./consts.js";

// ============================================
// Environment Validation
// ============================================

const requiredEnvVars = ["SIGNAL_PORT", "SUPABASE_URL", "SUPABASE_SERVICE_KEY"];
const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v]);

if (missingEnvVars.length > 0) {
  console.error("Missing required environment variables:", missingEnvVars.join(", "));
  process.exit(1);
}

// ============================================
// Express + WebSocket Setup
// ============================================

const { app } = expressWs(express());

// Health check endpoint
app.get("/health", (_req, res) => {
  res.send("OK");
});

// WebSocket endpoint
app.ws("/", (ws, req) => {
  const role = req.query.role as string | undefined;
  const token = req.query.token as string | undefined;

  if (!role) {
    console.log("Connection rejected: no role specified");
    ws.close();
    return;
  }

  if (role === "worker") {
    // Workers don't need auth - class handles everything
    new Worker(ws);

  } else if (role === "client") {
    // Clients must authenticate
    if (!token) {
      ws.send(JSON.stringify({
        type: MSG.ERROR,
        code: ERROR_CODE.AUTH_FAILED,
        message: "Authentication required"
      }));
      ws.close();
      return;
    }

    // Async auth flow
    verifyToken(token).then(async (user) => {
      if (!user) {
        ws.send(JSON.stringify({
          type: MSG.ERROR,
          code: ERROR_CODE.AUTH_FAILED,
          message: "Invalid or expired token"
        }));
        ws.close();
        return;
      }

      const hasSubscription = await checkSubscription(user.id, user.email);
      if (!hasSubscription) {
        console.log(`User ${user.id} (${user.email}) rejected - no active subscription`);
        ws.send(JSON.stringify({
          type: MSG.ERROR,
          code: ERROR_CODE.NO_SUBSCRIPTION,
          message: "Active subscription required. Please subscribe to play.",
        }));
        ws.close();
        return;
      }

      console.log(`Client authenticated: ${user.id}`);

      // Create client (class sets up handlers) and send authenticated message
      const client = new Client(ws, user.id);
      client.sendAuthenticated();
    });

  } else {
    console.log(`Connection rejected: invalid role '${role}'`);
    ws.close();
  }
});

// ============================================
// Heartbeat Interval
// ============================================

setInterval(() => {
  const now = Date.now();

  // Send pings to all workers and clients
  for (const worker of getAllWorkers()) {
    worker.sendPing();
  }
  for (const client of getAllClients()) {
    client.sendPing();
  }

  // Check ping timeouts for workers
  for (const worker of getAllWorkers()) {
    if (worker.checkPingTimeout(now, PING_TIMEOUT_THRESHOLD)) {
      console.log(`Worker ${worker.id} timed out (ping)`);
      worker.disconnect("ping_timeout");
    }
  }

  // Check ping timeouts for clients
  for (const client of getAllClients()) {
    if (client.checkPingTimeout(now, PING_TIMEOUT_THRESHOLD)) {
      console.log(`Client ${client.id} timed out (ping)`);
      client.disconnect("ping_timeout");
    }
  }

  // Check input timeouts (AFK) for connected clients
  for (const client of getAllClients()) {
    if (client.checkInputTimeout(now)) {
      console.log(`Client ${client.id} timed out (input/AFK)`);
      client.sendError(ERROR_CODE.SESSION_TIMEOUT, "Session ended due to inactivity.");
      client.disconnect("input_timeout");
    }
  }

  // Check connecting timeouts (got QUEUE_READY but never sent START)
  for (const client of getAllClients()) {
    if (client.checkConnectingTimeout(now)) {
      console.log(`Client ${client.id} timed out (connecting)`);
      client.sendError(ERROR_CODE.CONNECTION_TIMEOUT, "Connection timeout - please try again.");
      client.disconnect("connecting_timeout");
    }
  }
}, PING_INTERVAL);

// ============================================
// Queue Processing Interval
// ============================================

setInterval(() => {
  processQueue().catch((err) => console.error("Queue processing error:", err));
  checkQueueTimeouts();
}, QUEUE_PROCESS_INTERVAL);

// ============================================
// Start Server
// ============================================

app.listen(PORT, () => {
  console.log(`Signal server running on http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/`);
  console.log(`Ping interval: ${PING_INTERVAL}ms, Timeout: ${PING_TIMEOUT_THRESHOLD}ms`);
  console.log(`Queue process interval: ${QUEUE_PROCESS_INTERVAL}ms`);
});
