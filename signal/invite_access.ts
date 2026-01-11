/**
 * Invite & Access Module
 * Handles checking user access and redeeming invite codes
 */

import { verifyToken } from "./db/auth.js";
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
/**
 * Redeem an invite code for the authenticated user
 *
 * Validates that:
 * - The invite code exists
 * - The invite code hasn't been redeemed yet (user_id is null)
 *
 * When redeemed:
 * - Sets user_id to the authenticated user
 * - Sets time_redeemed to now
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
      .select("user_id, time_redeemed")
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

    // Check if already redeemed (user_id is set when redeemed)
    if (inviteData.user_id !== null) {
      return {
        status: 400,
        body: {
          success: false,
          error: "This invite code has already been redeemed",
        },
      };
    }

    // Redeem the invite code by setting user_id and time_redeemed
    const { error: updateError } = await supabase
      .from("invite_codes")
      .update({
        user_id: user.id,
        time_redeemed: new Date().toISOString(),
      })
      .eq("invite_code", inviteCode)
      .is("user_id", null); // Extra safety: only update if still unclaimed

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
