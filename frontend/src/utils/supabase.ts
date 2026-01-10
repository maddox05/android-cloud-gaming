import { createClient } from "@supabase/supabase-js";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { config } from "../config";

// Export supabase client for use by other modules (e.g., waitlist_functions.ts)
export const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

// ============================================================================
// Re-export waitlist functions for backwards compatibility
// ============================================================================

export {
  // Types
  type WaitlistPosition,
  type JoinWaitlistResult,
  type RedeemInviteResult,
  // Public functions
  joinWaitlist,
  getWaitlistPosition,
  isOnWaitlist,
  getTotalWaitlistCount,
  getUserInviteCode,
  removeSelfFromWaitlist,
  redeemInviteCode,
} from "./waitlist_functions";

// ============================================================================
// API FUNCTIONS (calls to signal server)
// ============================================================================

export interface AccessCheckResult {
  hasAccess: boolean;
  reason?: string;
  message?: string;
  userId?: string;
}

/*
 * Check if the current user has access to the platform (subscription or free access).
 * Calls the signal server API which verifies with Stripe.
 */
export async function checkUserAccess(): Promise<AccessCheckResult> {
  const token = await getAccessToken();
  
  if (!token) {
    return { hasAccess: false, reason: "not_logged_in" };
  }

  // Convert WebSocket URL to HTTP URL
  const apiUrl = config.SIGNAL_URL.replace("ws://", "http://").replace("wss://", "https://");

  try {
    const response = await fetch(`${apiUrl}/api/check-access`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const data = await response.json();
      return { hasAccess: false, reason: data.reason, message: data.message };
    }

    return await response.json();
  } catch (err) {
    console.error("Check access error:", err);
    return { hasAccess: false, reason: "network_error", message: "Failed to check access" };
  }
}

// ============================================================================
// AUTH FUNCTIONS
// ============================================================================

export { supabase };

export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getSession(): Promise<Session | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.access_token ?? null;
}

export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.host + window.location.pathname,
    },
  });

  if (error) {
    console.error("Sign in error:", error);
    throw error;
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Sign out error:", error);
    throw error;
  }
}

export async function signUpWithEmail(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.host + window.location.pathname,
    },
  });

  if (error) {
    console.error("Sign up error:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("Sign in error:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function isLoggedIn(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}
