// Signal server types
// Note: Client and Worker are now classes in Client.ts and Worker.ts
// The type exports below are re-exported from those files for convenience

export type { ClientConnectionState } from "./Client.js";
export type { WorkerStatus } from "./Worker.js";

export type UserAccessType = "free" | "paid" | null;
