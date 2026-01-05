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
 * Check if user has active subscription by looking up their checkout sessions
 * Flow:
 * 1. Get all checkout sessions for this supabase user (via client_reference_id)
 * 2. For each completed session, get the subscription ID
 * 3. Check if that subscription is active
 * 4. Return true if any subscription is active
 */
export async function checkSubscription(
  userId: string,
  _email?: string
): Promise<boolean> {
  const client = getSupabase();

  if (!client) {
    console.error("Supabase not configured");
    return false;
  }

  try {
    // Get all checkout sessions for this user (client_reference_id stores supabase user id)
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

    // Check each completed checkout session
    for (const session of sessions) {
      const { subscription, payment_status } = session as {
        id: string;
        subscription: string | null;
        payment_status: string;
      };

      // Skip sessions that aren't paid/completed
      if (payment_status !== "paid") {
        continue;
      }

      // Skip sessions without a subscription (e.g., one-time purchases)
      if (!subscription) {
        continue;
      }

      // Check if this subscription is active
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

    // Fallback: check by email if checkout sessions didn't find an active subscription (this is so awful)
    if (_email) {
      console.log(`Fallback: checking subscription by email for ${userId}`);

      const { data: customers, error: custError } = await client
        .schema("stripe")
        .from("customers")
        .select("id")
        .ilike("email", _email);

      if (custError) {
        console.error("Customer lookup error:", custError.message);
      } else if (customers.length > 1) {
        console.log(
          `Multiple customers found for email ${_email}, this should NOT HAPPEN!`
        );
      } else if (customers && customers.length > 0) {
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

  const hasSubscription = await checkSubscription(user.id, user.email);

  if (!hasSubscription) {
    console.log(
      `User ${user.id} (${user.email}) does not have active subscription - rejecting`
    );
    return null;
  }

  return user;
}
