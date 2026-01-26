/**
 * Waitlist Endpoints Module
 * Handles joining the waitlist and generating invite codes for waitlist users
 */

import { verifyToken } from "./db/auth.js";
import { getSupabase } from "./db/supabase.js";
import nodemailer from "nodemailer";

// ============================================================================
// Email Configuration
// ============================================================================

const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function buildInviteEmail(inviteCode: string): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "🎉 You're In! Your MaddoxCloud Invite Code Is Here 🎉";

  const redeemUrl = `https://maddoxcloud.com/redeem/${inviteCode}`;

  const text = `You've officially unlocked MaddoxCloud Early Access.

👉 Click here to redeem: ${redeemUrl}

Or use code: ${inviteCode}

This is early early access, so we'd love your feedback.
Found a bug? Got ideas?
👉 Report it here: https://github.com/maddox05/android-cloud-gaming/issues or drop it in the Discord.

You can also trade or give away this code, anyone can use it!

This is a community-built project, meaning the more you help, the better it gets 🚀
If you're enjoying it, share your ref code with friends and get them involved too.

Peace,
– Maddox (https://maddox.page/)`;

  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <p>You've officially unlocked <strong>MaddoxCloud Early Access</strong>.</p>

  <p style="text-align: center; margin: 24px 0;">
    <a href="${redeemUrl}" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #dc6c12 100%); color: white; font-size: 18px; font-weight: bold; padding: 16px 32px; border-radius: 8px; text-decoration: none;">
      🎉 Click to Redeem Your Code
    </a>
  </p>

  <p style="font-size: 14px; background: #f0f0f0; padding: 12px; border-radius: 8px; text-align: center;">
    Or use code: <code style="font-size: 14px; color: #333;">${inviteCode}</code>
  </p>

  <p>This is early early access, so we'd love your feedback.<br>
  Found a bug? Got ideas?<br>
  👉 Report it <a href="https://github.com/maddox05/android-cloud-gaming/issues">here</a> or drop it in the Discord.</p>

  <p>You can also trade or give away this code, anyone can use it!</p>

  <p>This is a community-built project, meaning the more you help, the better it gets 🚀<br>
  If you're enjoying it, share your ref code with friends and get them involved too.</p>

  <p>Peace,<br>
  – <a href="https://maddox.page/">Maddox</a></p>
</div>`;

  return { subject, html, text };
}

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
  referralCode?: string,
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
          WAITLIST_CONFIG.NEW_USER_BONUS_HOURS * 60 * 60 * 1000,
      );
    }

    // Insert the new waitlist entry
    const { data: insertData, error: insertError } = await supabase
      .from("waitlist")
      .insert({
        user_id: user.id,
        // time_joined: timeJoined.toISOString(), // todo ri\ght here if wanted we can also reward user who has USED a ref code (if ref code is not null)
        // referral code generated by supabase
        referral_code_used_to_join: referralCode || null,
      })
      .select("referral_code")
      .single();

    const newReferralCode = insertData?.referral_code;

    if (insertError || !newReferralCode) {
      if (insertError?.code === "23505") {
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
          error: insertError?.message || "Failed to generate referral code",
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
            WAITLIST_CONFIG.REFERRER_REWARD_HOURS * 60 * 60 * 1000,
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
            `Rewarded referrer ${referrerId} with ${WAITLIST_CONFIG.REFERRER_REWARD_HOURS} hour(s) boost`,
          );
        }
      }
    }

    console.log(
      `User ${user.id} joined waitlist with referral code ${newReferralCode}`,
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

/**
 * Take the first N users off the waitlist, generate invite codes, and email them
 *
 * @param count - Number of users to process (capped at 100)
 * @returns Object with processed users and any errors
 */
export async function generateInvites(count: number): Promise<{
  processed: Array<{ user_id: string; email: string; invite_code: string }>;
  errors: Array<{ user_id: string; error: string }>;
}> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Database not configured");
  }

  // Get the first N users from waitlist, ordered by time_joined (earliest first)
  const { data: waitlistUsers, error: fetchError } = await supabase
    .from("waitlist")
    .select("user_id")
    .order("time_joined", { ascending: true })
    .limit(count);
  // const waitlistUsers = [{ user_id: "01b0b7b6-b660-43a5-b84d-1d5bda9d7aa6" }];
  // const fetchError = null;

  if (fetchError) {
    throw new Error(`Failed to fetch waitlist: ${fetchError.message}`);
  }

  if (!waitlistUsers || waitlistUsers.length === 0) {
    return { processed: [], errors: [] };
  }

  const processed: Array<{
    user_id: string;
    email: string;
    invite_code: string;
  }> = [];
  const errors: Array<{ user_id: string; error: string }> = [];

  for (const waitlistUser of waitlistUsers) {
    const userId = waitlistUser.user_id;

    // Get user email
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const email = userData?.user?.email;
    if (!email) {
      errors.push({ user_id: userId, error: "No email found" });
      continue;
    }

    // Insert into invite_codes table
    const { data: inviteData, error: insertError } = await supabase
      .from("invite_codes")
      .insert({ assigned_to: userId })
      .select("invite_code")
      .single();

    if (insertError || !inviteData) {
      errors.push({
        user_id: userId,
        error: `Failed to create invite: ${insertError?.message}`,
      });
      continue;
    }

    const inviteCode = inviteData.invite_code;

    // Send email
    const emailContent = buildInviteEmail(inviteCode);
    try {
      await emailTransporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
      });
      console.log(`Sent invite email to ${email} with code ${inviteCode}`);
    } catch (emailError) {
      throw new Error(`Failed to send email to ${email}: ${emailError}`);
    }

    // Remove from waitlist only after successful email
    const { error: deleteError } = await supabase
      .from("waitlist")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      throw new Error(
        `Failed to remove ${userId} from waitlist: ${deleteError.message}`,
      );
    }

    processed.push({ user_id: userId, email, invite_code: inviteCode });
    console.log(`Generated and emailed invite for ${email}: ${inviteCode}`);
  }

  return { processed, errors };
}

// generateInvites(200); // tsx --env-file=./.env ./signal/waitlist_endpoints.ts
