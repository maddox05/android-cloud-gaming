import {
  getAllClients,
  getAllWorkers,
  getWorkerCount,
  getClientCount,
  getAvailableWorkerCount,
} from "./registry.js";
import { getQueueLength, getQueuedClients } from "./queue.js";

export interface WorkerStats {
  id: string;
  status: "available" | "busy";
  games: string[];
  clientId: string | null;
  lastPing: number;
  msSinceLastPing: number;
}

export interface ClientStats {
  id: string;
  userId: string;
  connectionState: string;
  game: string | null;
  accessType: "free" | "paid" | null;
  workerId: string | null;
  timeUsedTodayMs: number;
  queuePosition: number | null;
  queuedAt: number | null;
  assignedAt: number | null;
  lastPing: number;
  msSinceLastPing: number;
  lastInput: number;
  msSinceLastInput: number;
}

export interface StatsResponse {
  timestamp: number;
  summary: {
    workers: {
      total: number;
      available: number;
      busy: number;
    };
    clients: {
      total: number;
      byState: {
        waiting: number;
        queued: number;
        connecting: number;
        connected: number;
      };
      byAccessType: {
        free: number;
        paid: number;
      };
    };
    queue: {
      length: number;
    };
  };
  workers: WorkerStats[];
  clients: ClientStats[];
  queue: {
    clientIds: string[];
  };
}

export function getStats(): StatsResponse {
  const now = Date.now();
  const workers = getAllWorkers();
  const clients = getAllClients();
  const queuedClients = getQueuedClients();

  // Build worker stats
  const workerStats: WorkerStats[] = workers.map((w) => ({
    id: w.id,
    status: w.status,
    games: w.games,
    clientId: w.client?.id ?? null,
    lastPing: w.lastPing,
    msSinceLastPing: now - w.lastPing,
  }));

  // Build client stats
  const clientStats: ClientStats[] = clients.map((c) => {
    const queueIndex = queuedClients.findIndex((qc) => qc.id === c.id);
    return {
      id: c.id,
      userId: c.userId,
      connectionState: c.connectionState,
      game: c.game,
      accessType: c.accessType,
      workerId: c.worker?.id ?? null,
      timeUsedTodayMs: c.timeUsedTodayMs,
      queuePosition: queueIndex !== -1 ? queueIndex + 1 : null,
      queuedAt: c.queuedAt,
      assignedAt: c.assignedAt,
      lastPing: c.lastPing,
      msSinceLastPing: now - c.lastPing,
      lastInput: c.lastInput,
      msSinceLastInput: now - c.lastInput,
    };
  });

  // Calculate summaries
  const clientsByState = {
    waiting: clients.filter((c) => c.connectionState === "waiting").length,
    queued: clients.filter((c) => c.connectionState === "queued").length,
    connecting: clients.filter((c) => c.connectionState === "connecting").length,
    connected: clients.filter((c) => c.connectionState === "connected").length,
  };

  const clientsByAccessType = {
    free: clients.filter((c) => c.accessType === "free").length,
    paid: clients.filter((c) => c.accessType === "paid").length,
  };

  return {
    timestamp: now,
    summary: {
      workers: {
        total: getWorkerCount(),
        available: getAvailableWorkerCount(),
        busy: getWorkerCount() - getAvailableWorkerCount(),
      },
      clients: {
        total: getClientCount(),
        byState: clientsByState,
        byAccessType: clientsByAccessType,
      },
      queue: {
        length: getQueueLength(),
      },
    },
    workers: workerStats,
    clients: clientStats,
    queue: {
      clientIds: queuedClients.map((c) => c.id),
    },
  };
}
