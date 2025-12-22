import type { WebSocket } from "ws";
import type { Client } from "./types.js";
import type {
  SignalMessage,
  PingMessage,
  ShutdownMessage,
  ErrorMessage,
  OfferMessage,
  IceCandidateMessage,
  WorkerDisconnectedMessage,
} from "../shared/types.js";

const clients = new Map<string, Client>();

let clientIdCounter = 0;

function generateClientId(): string {
  return `client-${++clientIdCounter}`;
}

export function createClient(ws: WebSocket, userId: string): Client {
  const client: Client = {
    id: generateClientId(),
    userId,
    ws,
    workerId: null,
    lastPing: Date.now(),
    game: "com.supercell.clashroyale",
    connectionState: "waiting",
  };
  clients.set(client.id, client);
  console.log(`Client ${client.id} (user: ${userId}) connected`);
  return client;
}

export function getClient(id: string): Client | undefined {
  return clients.get(id);
}

export function removeClient(id: string): Client | undefined {
  const client = clients.get(id);
  if (client) {
    clients.delete(id);
    console.log(`Client ${client.id} removed`);
  }
  return client;
}

export function assignClientToWorker(client: Client, workerId: string): void {
  client.workerId = workerId;
  client.connectionState = "connecting";
  console.log(`Client ${client.id} assigned to worker ${workerId}`);
}

export function setClientConnected(client: Client): void {
  client.connectionState = "connected";
  console.log(`Client ${client.id} connected to worker`);
}

export function releaseClient(client: Client): void {
  client.workerId = null;
  client.connectionState = "waiting";
}

export function updateClientPing(client: Client): void {
  client.lastPing = Date.now();
}

export function sendToClient(client: Client, msg: SignalMessage): void {
  if (client.ws.readyState === 1) {
    client.ws.send(JSON.stringify(msg));
  }
}

export function sendPingToClient(client: Client): void {
  const ping: PingMessage = { type: "ping" };
  sendToClient(client, ping);
}

export function sendErrorToClient(client: Client, message: string): void {
  const error: ErrorMessage = { type: "error", message };
  sendToClient(client, error);
}

export function sendOfferToClient(client: Client, sdp: string): void {
  const offer: OfferMessage = { type: "offer", sdp };
  sendToClient(client, offer);
}

export function sendIceCandidateToClient(
  client: Client,
  candidate: RTCIceCandidateInit | null
): void {
  const ice: IceCandidateMessage = { type: "ice-candidate", candidate };
  sendToClient(client, ice);
}

export function sendWorkerDisconnectedToClient(client: Client): void {
  const msg: WorkerDisconnectedMessage = { type: "worker-disconnected" };
  sendToClient(client, msg);
}

export function sendShutdownToClient(client: Client, reason: string): void {
  const shutdown: ShutdownMessage = { type: "shutdown", reason };
  sendToClient(client, shutdown);
}

export function getAllClients(): Client[] {
  return Array.from(clients.values());
}

export function getClientCount(): number {
  return clients.size;
}
