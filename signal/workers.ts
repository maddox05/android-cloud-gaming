import type { WebSocket } from "ws";
import type { Worker } from "./types.js";
import type {
  SignalMessage,
  RegisterMessage,
  PingMessage,
  ShutdownMessage,
  ClientDisconnectedMessage,
  StartMessage,
  AnswerMessage,
  IceCandidateMessage,
  ClientGameSelectedMessage,
} from "../shared/types.js";

const workers = new Map<string, Worker>();

let workerIdCounter = 0;

function generateWorkerId(): string {
  return `worker-${++workerIdCounter}`;
}

export function createWorker(ws: WebSocket): Worker {
  const worker: Worker = {
    id: generateWorkerId(),
    ws,
    status: "available",
    clientId: null,
    lastPing: Date.now(),
    games: [],
  };
  return worker;
}

export function registerWorker(worker: Worker, msg: RegisterMessage): void {
  worker.games = msg.games;
  workers.set(worker.id, worker);
  console.log(`Worker ${worker.id} registered with games: ${msg.games}`);
}

export function getWorker(id: string): Worker | undefined {
  return workers.get(id);
}

export function removeWorker(id: string): Worker | undefined {
  const worker = workers.get(id);
  if (worker) {
    workers.delete(id);
    console.log(`Worker ${worker.id} removed`);
  }
  return worker;
}

export function findAvailableWorkerWithGame(game:string): Worker | undefined {
  if(!game){
    console.log("No game selected by client");
    return undefined;
  }
  for (const worker of workers.values()) {
    if (worker.status === "available" && worker.games.includes(game)) {
      return worker;
    }
  }
  console.log(`No available worker found for game: ${game}`);
  return undefined;
}

export function assignWorkerToClient(worker: Worker, clientId: string): void {
  worker.status = "busy";
  worker.clientId = clientId;
  console.log(`Worker ${worker.id} assigned to client ${clientId}`);
}

export function releaseWorker(worker: Worker): void {
  worker.status = "available";
  worker.clientId = null;
  console.log(`Worker ${worker.id} released`);
}

export function updateWorkerPing(worker: Worker): void {
  worker.lastPing = Date.now();
}

export function sendToWorker(worker: Worker, msg: SignalMessage): void {
  if (worker.ws.readyState === 1) {
    worker.ws.send(JSON.stringify(msg));
  }
}

export function sendPingToWorker(worker: Worker): void {
  const ping: PingMessage = { type: "ping" };
  sendToWorker(worker, ping);
}

export function sendStartToWorker(worker: Worker): void {
  const start: StartMessage = { type: "start" };
  sendToWorker(worker, start);
}

export function sendAnswerToWorker(worker: Worker, sdp: string): void {
  const answer: AnswerMessage = { type: "answer", sdp };
  sendToWorker(worker, answer);
}

export function sendClientGameToWorker(worker: Worker, gameId: string): void {
  const msg: ClientGameSelectedMessage = { type: "client-game-selected", gameId };
  sendToWorker(worker, msg);
}

export function sendIceCandidateToWorker(
  worker: Worker,
  candidate: RTCIceCandidateInit | null
): void {
  const ice: IceCandidateMessage = { type: "ice-candidate", candidate };
  sendToWorker(worker, ice);
}

export function sendClientDisconnectedToWorker(worker: Worker): void {
  const msg: ClientDisconnectedMessage = { type: "client-disconnected" };
  sendToWorker(worker, msg);
}



export function sendShutdownToWorker(worker: Worker, reason: string): void {
  const shutdown: ShutdownMessage = { type: "shutdown", reason };
  sendToWorker(worker, shutdown);
}

export function getAllWorkers(): Worker[] {
  return Array.from(workers.values());
}

export function getWorkerCount(): number {
  return workers.size;
}

export function getAvailableWorkerCount(): number {
  let count = 0;
  for (const worker of workers.values()) {
    if (worker.status === "available") count++;
  }
  return count;
}
