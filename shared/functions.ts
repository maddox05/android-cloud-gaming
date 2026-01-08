/**
 * Shared functions for both frontend and backend
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

/**
 * Get the total time a user has spent playing today (in milliseconds)
 * Uses UTC for "today" calculation
 *
 * @param supabase - Supabase client instance
 * @param userId - Supabase user ID
 * @returns Total time in milliseconds, or 0 if no sessions found
 */
export async function getUserTimeSpentToday(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  try {
    // Get start of today in UTC
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const startOfToday = today.toISOString();

    const { data, error } = await supabase
      .from("game_sessions")
      .select("started_at, ended_at")
      .eq("user_id", userId)
      .gte("started_at", startOfToday);

    if (error) {
      console.error("Failed to get user time:", error.message);
      return 0;
    }

    if (!data || data.length === 0) {
      return 0;
    }

    // Sum up all session durations
    let totalMs = 0;
    for (const session of data) {
      const started = new Date(session.started_at).getTime();
      const ended = new Date(session.ended_at).getTime();
      totalMs += ended - started;
    }

    return totalMs;
  } catch (err) {
    console.error("Get user time error:", err);
    return 0;
  }
}
