/**
 * Waitlist Endpoints Module
 * Handles joining the waitlist and generating invite codes for waitlist users
 */

import { verifyToken } from "./db/auth.js";
import { getSupabase } from "./db/supabase.js";

// ============================================================================
// Configuration
// ============================================================================

const WAITLIST_CONFIG = {
  REFERRER_REWARD_HOURS: 1,
  NEW_USER_BONUS_HOURS: 0,
};

// ============================================================================
// Types
// ============================================================================

export interface JoinWaitlistResult {
  status: number;
  body: {
    success: boolean;
    error?: string;
    referral_code?: string;
  };
}

export interface GenerateInvitesResult {
  status: number;
  body: {
    success: boolean;
    error?: string;
    message?: string;
    processed?: Array<{ user_id: string; email?: string; invite_code: string }>;
    errors?: Array<{ user_id: string; error: string }>;
  };
}

export interface AdminResult {
  status: number;
  body: {
    success: boolean;
    error?: string;
  };
}

// ============================================================================
// Join Waitlist
// ============================================================================

/**
 * Join the waitlist with an optional referral code
 *
 * This is done on the backend because:
 * - RLS prevents frontend from validating other users' referral codes
 * - Service key bypasses RLS for these operations
 *
 * @param token - The user's authentication token
 * @param referralCode - Optional referral code from another user
 * @returns JoinWaitlistResult with status code and response body
 */
export async function joinWaitlist(
  token: string,
  referralCode?: string
): Promise<JoinWaitlistResult> {
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

    // Generate a unique referral code (UUID) for this user
    const newReferralCode = crypto.randomUUID();

    // Validate referral code if provided
    let referrerId: string | null = null;
    if (referralCode && referralCode.trim() !== "") {
      const { data: referrerData, error: referrerError } = await supabase
        .from("waitlist")
        .select("user_id")
        .eq("referral_code", referralCode)
        .single();

      if (referrerError || !referrerData) {
        return {
          status: 400,
          body: {
            success: false,
            error: "Invalid referral code",
          },
        };
      }

      referrerId = referrerData.user_id;

      // Prevent self-referral
      if (referrerId === user.id) {
        return {
          status: 400,
          body: {
            success: false,
            error: "You cannot use your own referral code",
          },
        };
      }
    }

    // Calculate initial time_joined (with bonus if using referral)
    let timeJoined = new Date();
    if (referrerId && WAITLIST_CONFIG.NEW_USER_BONUS_HOURS > 0) {
      timeJoined = new Date(
        timeJoined.getTime() -
          WAITLIST_CONFIG.NEW_USER_BONUS_HOURS * 60 * 60 * 1000
      );
    }

    // Insert the new waitlist entry
    const { error: insertError } = await supabase.from("waitlist").insert({
      user_id: user.id,
      time_joined: timeJoined.toISOString(),
      referral_code: newReferralCode,
      referral_code_used_to_join: referralCode || null,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        return {
          status: 400,
          body: {
            success: false,
            error: "You are already on the waitlist",
          },
        };
      }
      console.error("Join waitlist error:", insertError);
      return {
        status: 500,
        body: {
          success: false,
          error: insertError.message,
        },
      };
    }

    // Reward the referrer if a valid code was used
    if (referrerId) {
      // Get referrer's current time_joined
      const { data: referrerEntry, error: fetchError } = await supabase
        .from("waitlist")
        .select("time_joined")
        .eq("user_id", referrerId)
        .single();

      if (!fetchError && referrerEntry) {
        const currentTime = new Date(referrerEntry.time_joined);
        const newTime = new Date(
          currentTime.getTime() -
            WAITLIST_CONFIG.REFERRER_REWARD_HOURS * 60 * 60 * 1000
        );

        const { error: updateError } = await supabase
          .from("waitlist")
          .update({ time_joined: newTime.toISOString() })
          .eq("user_id", referrerId);

        if (updateError) {
          console.error("Failed to reward referrer:", updateError);
          // Don't fail the join, just log the error
        } else {
          console.log(
            `Rewarded referrer ${referrerId} with ${WAITLIST_CONFIG.REFERRER_REWARD_HOURS} hour(s) boost`
          );
        }
      }
    }

    console.log(
      `User ${user.id} joined waitlist with referral code ${newReferralCode}`
    );
    return {
      status: 200,
      body: {
        success: true,
        referral_code: newReferralCode,
      },
    };
  } catch (err) {
    console.error("Join waitlist error:", err);
    return {
      status: 500,
      body: {
        success: false,
        error: "Internal server error",
      },
    };
  }
}

// ============================================================================
// Generate Invites (Admin)
// ============================================================================

/**
 * Take the first N users off the waitlist and generate invite codes for them
 *
 * Flow:
 * 1. Get the first N users from waitlist (ordered by time_joined)
 * 2. For each user:
 *    - Generate a new invite code (user_id is NULL, anyone can redeem)
 *    - Remove user from waitlist
 *    - TODO: Send email to user with their invite code
 *
 * Note: Invite codes are NOT pre-assigned to users. The codes are generated
 * and should be emailed to the users who were removed from the waitlist.
 * The user redeems the code to claim it and gain access.
 *
 * TODO: Add admin authentication
 *
 * @param count - Number of users to process (capped at 100)
 * @returns GenerateInvitesResult with status code and response body
 */
export async function generateInvites(
  count: number
): Promise<GenerateInvitesResult> {
  // Cap at reasonable number
  const processCount = Math.min(count, 100);

  try {
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

    // Get the first N users from waitlist, ordered by time_joined (earliest first)
    const { data: waitlistUsers, error: fetchError } = await supabase
      .from("waitlist")
      .select("user_id")
      .order("time_joined", { ascending: true })
      .limit(processCount);

    if (fetchError) {
      console.error("Fetch waitlist error:", fetchError);
      return {
        status: 500,
        body: {
          success: false,
          error: "Failed to fetch waitlist",
        },
      };
    }

    if (!waitlistUsers || waitlistUsers.length === 0) {
      return {
        status: 200,
        body: {
          success: true,
          message: "No users on waitlist",
          processed: [],
        },
      };
    }

    const processed: Array<{ user_id: string; email?: string; invite_code: string }> = [];
    const errors: Array<{ user_id: string; error: string }> = [];

    for (const waitlistUser of waitlistUsers) {
      const userId = waitlistUser.user_id;

      // Generate UUID invite code (user_id is null - anyone can redeem)
      const inviteCode = crypto.randomUUID();

      // Insert into invite_codes table (user_id and time_redeemed are null)
      const { error: insertError } = await supabase
        .from("invite_codes")
        .insert({
          invite_code: inviteCode,
          // user_id defaults to null (set when redeemed)
          // time_redeemed defaults to null (set when redeemed)
        });

      if (insertError) {
        console.error(`Failed to create invite for ${userId}:`, insertError);
        errors.push({ user_id: userId, error: insertError.message });
        continue;
      }

      // Get user's email for sending the invite
      let userEmail: string | undefined;
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(userId);
        userEmail = userData?.user?.email ?? undefined;
      } catch {
        console.warn(`Could not fetch email for user ${userId}`);
      }

      // Remove from waitlist
      const { error: deleteError } = await supabase
        .from("waitlist")
        .delete()
        .eq("user_id", userId);

      if (deleteError) {
        console.error(`Failed to remove ${userId} from waitlist:`, deleteError);
        // Invite was created, so we still mark as processed
      }

      // TODO: Send email with invite code to the user
      // This is where you would integrate with an email service (SendGrid, Resend, etc.)
      // Example:
      // if (userEmail) {
      //   await sendInviteEmail(userEmail, inviteCode);
      // }

      processed.push({ user_id: userId, email: userEmail, invite_code: inviteCode });
      console.log(`Generated invite code ${inviteCode} for user ${userId} (${userEmail || 'no email'})`);
    }

    return {
      status: 200,
      body: {
        success: true,
        message: `Processed ${processed.length} users. Remember to send invite codes to their emails!`,
        processed,
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  } catch (err) {
    console.error("Generate invites error:", err);
    return {
      status: 500,
      body: {
        success: false,
        error: "Internal server error",
      },
    };
  }
}

// ============================================================================
// Remove from Waitlist (Admin)
// ============================================================================

/**
 * Remove a user from the waitlist
 *
 * This should be called when:
 * - A user gains access to the platform (via payment or invite)
 * - A user requests to be removed
 * - Admin manually removes a user
 *
 * Note: Positions of users behind this user will automatically update
 * since positions are calculated dynamically.
 *
 * TODO: Add admin authentication
 *
 * @param userId - The user ID to remove from the waitlist
 * @returns AdminResult with status code and response body
 */
export async function removeFromWaitlist(userId: string): Promise<AdminResult> {
  try {
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

    // TODO: Before removing, fetch user's email and send notification
    // const { data: userData } = await supabase.auth.admin.getUserById(userId);
    // if (userData?.user?.email) {
    //   await sendWaitlistRemovalEmail(userData.user.email);
    // }

    const { error } = await supabase
      .from("waitlist")
      .delete()
      .eq("user_id", userId);

    if (error) {
      console.error("Remove from waitlist error:", error);
      return {
        status: 500,
        body: {
          success: false,
          error: error.message,
        },
      };
    }

    console.log(`Removed user ${userId} from waitlist`);
    return {
      status: 200,
      body: {
        success: true,
      },
    };
  } catch (err) {
    console.error("Remove from waitlist error:", err);
    return {
      status: 500,
      body: {
        success: false,
        error: "Internal server error",
      },
    };
  }
}

// ============================================================================
// Adjust Waitlist Position (Admin)
// ============================================================================

/**
 * Adjust a user's position in the waitlist by modifying their time_joined
 *
 * TODO: Add admin authentication
 *
 * @param userId - The user ID to adjust
 * @param hoursToMove - Positive moves them up (earlier), negative moves them down (later)
 * @returns AdminResult with status code and response body
 */
export async function adjustWaitlistPosition(
  userId: string,
  hoursToMove: number
): Promise<AdminResult> {
  try {
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

    // Get current time_joined
    const { data: entry, error: fetchError } = await supabase
      .from("waitlist")
      .select("time_joined")
      .eq("user_id", userId)
      .single();

    if (fetchError || !entry) {
      return {
        status: 404,
        body: {
          success: false,
          error: "User not found on waitlist",
        },
      };
    }

    // Calculate new time
    const currentTime = new Date(entry.time_joined);
    const newTime = new Date(
      currentTime.getTime() - hoursToMove * 60 * 60 * 1000
    );

    // Update the time_joined
    const { error: updateError } = await supabase
      .from("waitlist")
      .update({ time_joined: newTime.toISOString() })
      .eq("user_id", userId);

    if (updateError) {
      console.error("Adjust waitlist position error:", updateError);
      return {
        status: 500,
        body: {
          success: false,
          error: updateError.message,
        },
      };
    }

    console.log(`Adjusted user ${userId} position by ${hoursToMove} hours`);
    return {
      status: 200,
      body: {
        success: true,
      },
    };
  } catch (err) {
    console.error("Adjust waitlist position error:", err);
    return {
      status: 500,
      body: {
        success: false,
        error: "Internal server error",
      },
    };
  }
}
