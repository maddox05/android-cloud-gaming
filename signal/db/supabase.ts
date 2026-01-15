/**
 * Supabase Client Module
 * Provides singleton Supabase client for database operations
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

let supabase: SupabaseClient | null = null;

if (!SUPABASE_SERVICE_KEY || !SUPABASE_URL) {
  throw new Error("NO SUPABAS ENV");
}

/**
 * Get or initialize Supabase client
 * Returns null if environment variables are not configured
 */
export function getSupabase(): SupabaseClient | null {
  if (!supabase && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }
  return supabase;
}
