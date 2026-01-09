/**
 * Auth Module for Signal Server
 * Verifies Supabase JWT tokens and checks Stripe subscriptions via Supabase tables
 */

// TODO CHECK IF TS EVEN WORKS! I HAVENT CHECK HOW IT RLLY WORKS YET.

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

let supabase: SupabaseClient | null = null;

/**
 * Initialize Supabase client
 */
export function getSupabase(): SupabaseClient | null {
  if (!supabase && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }
  return supabase;
}

/**
 * Verify user token and return user info
 * Returns null if invalid
 */
export async function verifyToken(
  token: string
): Promise<{ id: string; email?: string } | null> {
  const client = getSupabase();

  if (!client) {
    console.error(
      "Supabase not configured - SUPABASE_URL and SUPABASE_SERVICE_KEY required"
    );
    return null;
  }

  try {
    const {
      data: { user },
      error,
    } = await client.auth.getUser(token);

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
 * Check subscription by checkout session (primary method)
 * Looks up checkout sessions by client_reference_id (supabase user id)
 */
async function checkSubscriptionByCheckoutSession(
  client: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data: sessions, error: sessionsError } = await client
    .schema("stripe")
    .from("checkout_sessions")
    .select("id, subscription, payment_status")
    .eq("client_reference_id", userId);

  if (sessionsError) {
    console.error("Checkout sessions lookup error:", sessionsError.message);
    return false;
  }

  if (!sessions || sessions.length === 0) {
    console.log(`No checkout sessions found for user ${userId}`);
    return false;
  }

  for (const session of sessions) {
    const { subscription, payment_status } = session as {
      id: string;
      subscription: string | null;
      payment_status: string;
    };

    if (payment_status !== "paid") {
      continue;
    }

    if (!subscription) {
      continue;
    }

    const { data: sub, error: subError } = await client
      .schema("stripe")
      .from("subscriptions")
      .select("id, status")
      .eq("id", subscription)
      .single();

    if (subError) {
      console.error(
        `Subscription lookup error for ${subscription}:`,
        subError.message
      );
      continue;
    }

    if (sub && (sub.status === "active" || sub.status === "trialing")) {
      console.log(`User ${userId} has active subscription: ${sub.id}`);
      return true;
    }
  }

  return false;
}

/**
 * Check subscription by email (fallback method)
 * Looks up customer by email, then checks their subscriptions
 */
async function checkSubscriptionByEmail(
  client: SupabaseClient,
  email: string,
  userId: string
): Promise<boolean> {
  console.log(
    `Fallback: checking subscription by email for ${userId} (${email})`
  );

  const { data: customers, error: custError } = await client
    .schema("stripe")
    .from("customers")
    .select("id")
    .ilike("email", email);

  if (custError) {
    console.error("Customer lookup error:", custError.message);
    return false;
  }

  if (!customers || customers.length === 0) {
    console.log(`No customers found for email ${email}`);
    return false;
  }

  if (customers.length > 1) {
    console.log(
      `Multiple customers found for email ${email}, this should NOT HAPPEN!`
    );
  }

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
      console.log(
        `User ${userId} has active subscription (via email fallback): ${
          (subs[0] as { id: string }).id
        }`
      );
      return true;
    }
  }

  return false;
}

/**
 * Check if user has active subscription
 * Flow:
 * 1. First check by checkout session (client_reference_id)
 * 2. If not found, fallback to check by email
 */
export async function checkSubscription(
  userId: string,
  email?: string
): Promise<boolean> {
  const client = getSupabase();

  if (!client) {
    console.error("Supabase not configured");
    return false;
  }

  try {
    // First: check by checkout session
    const foundByCheckoutSession = await checkSubscriptionByCheckoutSession(
      client,
      userId
    );
    if (foundByCheckoutSession) {
      return true;
    }

    // Second: fallback to check by email
    if (email) {
      const foundByEmail = await checkSubscriptionByEmail(
        client,
        email,
        userId
      );
      if (foundByEmail) {
        return true;
      }
    }

    console.log(`User ${userId} has no active subscription`);
    return false;
  } catch (err) {
    console.error("Subscription check error:", err);
    return false;
  }
}

/**
 * Check if user has free access via redeemed invite code
 * Queries the invite_codes table for has_access = true
 */
export async function checkFreeAccess(userId: string): Promise<boolean> {
  const client = getSupabase();

  if (!client) {
    console.error("Supabase not configured");
    return false;
  }

  try {
    const { data, error } = await client
      .from("invite_codes")
      .select("has_access")
      .eq("user_id", userId)
      .eq("has_access", true)
      .limit(1)
      .single();

    if (error || !data) {
      return false;
    }

    console.log(`User ${userId} has free access via invite code`);
    return true;
  } catch (err) {
    console.error("Free access check error:", err);
    return false;
  }
}

/**
 * Full auth check - verify token and subscription
 */
export async function authenticateUser(
  token: string
): Promise<{ id: string; email?: string } | null> {
  const user = await verifyToken(token);

  if (!user) {
    return null;
  }

  const hasSubscription = await checkSubscription(user.id, user.email);

  if (!hasSubscription) {
    console.log(
      `User ${user.id} (${user.email}) does not have active subscription - rejecting`
    );
    return null;
  }

  return user;
}
