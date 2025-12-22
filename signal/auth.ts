/**
 * Auth Module for Signal Server
 * Verifies Supabase JWT tokens
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

let supabase: ReturnType<typeof createClient> | null = null;

/**
 * Initialize Supabase client
 */
function getSupabase() {
  if (!supabase && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }
  return supabase;
}

/**
 * Verify user token and return user info
 * Returns null if invalid
 */
export async function verifyToken(token: string): Promise<{ id: string; email?: string } | null> {
  const client = getSupabase();

  if (!client) {
    console.error("Supabase not configured - SUPABASE_URL and SUPABASE_SERVICE_KEY required");
    return null;
  }

  try {
    const { data: { user }, error } = await client.auth.getUser(token);

    if (error || !user) {
      console.log("Token verification failed:", error?.message);
      return null;
    }

    return {
      id: user.id,
      email: user.email,
    };
  } catch (err) {
    console.error("Auth error:", err);
    return null;
  }
}

/**
 * Check if user has active subscription (no-op for now)
 */
export async function checkSubscription(userId: string): Promise<boolean> {
  // TODO: Implement subscription check
  // For now, always return true
  return true;
}

/**
 * Full auth check - verify token and subscription
 */
export async function authenticateUser(token: string): Promise<{ id: string; email?: string } | null> {
  const user = await verifyToken(token);

  if (!user) {
    return null;
  }

  const hasSubscription = await checkSubscription(user.id);

  if (!hasSubscription) {
    console.log(`User ${user.id} does not have active subscription`);
    // For now, still allow since checkSubscription is a no-op
  }

  return user;
}
