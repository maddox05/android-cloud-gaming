/**
 * Invite & Access Module
 * Handles checking user access and redeeming invite codes
 */

import { verifyToken, checkSubscription } from "./db/auth.js";
import { checkFreeAccess } from "./db/database.js";
import { getSupabase } from "./db/supabase.js";

// ============================================================================
// Types
// ============================================================================

export interface CheckAccessResult {
  status: number;
  body: {
    hasAccess: boolean;
    reason: string;
    message?: string;
    userId?: string;
  };
}

export interface RedeemInviteResult {
  status: number;
  body: {
    success: boolean;
    error?: string;
    message?: string;
  };
}

// ============================================================================
// Check Access
// ============================================================================

/**
 * Check if a user has access via subscription or redeemed invite code
 *
 * @param token - The user's authentication token
 * @returns CheckAccessResult with status code and response body
 */
export async function checkAccess(token: string): Promise<CheckAccessResult> {
  try {
    // Verify the token and get user info
    const user = await verifyToken(token);

    if (!user) {
      return {
        status: 401,
        body: {
          hasAccess: false,
          reason: "invalid_token",
          message: "Invalid or expired token",
        },
      };
    }

    // Check if user has an active subscription
    const hasSubscription = await checkSubscription(user.id);

    if (hasSubscription) {
      return {
        status: 200,
        body: {
          hasAccess: true,
          reason: "subscription",
          userId: user.id,
        },
      };
    }

    // Check if user has free access (from redeemed invite code)
    const hasFreeAccess = await checkFreeAccess(user.id);
    if (hasFreeAccess) {
      return {
        status: 200,
        body: {
          hasAccess: true,
          reason: "free_access",
          userId: user.id,
        },
      };
    }

    // No access
    return {
      status: 200,
      body: {
        hasAccess: false,
        reason: "no_subscription",
        message: "No active subscription found",
        userId: user.id,
      },
    };
  } catch (err) {
    console.error("Check access error:", err);
    return {
      status: 500,
      body: {
        hasAccess: false,
        reason: "server_error",
        message: "Internal server error",
      },
    };
  }
}

/**
 * Redeem an invite code for the authenticated user
 *
 * Validates that:
 * - The invite code exists
 * - The invite code belongs to the authenticated user
 * - The invite code hasn't been redeemed yet
 *
 * @param token - The user's authentication token
 * @param inviteCode - The invite code to redeem
 * @returns RedeemInviteResult with status code and response body
 */
export async function redeemInvite(
  token: string,
  inviteCode: string
): Promise<RedeemInviteResult> {
  try {
    // Verify the token and get user info
    const user = await verifyToken(token);

    if (!user) {
      return {
        status: 401,
        body: {
          success: false,
          error: "Invalid or expired token",
        },
      };
    }

    const supabase = getSupabase();
    if (!supabase) {
      return {
        status: 500,
        body: {
          success: false,
          error: "Database not configured",
        },
      };
    }

    // Look up the invite code
    const { data: inviteData, error: lookupError } = await supabase
      .from("invite_codes")
      .select("user_id, time_redeemed, has_access")
      .eq("invite_code", inviteCode)
      .single();

    if (lookupError || !inviteData) {
      return {
        status: 404,
        body: {
          success: false,
          error: "Invalid invite code",
        },
      };
    }

    // Verify the invite code belongs to this user
    if (inviteData.user_id !== user.id) {
      return {
        status: 403,
        body: {
          success: false,
          error: "This invite code is not for your account",
        },
      };
    }

    // Check if already redeemed
    if (inviteData.time_redeemed !== null || inviteData.has_access === true) {
      return {
        status: 400,
        body: {
          success: false,
          error: "This invite code has already been redeemed",
        },
      };
    }

    // Redeem the invite code
    const { error: updateError } = await supabase
      .from("invite_codes")
      .update({
        time_redeemed: new Date().toISOString(),
        has_access: true,
      })
      .eq("invite_code", inviteCode)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Redeem invite error:", updateError);
      return {
        status: 500,
        body: {
          success: false,
          error: "Failed to redeem invite code",
        },
      };
    }

    console.log(`User ${user.id} redeemed invite code ${inviteCode}`);
    return {
      status: 200,
      body: {
        success: true,
        message: "Invite code redeemed successfully! You now have access.",
      },
    };
  } catch (err) {
    console.error("Redeem invite error:", err);
    return {
      status: 500,
      body: {
        success: false,
        error: "Internal server error",
      },
    };
  }
}
