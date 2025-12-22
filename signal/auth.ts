/**
 * Auth Module for Signal Server
 * Verifies Supabase JWT tokens and checks Stripe subscriptions via Supabase tables
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

let supabase: SupabaseClient | null = null;

/**
 * Initialize Supabase client
 */
function getSupabase(): SupabaseClient | null {
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
 * Check if user has lifetime access or active subscription
 * Queries Supabase stripe schema tables (synced via Stripe Sync Engine)
 */
export async function checkSubscription(userId: string, email?: string): Promise<boolean> {
  const client = getSupabase();

  if (!client) {
    console.error("Supabase not configured");
    return false;
  }

  if (!email) {
    console.log(`No email for user ${userId}, cannot check subscription`);
    return false;
  }

  try {
    // Method 1: Check checkout_sessions by client_reference_id (user ID)
    // This catches one-time purchases where we passed the user ID
    const { data: sessions, error: sessError } = await client
      .schema("stripe")
      .from("checkout_sessions")
      .select("id, client_reference_id, payment_status, mode")
      .eq("client_reference_id", userId)
      .eq("payment_status", "paid");

    if (!sessError && sessions && sessions.length > 0) {
      console.log(`User ${userId} has paid checkout session: ${(sessions[0] as { id: string }).id}`);
      return true;
    }

    if (sessError) {
      console.error("Checkout session query error:", sessError.message);
    }

    // Method 2: Check checkout_sessions by email
    const { data: emailSessions, error: emailSessError } = await client
      .schema("stripe")
      .from("checkout_sessions")
      .select("id, customer_email, payment_status")
      .eq("customer_email", email)
      .eq("payment_status", "paid");

    if (!emailSessError && emailSessions && emailSessions.length > 0) {
      console.log(`User ${userId} has paid checkout session by email: ${(emailSessions[0] as { id: string }).id}`);
      return true;
    }

    if (emailSessError) {
      console.error("Email checkout session query error:", emailSessError.message);
    }

    // Method 3: Find customer by email and check subscriptions
    const { data: customers, error: custError } = await client
      .schema("stripe")
      .from("customers")
      .select("id")
      .eq("email", email);

    if (custError) {
      console.error("Customer lookup error:", custError.message);
      return false;
    }

    if (!customers || customers.length === 0) {
      console.log(`No Stripe customer found for email: ${email}`);
      return false;
    }

    // Check subscriptions for each customer
    for (const customer of customers) {
      const customerId = (customer as { id: string }).id;

      const { data: subs, error: subError } = await client
        .schema("stripe")
        .from("subscriptions")
        .select("id, status")
        .eq("customer", customerId)
        .in("status", ["active", "trialing"]);

      if (subError) {
        console.error("Subscription query error:", subError.message);
        continue;
      }

      if (subs && subs.length > 0) {
        console.log(`User ${userId} has active subscription: ${(subs[0] as { id: string }).id}`);
        return true;
      }
    }

    console.log(`User ${userId} has no active subscription or lifetime access`);
    return false;
  } catch (err) {
    console.error("Subscription check error:", err);
    return false;
  }
}

/**
 * Full auth check - verify token and subscription
 */
export async function authenticateUser(token: string): Promise<{ id: string; email?: string } | null> {
  const user = await verifyToken(token);

  if (!user) {
    return null;
  }

  const hasSubscription = await checkSubscription(user.id, user.email);

  if (!hasSubscription) {
    console.log(`User ${user.id} (${user.email}) does not have active subscription - rejecting`);
    return null;
  }

  return user;
}
