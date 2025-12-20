import type { WebSocket } from "ws";

export type WorkerStatus = "available" | "busy";
export type ClientConnectionState = "waiting" | "connecting" | "connected";

export interface Worker {
  id: string;
  ws: WebSocket;
  status: WorkerStatus;
  clientId: string | null;
  lastPing: number;
  game: string;
}

export interface Client {
  id: string;
  ws: WebSocket;
  workerId: string | null;
  lastPing: number;
  game: string;
  connectionState: ClientConnectionState;
}
