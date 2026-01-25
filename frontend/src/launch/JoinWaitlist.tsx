import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuthModal } from "../context/AuthModalContext";
import {
  joinWaitlist,
  isOnWaitlist,
  getTotalWaitlistCount,
} from "./waitlist_functions";
import "./Waitlist.css";
import { useUser } from "../context/useUser";
import FAQ from "./FAQ";

export default function JoinWaitlist() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { startLogin } = useAuthModal();
  const user = useUser();

  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabaseUserId = user.user?.id;

  // Referral code - pre-filled from query param (?ref=CODE)
  const initialReferralCode = searchParams.get("ref") || "";
  const [referralCode, setReferralCode] = useState(initialReferralCode);

  useEffect(() => {
    async function checkUserStatus() {
      setIsLoading(true);
      try {
        if (user && supabaseUserId) {
          // accessType is undefined during loading, null if no access, "paid"/"free" if has access
          if (user.accessType === "paid" || user.accessType === "free") {
            setHasSubscription(true);
          } else if (user.accessType === null) {
            // Only check waitlist status if they definitively don't have access
            const onWaitlist = await isOnWaitlist(supabaseUserId);
            if (onWaitlist) {
              // Redirect directly to their position page
              navigate(`/waitlist/${supabaseUserId}`, { replace: true });
              return;
            }
          }
          // If accessType is undefined, we're still loading - don't make decisions yet
        }
        const count = await getTotalWaitlistCount();
        setTotalCount(count);
      } catch (err) {
        console.error("Error checking user status:", err);
      } finally {
        setIsLoading(false);
      }
    }

    checkUserStatus();
  }, [user.accessType, supabaseUserId, navigate]);

  const handleJoinWaitlist = async () => {
    if (!supabaseUserId) {
      startLogin();
      return;
    }

    setIsJoining(true);
    setError(null);

    const result = await joinWaitlist(referralCode.trim() || undefined);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        navigate(`/waitlist/${supabaseUserId}`);
      }, 1500);
    } else {
      setError(result.error || "Failed to join waitlist");
    }

    setIsJoining(false);
  };

  if (isLoading) {
    return (
      <div className="waitlist-container">
        <div className="waitlist-content">
          <div className="waitlist-loading">
            <div className="waitlist-spinner" />
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="waitlist-container">
      <div className="waitlist-content">
        <header className="waitlist-header">
          <div className="waitlist-icon">🎮</div>
          <h1 className="waitlist-title">Join the Waitlist</h1>
          <p className="waitlist-subtitle">
            Be among the first to experience cloud gaming on MaddoxCloud. Join
            our waitlist and get early access when spots open up.
          </p>
          <Link to="/redeem" className="redeem-hint-card">
            <span className="redeem-hint-icon">🎟️</span>
            <span className="redeem-hint-text">
              <span className="redeem-hint-title">
                Already have an invite code?
              </span>
              <span className="redeem-hint-subtitle">
                Redeem it to skip the waitlist
              </span>
            </span>
            <span className="redeem-hint-arrow">→</span>
          </Link>
        </header>

        {!supabaseUserId ? (
          <div className="waitlist-login-prompt">
            <p className="login-prompt-text">
              Sign in to join the waitlist and secure your spot.
            </p>
            <button
              className="waitlist-button waitlist-button-primary"
              onClick={startLogin}
            >
              Sign In to Continue
            </button>
          </div>
        ) : hasSubscription ? (
          <div className="waitlist-join-card">
            <div className="waitlist-success">🎉 You already have access!</div>
            <p
              style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}
            >
              You already have access and can start playing right away. No need
              to join the waitlist!
            </p>
            <Link
              to="/"
              className="waitlist-button waitlist-button-primary"
              style={{ textDecoration: "none" }}
            >
              Start Playing
            </Link>
          </div>
        ) : (
          <div className="waitlist-join-card">
            {error && <div className="waitlist-error">{error}</div>}
            {success && (
              <div className="waitlist-success">
                🎉 You've joined the waitlist! Redirecting...
              </div>
            )}

            <div className="waitlist-benefits">
              <h3>What you'll get:</h3>
              <ul className="benefit-list">
                <li>
                  <span className="benefit-icon">✓</span>
                  Early access to cloud gaming
                </li>
                <li>
                  <span className="benefit-icon">✓</span>
                  Play Android games from any browser
                </li>
                <li>
                  <span className="benefit-icon">✓</span>
                  No expensive hardware needed
                </li>
                <li>
                  <span className="benefit-icon">✓</span>
                  Your own referral code to move up the queue
                </li>
              </ul>
            </div>

            {/* Referral Code Section */}
            <div className="referral-section">
              <div className="referral-input-wrapper">
                <label htmlFor="referral-code" className="referral-label">
                  Referral Code (optional)
                </label>
                <input
                  id="referral-code"
                  type="text"
                  className="referral-input"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  disabled={isJoining || success}
                />
                <p className="referral-hint">
                  Have a friend on the waitlist? Enter their referral code to
                  help them move up!
                </p>
              </div>
            </div>

            <button
              className="waitlist-button waitlist-button-primary"
              onClick={() => handleJoinWaitlist()}
              disabled={isJoining || success}
            >
              {isJoining ? (
                <>
                  <span
                    className="waitlist-spinner"
                    style={{ width: 20, height: 20 }}
                  />
                  Joining...
                </>
              ) : (
                "Join Waitlist"
              )}
            </button>

            {totalCount > 0 && (
              <p
                style={{
                  marginTop: "1rem",
                  color: "var(--text-muted)",
                  fontSize: "0.875rem",
                }}
              >
                {totalCount.toLocaleString()}{" "}
                {totalCount === 1 ? "person" : "people"} already waiting
              </p>
            )}
          </div>
        )}

        <FAQ />
      </div>
    </div>
  );
}
