import {
  createContext,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import axios from "axios";
import type { User } from "@supabase/supabase-js";
import type { AccessType } from "../../../shared/types";
import { getAccessToken, onAuthStateChange } from "../utils/supabase";
import { config } from "../config";

interface UserContextValue {
  user: User | null;
  accessType: AccessType | undefined; // access type is undefined on default and null if the user doesnt have access
  isLoading: boolean;
  isPaid: boolean;
  isFree: boolean;
  refetchAccessType: () => Promise<void>;
}

export const UserContext = createContext<UserContextValue | null>(null);

const { SIGNAL_HTTP_URL } = config;

// Module-level cache to prevent duplicate fetches (survives hot reload)
let cachedUserId: string | null = null;
let cachedAccessType: AccessType | undefined = undefined;

async function fetchAccessType(token: string): Promise<AccessType | undefined> {
  try {
    const response = await axios.get(
      `${SIGNAL_HTTP_URL}/userAccess?token=${encodeURIComponent(token)}`,
      { timeout: 10000 }
    );
    return response.data.accessType as AccessType;
  } catch (error) {
    console.error("Error fetching access type:", error);
    return undefined;
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  // Initialize from cache if available (survives hot reload)
  const [user, setUser] = useState<User | null>(null);
  const [accessType, setAccessType] = useState<AccessType | undefined>(
    cachedAccessType
  );
  const [isLoading, setIsLoading] = useState(true);

  const refetchAccessType = async () => {
    const token = await getAccessToken();
    if (token) {
      const type = await fetchAccessType(token);
      setAccessType(type);
      cachedAccessType = type;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (event, session) => {
      console.log("[UserContext] Auth event:", event);

      const newUser = session?.user ?? null;
      setUser(newUser);

      // If user signed out, clear everything
      if (!newUser) {
        setAccessType(undefined);
        cachedUserId = null;
        cachedAccessType = null;
        setIsLoading(false);
        return;
      }

      // Skip if we've already fetched for this exact user (module-level cache)
      if (cachedUserId === newUser.id && cachedAccessType !== undefined) {
        console.log(
          "[UserContext] Using cached access type for user:",
          newUser.id
        );
        setAccessType(cachedAccessType);
        setIsLoading(false);
        return;
      }

      // // Skip TOKEN_REFRESHED - we already have the data
      // if (event === "TOKEN_REFRESHED") {
      //   console.log("[UserContext] Skipping TOKEN_REFRESHED");
      //   setIsLoading(false);
      //   return;
      // }

      // Fetch access type for this user
      if (session?.access_token) {
        console.log("[UserContext] Fetching access type for user:", newUser.id);
        const type = await fetchAccessType(session.access_token);
        setAccessType(type);
        cachedUserId = newUser.id;
        cachedAccessType = type;
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const contextValue = useMemo(
    () => ({
      user,
      accessType,
      isLoading,
      isPaid: accessType === "paid",
      isFree: accessType === "free",
      refetchAccessType,
    }),
    [user, accessType, isLoading]
  );

  return (
    <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
  );
}
