import { useEffect, useState, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { trackPurchase, trackSubscribe } from "../utils/metaPixel";
import "./Pages.css";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
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

    // Fire Meta Pixel events with session_id for deduplication
    // TODO: Pass actual purchase value from Supabase verification
    trackSubscribe(sessionId);
    trackPurchase(sessionId);

    setStatus("success");
  }, [sessionId]);

  if (status === "loading") {
    return (
      <div className="page-container">
        <div className="page-content page-content-centered">
          <h1>Processing...</h1>
          <p className="page-subtitle">Please wait while we confirm your purchase.</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="page-container">
        <div className="page-content page-content-centered">
          <div className="page-status-icon page-status-error">!</div>
          <h1>Something went wrong</h1>
          <section className="page-section">
            <p>
              We couldn't verify your purchase. If you completed payment, your
              subscription should be active. Try playing a game or check your email
              for confirmation.
            </p>
          </section>
          <Link to="/" className="page-cta-button">
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-content page-content-centered">
        <div className="page-status-icon page-status-success">✓</div>
        <h1>Payment Successful!</h1>
        <section className="page-section">
          <p>
            Thank you for subscribing to MaddoxCloud. You now have full access
            to all games. Start playing your favorites right now!
          </p>
        </section>
        <Link to="/" className="page-cta-button">
          Start Playing
        </Link>
      </div>
    </div>
  );
}
