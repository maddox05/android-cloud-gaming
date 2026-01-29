import { getAccessToken } from "./supabase";
import { config } from "../consts";
import type { AccessType } from "../../../shared/types";
import axios from "axios";
/**
 * Check if the current user has a password set (via signal server)
 * Returns true if encrypted_password is not null in auth.users
 */
export async function checkHasPassword(): Promise<boolean> {
  try {
    const token = await getAccessToken();
    if (!token) return false;

    const response = await fetch(
      `${config.SIGNAL_HTTP_URL}/hasPassword?token=${encodeURIComponent(
        token
      )}`,
      { method: "GET" }
    );

    if (!response.ok) return false;

    const data = await response.json();
    return data.hasPassword === true;
  } catch (error) {
    console.error("Error checking password status:", error);
    return false;
  }
}

export async function fetchAccessType(
  token: string
): Promise<AccessType | undefined> {
  try {
    const response = await axios.get(
      `${config.SIGNAL_HTTP_URL}/userAccess?token=${encodeURIComponent(token)}`,
      { timeout: 10000 }
    );
    return response.data.accessType as AccessType;
  } catch (error) {
    console.error("Error fetching access type:", error);
    return undefined;
  }
}
