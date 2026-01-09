import { supabase, getCurrentUser, getAccessToken } from "./supabase";
import { config } from "../config";

// ============================================================================
// WAITLIST TYPES
// ============================================================================

export interface WaitlistPosition {
  user_id: string;
  position: number;
  time_joined: string;
  invite_code: string | null;
}

export interface JoinWaitlistResult {
  success: boolean;
  error?: string;
  invite_code?: string;
}

// ============================================================================
// WAITLIST PUBLIC FUNCTIONS
// ============================================================================

/*
 * Allows the user to join the waitlist with an optional referral code.
 * 
 * This calls the backend API because:
 * - RLS prevents frontend from validating other users' referral codes
 * - Backend uses service key which bypasses RLS
 * 
 * - Generates a unique invite code for the new user
 * - If a referral code is provided and valid:
 *   - Rewards the referrer by moving them up in the queue
 *   - Optionally gives the new user a bonus (configurable)
 *   - Records which code was used to join
 * - Returns an error if user is already on the waitlist
 * - Returns an error if referral code is invalid
 */
export async function joinWaitlist(
  referralCode?: string
): Promise<JoinWaitlistResult> {
  const token = await getAccessToken();
  
  if (!token) {
    return { success: false, error: "You must be logged in to join the waitlist" };
  }

  // Convert WebSocket URL to HTTP URL
  const apiUrl = config.SIGNAL_URL.replace("ws://", "http://").replace("wss://", "https://");

  try {
    const response = await fetch(`${apiUrl}/api/join-waitlist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ referral_code: referralCode }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || "Failed to join waitlist" };
    }

    return { success: true, invite_code: data.invite_code };
  } catch (err) {
    console.error("Join waitlist error:", err);
    return { success: false, error: "Network error - please try again" };
  }
}

/*
 * Gets a user's position in the waitlist, including their invite code.
 * 
 * Position is calculated dynamically by counting users with earlier time_joined.
 * This means positions automatically update when:
 * - Users are removed from the waitlist
 * - Users' time_joined is adjusted (via referrals)
 * 
 * TODO: For real-time position updates, consider using Supabase Realtime
 * to subscribe to changes on the waitlist table.
 */
export async function getWaitlistPosition(userId: string): Promise<WaitlistPosition | null> {
  // Get the user's entry including their invite code
  const { data: userEntry, error: userError } = await supabase
    .from("waitlist")
    .select("user_id, time_joined, invite_code")
    .eq("user_id", userId)
    .single();

  if (userError || !userEntry) {
    console.error("Get waitlist entry error:", userError);
    return null;
  }

  // Count how many users joined before this user
  const { count, error: countError } = await supabase
    .from("waitlist")
    .select("*", { count: "exact", head: true })
    .lt("time_joined", userEntry.time_joined);

  if (countError) {
    console.error("Get waitlist position error:", countError);
    return null;
  }

  return {
    user_id: userEntry.user_id,
    position: (count ?? 0) + 1,
    time_joined: userEntry.time_joined,
    invite_code: userEntry.invite_code,
  };
}

/*
 * Checks if a user is on the waitlist.
 */
export async function isOnWaitlist(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("waitlist")
    .select("user_id")
    .eq("user_id", userId)
    .single();

  return !error && data !== null;
}

/*
 * Gets the total number of users in the waitlist.
 */
export async function getTotalWaitlistCount(): Promise<number> {
  const { count, error } = await supabase
    .from("waitlist")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("Get waitlist count error:", error);
    return 0;
  }

  return count ?? 0;
}

/*
 * Gets a user's invite code without fetching their full position.
 * Useful for displaying the code on the UI.
 */
export async function getUserInviteCode(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("waitlist")
    .select("invite_code")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.invite_code;
}

/*
 * Allows a user to remove themselves from the waitlist.
 * 
 * Security: This function verifies that the currently logged-in user
 * matches the userId being removed, so users can only remove themselves.
 */
export async function removeSelfFromWaitlist(): Promise<{ success: boolean; error?: string }> {
  // Get the current user
  const currentUser = await getCurrentUser();
  
  if (!currentUser) {
    return { success: false, error: "You must be logged in to leave the waitlist" };
  }

  // Delete only the current user's entry
  const { error } = await supabase
    .from("waitlist")
    .delete()
    .eq("user_id", currentUser.id);

  if (error) {
    console.error("Remove self from waitlist error:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ============================================================================
// INVITE CODE REDEMPTION
// ============================================================================

export interface RedeemInviteResult {
  success: boolean;
  error?: string;
  message?: string;
}

/*
 * Redeems an invite code for the current user.
 * Calls the signal server API which validates and updates the invite_codes table.
 * 
 * @param inviteCode - The UUID invite code to redeem
 */
export async function redeemInviteCode(inviteCode: string): Promise<RedeemInviteResult> {
  const token = await getAccessToken();
  
  if (!token) {
    return { success: false, error: "You must be logged in to redeem an invite code" };
  }

  // Convert WebSocket URL to HTTP URL
  const apiUrl = config.SIGNAL_URL.replace("ws://", "http://").replace("wss://", "https://");

  try {
    const response = await fetch(`${apiUrl}/api/redeem-invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ invite_code: inviteCode }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || "Failed to redeem invite code" };
    }

    return { success: true, message: data.message };
  } catch (err) {
    console.error("Redeem invite error:", err);
    return { success: false, error: "Network error - please try again" };
  }
}

