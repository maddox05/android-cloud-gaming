/**
 * Auth Module for Signal Server
 * Verifies Supabase JWT tokens and checks Stripe subscriptions via Supabase tables
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase.js";
import type { AccessType } from "../types.js";

export async function getUserAccessType(userId: string): Promise<AccessType> {
  const hasSubscription = await checkSubscription(userId);
  if (hasSubscription === true) {
    return "paid";
  } else if (false) {
    // TODO for FREE USER CHANGES, check if user has code, if so return free
    return "free";
  } else {
    return null; // todo set null
  }
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
export async function checkSubscription(userId: string): Promise<boolean> {
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

    // Second: fallback to check by email (fetch from Supabase)
    const { data: userData, error: userError } =
      await client.auth.admin.getUserById(userId);

    if (userError) {
      console.error("Failed to fetch user email:", userError.message);
    } else if (userData?.user?.email) {
      const foundByEmail = await checkSubscriptionByEmail(
        client,
        userData.user.email,
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
 * Full auth check - verify token and subscription
 */
export async function authenticateUser(
  token: string
): Promise<{ id: string; email?: string } | null> {
  const user = await verifyToken(token);

  if (!user) {
    return null;
  }

  const hasSubscription = await checkSubscription(user.id);

  if (!hasSubscription) {
    console.log(
      `User ${user.id} (${user.email}) does not have active subscription - rejecting`
    );
    return null;
  }

  return user;
}
