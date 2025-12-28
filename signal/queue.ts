import type { Client } from "./types.js";
import { getClient } from "./clients.js";

// Global queue - ordered array of client IDs
const queue: string[] = [];

export function addToQueue(clientId: string): void {
  if (!queue.includes(clientId)) {
    queue.push(clientId);
    console.log(`Client ${clientId} added to queue at position ${queue.length}`);
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
