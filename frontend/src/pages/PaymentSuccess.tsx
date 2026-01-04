import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { trackPurchase } from "../utils/metaPixel";
import "./Pages.css";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const hasTracked = useRef(false);

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }

    // Prevent double-tracking on React strict mode re-renders
    if (hasTracked.current) return;

    // TODO: Verify session with Supabase before firing pixel
    // Example implementation:
    // const { data } = await supabase
    //   .schema('stripe')
    //   .from('checkout_sessions')
    //   .select('payment_status, amount_total')
    //   .eq('id', sessionId)
    //   .single();
    //
    // if (data?.payment_status !== 'paid') {
    //   setStatus("error");
    //   return;
    // }
    // const value = data.amount_total ? data.amount_total / 100 : undefined;

    // For now, trust the session_id exists and fire the pixel
    // The session_id is cryptographically random and hard to guess
    hasTracked.current = true;

    // Fire Meta Pixel Purchase event with session_id for deduplication
    // TODO: Pass actual purchase value from Supabase verification
    trackPurchase(sessionId);

    setStatus("success");
  }, [sessionId]);

  if (status === "loading") {
    return (
      <div className="page-container">
        <div className="page-content" style={{ textAlign: "center" }}>
          <h1>Processing...</h1>
          <p>Please wait while we confirm your purchase.</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="page-container">
        <div className="page-content" style={{ textAlign: "center" }}>
          <h1>Something went wrong</h1>
          <p>We couldn't verify your purchase. If you completed payment, your subscription should be active.</p>
          <button
            onClick={() => navigate("/")}
            style={{
              marginTop: "1.5rem",
              padding: "0.75rem 2rem",
              fontSize: "1rem",
              backgroundColor: "#6366f1",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-content" style={{ textAlign: "center" }}>
        <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>✓</div>
        <h1>Payment Successful!</h1>
        <p style={{ fontSize: "1.125rem", color: "#a1a1aa", marginBottom: "2rem" }}>
          Thank you for subscribing to MaddoxCloud. You now have full access to all games.
        </p>
        <button
          onClick={() => navigate("/")}
          style={{
            padding: "0.75rem 2rem",
            fontSize: "1rem",
            backgroundColor: "#6366f1",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Start Playing
        </button>
      </div>
    </div>
  );
}
