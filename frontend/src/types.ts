// Frontend-only types and constants

// ============================================
// Connection Status
// ============================================

export const CONNECTION_STATUS = {
  CONNECTING: "connecting",
  CONNECTED: "connected",
  ERROR: "error",
  DISCONNECTED: "disconnected",
} as const;

export type ConnectionStatus = (typeof CONNECTION_STATUS)[keyof typeof CONNECTION_STATUS];

// ============================================
// H.264 NAL Unit Types
// ============================================

export const NAL_TYPE = {
  NON_IDR: 1,
  IDR: 5,
  SPS: 7,
  PPS: 8,
} as const;

export type NalType = (typeof NAL_TYPE)[keyof typeof NAL_TYPE];
