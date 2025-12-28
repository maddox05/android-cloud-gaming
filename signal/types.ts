import type { WebSocket } from "ws";

export type WorkerStatus = "available" | "busy";
export type ClientConnectionState = "waiting" | "queued" | "connecting" | "connected";

export interface Worker {
  id: string;
  ws: WebSocket;
  status: WorkerStatus;
  clientId: string | null;
  lastPing: number;
  games: string[];
}

export interface Client {
  id: string;
  userId: string;
  ws: WebSocket;
  workerId: string | null;
  lastPing: number;
  lastInput: number;
  game: string | null;
  connectionState: ClientConnectionState;
  queuedAt: number | null; // timestamp when client joined queue
  assignedAt: number | null; // timestamp when client was assigned a worker
}
