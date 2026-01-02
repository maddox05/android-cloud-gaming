import { getClient, findAvailableWorkerWithGame } from "./registry.js";
import type Client from "./Client.js";
import { ERROR_CODE } from "../shared/types.js";
import { QUEUE_TIMEOUT_THRESHOLD } from "./consts.js";
import { generateTurnCredentials } from "./helpers.js";

// Global queue - ordered array of client IDs
const queue: string[] = [];

// ============================================
// Queue Operations
// ============================================

export function addToQueue(clientId: string): void {
  if (!queue.includes(clientId)) {
    queue.push(clientId);
    console.log(
      `Client ${clientId} added to queue at position ${queue.length}`
    );
  }
}

export function removeFromQueue(clientId: string): void {
  const index = queue.indexOf(clientId);
  if (index !== -1) {
    queue.splice(index, 1);
    console.log(`Client ${clientId} removed from queue`);
  }
}

export function getQueuePosition(clientId: string): number {
  const index = queue.indexOf(clientId);
  return index === -1 ? -1 : index + 1; // 1-indexed position
}

export function getQueueLength(): number {
  return queue.length;
}

export function getQueuedClients(): Client[] {
  const clients: Client[] = [];
  for (const clientId of queue) {
    const client = getClient(clientId);
    if (client) {
      clients.push(client);
    }
  }
  return clients;
}

export function getAllQueuedClientIds(): string[] {
  return [...queue];
}

// ============================================
// Queue Processing (FUNCA)
// ============================================

export async function processQueue(): Promise<void> {
  // Iterate copy of queue to allow modifications during iteration
  for (const clientId of [...queue]) {
    const client = getClient(clientId);
    if (!client || !client.game) continue;

    // Find available worker for this client's game
    const worker = findAvailableWorkerWithGame(client.game);

    if (worker) {
      // Remove from queue first
      removeFromQueue(clientId);

      // Generate TURN credentials for this session
      const turnInfo = await generateTurnCredentials();
      client.turnInfo = turnInfo;
      worker.turnInfo = turnInfo;

      // Assign worker to client (sets up bidirectional link)
      client.assignWorker(worker);

      // Tell client they're ready (includes turnInfo)
      client.sendQueueReady();

      console.log(
        `Matched client ${client.id} with worker ${worker.id} for game ${client.game}`
      );
    }
  }

  // Send queue info updates to remaining clients
  for (const clientId of queue) {
    const client = getClient(clientId);
    if (client) {
      client.sendQueueInfo();
    }
  }
}

// ============================================
// Queue Timeout Check
// ============================================

export function checkQueueTimeouts(): void {
  const now = Date.now();

  for (const clientId of [...queue]) {
    const client = getClient(clientId);

    // Clean up orphaned queue entries
    if (!client) {
      removeFromQueue(clientId);
      continue;
    }

    if (client.queuedAt && now - client.queuedAt > QUEUE_TIMEOUT_THRESHOLD) {
      console.log(`Client ${client.id} timed out in queue`);
      client.sendError(
        ERROR_CODE.QUEUE_TIMEOUT,
        "Queue timeout - you've been waiting too long. Please try again."
      );
      removeFromQueue(clientId);
      client.disconnect("queue_timeout");
    }
  }
}
