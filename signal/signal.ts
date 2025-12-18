import { WebSocketServer, WebSocket } from "ws";
import type {
  SignalMessage,
  StartMessage,
  ErrorMessage,
  ClientDisconnectedMessage,
} from "../shared/types.js";

if (!process.env.SIGNAL_PORT) {
  console.error("SIGNAL_PORT environment variable is required");
  process.exit(1);
}
const PORT = parseInt(process.env.SIGNAL_PORT, 10);

// Store connected pods and clients
let pod: WebSocket | null = null;
let client: WebSocket | null = null;

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const role = url.searchParams.get("role");

  if (role === "pod") {
    console.log("Pod connected");
    pod = ws;

    ws.on("message", (data) => {
      // Forward pod messages to client (SDP answer, ICE candidates)
      const msg: SignalMessage = JSON.parse(data.toString());
      console.log("Pod ->", msg.type);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(data.toString());
      }
    });

    ws.on("close", () => {
      console.log("Pod disconnected");
      pod = null;
    });
  } else {
    // Frontend client
    console.log("Client connected");
    client = ws;

    ws.on("message", (data) => {
      const msg: SignalMessage = JSON.parse(data.toString());
      console.log("Client ->", msg.type);

      if (msg.type === "start") {
        // Client wants to start a session
        if (!pod || pod.readyState !== WebSocket.OPEN) {
          const error: ErrorMessage = { type: "error", message: "No pod available" };
          ws.send(JSON.stringify(error));
          return;
        }
        // Tell pod to create offer
        const start: StartMessage = { type: "start" };
        pod.send(JSON.stringify(start));
      } else {
        // Forward client messages to pod (SDP answer, ICE candidates)
        if (pod && pod.readyState === WebSocket.OPEN) {
          pod.send(data.toString());
        }
      }
    });

    ws.on("close", () => {
      console.log("Client disconnected");
      client = null;
      // Notify pod that client left
      if (pod && pod.readyState === WebSocket.OPEN) {
        const disconnected: ClientDisconnectedMessage = { type: "client-disconnected" };
        pod.send(JSON.stringify(disconnected));
      }
    });
  }
});

console.log(`Signal server running on ws://localhost:${PORT}`);
