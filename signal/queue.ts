import { findAvailableWorkerWithGame } from "./registry.js";
import type Client from "./Client.js";
import { ERROR_CODE } from "../shared/types.js";
import { QUEUE_TIMEOUT_THRESHOLD } from "./consts.js";
import { generateTurnCredentials } from "./helpers.js";

// Global queue - ordered array of Client objects
const queue: Client[] = [];

// ============================================
// Queue Operations
// ============================================

export function addToQueue(client: Client): void {
  // i can see race issues with this instantly (if i go multi threaded)
  if (queue.includes(client)) {
    console.log(
      `tried to add client ${client.id} to the queue when bro was alr queued`,
    );
    return;
  }

  if (client.accessType === "paid") {
    // Start from end, walk back through paid users, insert after last paid
    let insertIndex = -1;
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].accessType === "free") {
        insertIndex = i;
        break;
      }
    }
    if (insertIndex === -1) {
      queue.push(client);
    } else {
      queue.splice(insertIndex, 0, client);
    }
    console.log(
      `Client ${client.id} (paid) added to queue at position ${
        insertIndex !== -1 ? insertIndex + 1 : queue.length
      }`,
    );
  } else if (client.accessType === "free") {
    queue.push(client);
    console.log(
      `Client ${client.id} (free) added to queue at position ${queue.length}`,
    );
  } else {
    console.log(
      `Client ${client.id} (null/undefined) TRIED added to queue at position ${queue.length}`,
    );
    throw new Error(
      "How in the hell is a non-free / non paid client getting in the queue?",
    );
  }
}

export function removeFromQueue(client: Client): void {
  const index = queue.indexOf(client);
  if (index !== -1) {
    queue.splice(index, 1);
    console.log(`Client ${client.id} removed from queue`);
  }
}

export function getQueuePosition(client: Client): number {
  const index = queue.indexOf(client);
  return index === -1 ? -1 : index + 1; // 1-indexed position
}

export function getQueueLength(): number {
  return queue.length;
}

export function getQueuedClients(): Client[] {
  return [...queue];
}

export function getAllQueuedClientIds(): string[] {
  return queue.map((client) => client.id);
}

export function amIQueued(client: Client): boolean {
  return queue.some(
    (c) =>
      c === client ||
      c.id === client.id ||
      (client.userId && c.userId === client.userId),
  );
}

// ============================================
// Queue Processing (FUNCA)
// ============================================

export async function processQueue(): Promise<void> {
  // Iterate copy of queue to allow modifications during iteration
  for (const client of [...queue]) {
    if (!client.game) continue;

    // Find available worker for this client's game
    const worker = findAvailableWorkerWithGame(client.game);

    if (worker) {
      // Remove from queue first
      removeFromQueue(client);

      // Generate TURN credentials for this session
      const turnInfo = await generateTurnCredentials();
      client.turnInfo = turnInfo;
      worker.turnInfo = turnInfo;

      // Assign worker to client (sets up bidirectional link)
      client.assignWorker(worker);

      // Tell client they're ready (includes turnInfo)
      client.sendQueueReady();

      console.log(
        `Matched client ${client.id} with worker ${worker.id} for game ${client.game}`,
      );
    }
  }

  // Send queue info updates to remaining clients
  for (const client of queue) {
    client.sendQueueInfo();
  }
}

// ============================================
// Queue Timeout Check
// ============================================

export function checkQueueTimeouts(): void {
  const now = Date.now();

  for (const client of [...queue]) {
    if (client.queuedAt && now - client.queuedAt > QUEUE_TIMEOUT_THRESHOLD) {
      console.log(`Client ${client.id} timed out in queue`);
      client.sendError(
        ERROR_CODE.QUEUE_TIMEOUT,
        "Queue timeout - you've been waiting too long. Please try again.",
      );
      removeFromQueue(client);
      client.disconnect("queue_timeout");
    }
  }
}
