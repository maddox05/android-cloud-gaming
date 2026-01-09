/**
 * Database Module for Signal Server
 * Handles session logging and user time tracking
 */

import { getSupabase } from "./supabase.js";
import { getUserTimeSpentToday as getUserTimeSpentTodayShared } from "../../shared/functions.js";

/**
 * Session data to log when a client disconnects
 */
export interface SessionLogData {
  user_id: string;
  package_name: string;
  max_video_size: number;
  started_at: number; // Unix timestamp (ms)
  ended_at: number; // Unix timestamp (ms)
  ended_reason: string;
}

/**
 * Log a game session to the database
 * Should only be called when client was actually in a game (connected state with game set)
 *
 * @param data - Session data to log
 * @returns true if logged successfully, false otherwise
 */
export async function logSession(data: SessionLogData): Promise<boolean> {
  const client = getSupabase();

  if (!client) {
    console.error("Cannot log session: Supabase not configured");
    return false;
  }

  try {
    const { error } = await client.from("game_sessions").insert({
      user_id: data.user_id,
      package_name: data.package_name,
      max_video_size: data.max_video_size,
      started_at: new Date(data.started_at).toISOString(),
      ended_at: new Date(data.ended_at).toISOString(),
      ended_reason: data.ended_reason,
    });

    if (error) {
      console.error("Failed to log session:", error.message);
      return false;
    }

    console.log(
      `Session logged for user ${data.user_id}: ${data.package_name}`
    );
    return true;
  } catch (err) {
    console.error("Session logging error:", err);
    return false;
  }
}

/**
 * Get the total time a user has spent playing today (in milliseconds)
 * Uses the shared function with the server's Supabase client
 *
 * @param userId - Supabase user ID
 * @returns Total time in milliseconds, or 0 if no sessions found
 */
export async function getUserTimeSpentToday(userId: string): Promise<number> {
  const client = getSupabase();

  if (!client) {
    console.error("Cannot get user time: Supabase not configured");
    return 0;
  }

  return getUserTimeSpentTodayShared(client, userId);
}
