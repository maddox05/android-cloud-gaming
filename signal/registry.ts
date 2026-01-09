import type { WebSocket } from "ws";

// Forward declarations to avoid circular imports
// These will be the actual class types once Client.ts and Worker.ts are created
import type Client from "./Client.js";
import type Worker from "./Worker.js";

// Private registries
const clientRegistry = new Map<string, Client>();
const workerRegistry = new Map<string, Worker>();
const wsToClient = new Map<WebSocket, Client>();
const wsToWorker = new Map<WebSocket, Worker>();

// ID counters
let clientIdCounter = 0;
let workerIdCounter = 0;

// ID generation
export function generateClientId(): string {
  return `client-${++clientIdCounter}`;
}

export function generateWorkerId(): string {
  return `worker-${++workerIdCounter}`;
}

// Client registration
export function registerClient(client: Client): void {
  clientRegistry.set(client.id, client);
}

export function unregisterClient(id: string): void {
  clientRegistry.delete(id);
}

export function getClient(id: string): Client | undefined {
  return clientRegistry.get(id);
}

// Worker registration
export function registerWorker(worker: Worker): void {
  workerRegistry.set(worker.id, worker);
}

export function unregisterWorker(id: string): void {
  workerRegistry.delete(id);
}

export function getWorker(id: string): Worker | undefined {
  return workerRegistry.get(id);
}

// WebSocket to entity mapping
export function setClientWs(ws: WebSocket, client: Client): void {
  wsToClient.set(ws, client);
}

export function removeClientWs(ws: WebSocket): void {
  wsToClient.delete(ws);
}

export function getClientByWs(ws: WebSocket): Client | undefined {
  return wsToClient.get(ws);
}

export function setWorkerWs(ws: WebSocket, worker: Worker): void {
  wsToWorker.set(ws, worker);
}

export function removeWorkerWs(ws: WebSocket): void {
  wsToWorker.delete(ws);
}

export function getWorkerByWs(ws: WebSocket): Worker | undefined {
  return wsToWorker.get(ws);
}

// Iteration
export function getAllClients(): Client[] {
  return Array.from(clientRegistry.values());
}

export function getAllWorkers(): Worker[] {
  return Array.from(workerRegistry.values());
}

// Query
export function findAvailableWorkerWithGame(game: string): Worker | undefined {
  if (!game) {
    console.log("No game specified for worker search");
    return undefined;
  }

  for (const worker of workerRegistry.values()) {
    if (worker.status === "available" && worker.games.includes(game)) {
      return worker;
    }
  }

  console.log(`No available worker found for game: ${game}`);
  return undefined;
}

// Stats
export function getClientCount(): number {
  return clientRegistry.size;
}

export function getWorkerCount(): number {
  return workerRegistry.size;
}

export function getAvailableWorkerCount(): number {
  let count = 0;
  for (const worker of workerRegistry.values()) {
    if (worker.status === "available") count++;
  }
  return count;
}

// User checks (not check by just registry id, but also by supabase user and reference)

export function amIAlreadyInGame(client: Client): boolean {
  for (const c of clientRegistry.values()) {
    if (!c.worker) continue; // not in a game
    if (
      c === client ||
      c.id === client.id ||
      (client.userId && c.userId === client.userId)
    ) {
      return true;
    }
  }
  return false;
}
