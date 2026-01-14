import { createClient } from "@supabase/supabase-js";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { config } from "../config";

// Export supabase client for use by other modules (e.g., waitlist_functions.ts)
export const supabase = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_ANON_KEY
);

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
      redirectTo: window.location.origin + window.location.pathname,
    },
  });

  if (error) {
    console.error("Sign in error:", error);
    throw error;
  }
}

export async function signInWithMicrosoft(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: {
      scopes: "email",
      redirectTo: window.location.origin + window.location.pathname,
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
      emailRedirectTo: window.location.origin + window.location.pathname,
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

// ============================================
// Account Linking Utilities
// ============================================

/**
 * Get list of providers linked to the user account
 * Returns provider names from user.identities array
 */
export function getLinkedProviders(user: User | null): string[] {
  if (!user?.identities) return [];
  return user.identities.map((identity) => identity.provider);
}

/**
 * Check if a specific provider is linked to the user account
 */
export function isProviderLinked(user: User | null, provider: string): boolean {
  return getLinkedProviders(user).includes(provider);
}

/**
 * Link Google OAuth identity to existing account
 */
export async function linkGoogleIdentity(): Promise<{
  success: boolean;
  error?: string;
}> {
  const { error } = await supabase.auth.linkIdentity({
    provider: "google",
    options: {
      redirectTo: window.location.origin + window.location.pathname,
    },
  });

  if (error) {
    console.error("Link Google error:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Link Microsoft/Azure OAuth identity to existing account
 */
export async function linkAzureIdentity(): Promise<{
  success: boolean;
  error?: string;
}> {
  const { error } = await supabase.auth.linkIdentity({
    provider: "azure",
    options: {
      scopes: "email",
      redirectTo: window.location.origin + window.location.pathname,
    },
  });

  if (error) {
    console.error("Link Azure error:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Add email/password authentication to existing OAuth account
 * Uses updateUser to set a password for the account
 */
export async function addPasswordToAccount(
  password: string
): Promise<{ success: boolean; error?: string }> {
  if (password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters" };
  }

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    console.error("Add password error:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
