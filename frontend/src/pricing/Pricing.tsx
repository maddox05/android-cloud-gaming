import { useEffect, useState } from "react";
import {
  getCurrentUser,
  onAuthStateChange,
} from "../utils/supabase";
import { useAuth } from "../context/AuthContext";
import type { User } from "@supabase/supabase-js";
import ComparisonTable from "./ComparisonTable";
import { trackViewContent } from "../utils/metaPixel";
import "./Pricing.css";

export default function Pricing() {
  const [user, setUser] = useState<User | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const { startLogin } = useAuth();

  useEffect(() => {
    const scriptId = "stripe-pricing-table-script";
    const existingScript = document.getElementById(scriptId);

    if (existingScript) {
      // Script already exists, check if it's loaded
      if (existingScript.getAttribute("data-loaded") === "true") {
        setScriptLoaded(true);
      } else {
        existingScript.addEventListener("load", () => setScriptLoaded(true));
      }
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://js.stripe.com/v3/pricing-table.js";
    script.async = true;
    script.onload = () => {
      script.setAttribute("data-loaded", "true");
      setScriptLoaded(true);
    };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    getCurrentUser().then(setUser);

    const unsubscribe = onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return unsubscribe;
  }, []);

  // Track pricing page view for Meta Pixel
  useEffect(() => {
    trackViewContent("Pricing Page");
  }, []);

  return (
    <div className="pricing-page">
      <div className="pricing-header">
        <h1>Choose Your Plan</h1>
        <p>Lock in your early access pricing before we launch to the public!</p>
      </div>

      <div className="pricing-container" style={{ position: "relative" }}>
        {!user && (
          <div
            className="login-overlay"
            onClick={startLogin}
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
        {scriptLoaded && (
          // @ts-expect-error stripe-pricing-table is a custom element
          <stripe-pricing-table
            key={user?.id ?? "anonymous"}
            pricing-table-id="prctbl_1Sibp9Io5niLkgKCQoirRLr0"
            publishable-key="pk_live_51ShAGcIo5niLkgKCCwvIhzBqI2xLDdOZ3CxzDEwegRTHpfWzCwJkyTBc7cGNhlF9Tej0O5nmc7jQ2uJr2TJiOgSw00aACeMl1e"
            client-reference-id={user?.id}
            customer-email={user?.email}
          />
        )}
      </div>

      <ComparisonTable />
    </div>
  );
}
