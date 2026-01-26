/**
 * Auth Module for Signal Server
 * Verifies Supabase JWT tokens and checks Stripe subscriptions via Supabase tables
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase.js";
import { checkFreeAccess } from "./database.js";
import type { AccessType } from "../types.js";

/**
 * Get the user's access type
 * @returns "paid" if user has active subscription, "free" if user has redeemed invite code, null otherwise
 */
export async function getUserAccessType(userId: string): Promise<AccessType> {
  // Check for paid subscription first
  const hasSubscription = await checkSubscription(userId);
  if (hasSubscription) {
    console.log(`[Auth] User ${userId}: paid`);
    return "paid";
  }

  // Check for free access via redeemed invite code
  const hasFreeAccess = await checkFreeAccess(userId);
  if (hasFreeAccess) {
    console.log(`[Auth] User ${userId}: free`);
    return "free";
  }

  // No access
  console.log(`[Auth] User ${userId}: no access`);
  return null;
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
    console.error("[Auth] Supabase not configured");
    return null;
  }

  try {
    const {
      data: { user },
      error,
    } = await client.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
    };
  } catch (err) {
    console.error("[Auth] Token verification error:", err);
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
    console.error("[Auth] Checkout sessions lookup error:", sessionsError.message);
    return false;
  }

  if (!sessions || sessions.length === 0) {
    return false;
  }

  for (const session of sessions) {
    const { subscription, payment_status } = session as {
      id: string;
      subscription: string | null;
      payment_status: string;
    };

    if (payment_status !== "paid" || !subscription) {
      continue;
    }

    const { data: sub, error: subError } = await client
      .schema("stripe")
      .from("subscriptions")
      .select("id, status")
      .eq("id", subscription)
      .single();

    if (subError) {
      console.error("[Auth] Subscription lookup error:", subError.message);
      continue;
    }

    if (sub && (sub.status === "active" || sub.status === "trialing")) {
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
  email: string
): Promise<boolean> {
  const { data: customers, error: custError } = await client
    .schema("stripe")
    .from("customers")
    .select("id")
    .ilike("email", email);

  if (custError) {
    console.error("[Auth] Customer lookup error:", custError.message);
    return false;
  }

  if (!customers || customers.length === 0) {
    return false;
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
      console.error("[Auth] Subscription query error:", subError.message);
      continue;
    }

    if (subs && subs.length > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Check if user has a password set (encrypted_password is not null)
 * Used for account linking feature to detect if OAuth user has added password auth
 * Requires SQL function: check_user_has_password(user_id uuid) in Supabase
 */
export async function checkUserHasPassword(userId: string): Promise<boolean> {
  const client = getSupabase();

  if (!client) {
    console.error("[Auth] Supabase not configured");
    return false;
  }

  try {
    const { data, error } = await client.rpc("check_user_has_password", {
      user_id: userId,
    });

    if (error) {
      console.error("[Auth] Password check error:", error.message);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error("[Auth] Password check error:", err);
    return false;
  }
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
    console.error("[Auth] Supabase not configured");
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
      console.error("[Auth] Failed to fetch user email:", userError.message);
    } else if (userData?.user?.email) {
      const foundByEmail = await checkSubscriptionByEmail(
        client,
        userData.user.email
      );
      if (foundByEmail) {
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error("[Auth] Subscription check error:", err);
    return false;
  }
}
