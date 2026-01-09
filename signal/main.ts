import express from "express";
import expressWs from "express-ws";
import Client from "./Client.js";
import Worker from "./Worker.js";
import { getAllClients, getAllWorkers, getWorkerCount } from "./registry.js";
import { processQueue, checkQueueTimeouts } from "./queue.js";
import { verifyToken, checkSubscription } from "./auth.js";
import { checkAccess, redeemInvite } from "./invite_access.js";
import { joinWaitlist, generateInvites, removeFromWaitlist, adjustWaitlistPosition } from "./waitlist_endpoints.js";
import { ERROR_CODE, MSG } from "../shared/types.js";
import {
  SERVER_PORT as PORT,
  CHECK_LOOP_INTERVAL,
  PING_TIMEOUT_THRESHOLD,
  QUEUE_PROCESS_INTERVAL,
} from "./consts.js";

// ============================================
// Environment Validation
// ============================================

const requiredEnvVars = ["SIGNAL_PORT", "SUPABASE_URL", "SUPABASE_SERVICE_KEY"];
const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v]);

if (missingEnvVars.length > 0) {
  console.error(
    "Missing required environment variables:",
    missingEnvVars.join(", ")
  );
  process.exit(1);
}

// ============================================
// Express + WebSocket Setup
// ============================================

const { app } = expressWs(express());

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://maddoxcloud.com",
  "https://www.maddoxcloud.com",
];

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  next();
});

// Health check
app.get("/health", (_req, res) => res.send("OK"));

// ============================================
// API Endpoints
// ============================================

/*
 * check-access endpoint:
 * Returns whether the user has access via subscription or redeemed invite code
 */
app.get("/api/check-access", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      hasAccess: false,
      reason: "missing_token",
      message: "Authorization header required",
    });
    return;
  }

  const token = authHeader.substring(7);
  const result = await checkAccess(token);
  res.status(result.status).json(result.body);
});

/*
 * redeem-invite endpoint:
 * Redeems an invite code for the authenticated user
 */
app.post("/api/redeem-invite", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      error: "Authorization header required",
    });
    return;
  }

  const { invite_code } = req.body;
  if (!invite_code) {
    res.status(400).json({
      success: false,
      error: "invite_code is required",
    });
    return;
  }

  const token = authHeader.substring(7);
  const result = await redeemInvite(token, invite_code);
  res.status(result.status).json(result.body);
});

/*
 * join-waitlist endpoint:
 * Joins the waitlist with an optional referral code
 */
app.post("/api/join-waitlist", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      error: "Authorization header required",
    });
    return;
  }

  const token = authHeader.substring(7);
  const { referral_code } = req.body;
  const result = await joinWaitlist(token, referral_code);
  res.status(result.status).json(result.body);
});

/*
 * admin/generate-invites endpoint:
 * Takes the first N users off the waitlist and generates invite codes for them
 */
app.post("/api/admin/generate-invites", async (req, res) => {
  const { count } = req.body;

  if (!count || typeof count !== "number" || count < 1) {
    res.status(400).json({
      success: false,
      error: "count must be a positive number",
    });
    return;
  }

  const result = await generateInvites(count);
  res.status(result.status).json(result.body);
});

/*
 * admin/remove-from-waitlist endpoint:
 * Removes a user from the waitlist
 */
app.post("/api/admin/remove-from-waitlist", async (req, res) => {
  const { user_id } = req.body;

  if (!user_id || typeof user_id !== "string") {
    res.status(400).json({
      success: false,
      error: "user_id is required",
    });
    return;
  }

  const result = await removeFromWaitlist(user_id);
  res.status(result.status).json(result.body);
});

/*
 * admin/adjust-position endpoint:
 * Adjusts a user's position in the waitlist by modifying their time_joined
 */
app.post("/api/admin/adjust-position", async (req, res) => {
  const { user_id, hours } = req.body;

  if (!user_id || typeof user_id !== "string") {
    res.status(400).json({
      success: false,
      error: "user_id is required",
    });
    return;
  }

  if (typeof hours !== "number") {
    res.status(400).json({
      success: false,
      error: "hours must be a number (positive moves up, negative moves down)",
    });
    return;
  }

  const result = await adjustWaitlistPosition(user_id, hours);
  res.status(result.status).json(result.body);
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
    if (getWorkerCount() === 0) {
      console.log("No workers available - rejecting client connection");
      ws.close(); // todo have frontend handle this situation better.
      return;
    }

    // Clients must authenticate
    if (!token) {
      ws.send(
        JSON.stringify({
          type: MSG.ERROR,
          code: ERROR_CODE.AUTH_FAILED,
          message: "Authentication required",
        })
      );
      ws.close();
      return;
    }

    // Async auth flow
    verifyToken(token).then(async (user) => {
      if (!user) {
        ws.send(
          JSON.stringify({
            type: MSG.ERROR,
            code: ERROR_CODE.AUTH_FAILED,
            message: "Invalid or expired token",
          })
        );
        ws.close();
        return;
      }

      const hasSubscription = await checkSubscription(user.id, user.email);
      if (!hasSubscription) {
        console.log(
          `User ${user.id} (${user.email}) rejected - no active subscription`
        );
        ws.send(
          JSON.stringify({
            type: MSG.ERROR,
            code: ERROR_CODE.NO_SUBSCRIPTION,
            message:
              "Active subscription required. Please subscribe to play. If you believe this is an error, contact support, we will help ASAP!",
          })
        );
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
    if (worker.checkPingTimeout(now, PING_TIMEOUT_THRESHOLD)) {
      console.log(`Worker ${worker.id} timed out (ping)`);
      worker.disconnect("ping_timeout");
    }
  }

  // Check connecting timeouts (got QUEUE_READY but never sent START)
  for (const client of getAllClients()) {
    client.sendPing();
    if (client.checkConnectingTimeout(now)) {
      console.log(`Client ${client.id} timed out (connecting)`);
      client.sendError(
        ERROR_CODE.CONNECTION_TIMEOUT,
        "Connection timeout - please try again."
      );
      client.disconnect("connecting_timeout");
    }
    if (client.checkInputTimeout(now)) {
      console.log(`Client ${client.id} timed out (input/AFK)`);
      client.sendError(
        ERROR_CODE.SESSION_TIMEOUT,
        "Session ended due to inactivity."
      );
      client.disconnect("input_timeout");
    }
    if (client.checkPingTimeout(now, PING_TIMEOUT_THRESHOLD)) {
      console.log(`Client ${client.id} timed out (ping)`);
      client.disconnect("ping_timeout");
    }
    if (client.checkIsAtMaxSessionDuration(now)) {
      console.log(`Client ${client.id} reached max session duration`);
      client.disconnect("max_session_duration");
    }
  }
}, CHECK_LOOP_INTERVAL);

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
  console.log(`Signal server running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/`);
  console.log(
    `Ping interval: ${CHECK_LOOP_INTERVAL}ms, Timeout: ${PING_TIMEOUT_THRESHOLD}ms`
  );
  console.log(`Queue process interval: ${QUEUE_PROCESS_INTERVAL}ms`);
});
