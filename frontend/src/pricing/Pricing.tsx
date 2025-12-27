import { useEffect, useState, useRef } from "react";
import { getCurrentUser, signInWithGoogle, onAuthStateChange } from "../utils/supabase";
import type { User } from "@supabase/supabase-js";
import "./Pricing.css";

export default function Pricing() {
  const [user, setUser] = useState<User | null>(null);
  const tableRef = useRef<HTMLElement>(null);

  useEffect(() => {
    getCurrentUser().then(setUser);

    const unsubscribe = onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (tableRef.current && user) {
      tableRef.current.setAttribute("client-reference-id", user.id);
      if (user.email) {
        tableRef.current.setAttribute("customer-email", user.email);
      }
    }
  }, [user]);

  const handleOverlayClick = async () => {
    await signInWithGoogle();
  };

  return (
    <div className="pricing-page">
      <div className="pricing-header">
        <h1>Choose Your Plan</h1>
        <p>Unlock premium cloud gaming with faster streaming and priority access.</p>
      </div>

      <div className="pricing-container" style={{ position: "relative" }}>
        {!user && (
          <div
            className="login-overlay"
            onClick={handleOverlayClick}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 10,
              cursor: "pointer",
            }}
          />
        )}
        {/* @ts-ignore */}
        <stripe-pricing-table
          ref={tableRef}
          pricing-table-id="prctbl_1Sibp9Io5niLkgKCQoirRLr0"
          publishable-key="pk_live_51ShAGcIo5niLkgKCCwvIhzBqI2xLDdOZ3CxzDEwegRTHpfWzCwJkyTBc7cGNhlF9Tej0O5nmc7jQ2uJr2TJiOgSw00aACeMl1e"
        />
      </div>
    </div>
  );
}
