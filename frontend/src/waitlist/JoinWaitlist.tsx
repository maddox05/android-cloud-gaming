import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getCurrentUser,
  joinWaitlist,
  isOnWaitlist,
  getTotalWaitlistCount,
  checkUserAccess,
} from "../utils/supabase";
import "./Waitlist.css";

export default function JoinWaitlist() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { startLogin } = useAuth();

  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [alreadyOnWaitlist, setAlreadyOnWaitlist] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Referral code - can be pre-filled from URL param (?ref=CODE)
  const [referralCode, setReferralCode] = useState(searchParams.get("ref") || "");
  const [showReferralInput, setShowReferralInput] = useState(!!searchParams.get("ref"));

  useEffect(() => {
    async function checkUserStatus() {
      setIsLoading(true);
      try {
        const user = await getCurrentUser();
        if (user) {
          setUserId(user.id);
          
          // Check if user already has subscription access
          const accessResult = await checkUserAccess();
          if (accessResult.hasAccess) {
            setHasSubscription(true);
          } else {
            // Only check waitlist status if they don't have subscription
            const onWaitlist = await isOnWaitlist(user.id);
            setAlreadyOnWaitlist(onWaitlist);
          }
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
  }, []);

  const handleJoinWaitlist = async () => {
    if (!userId) {
      startLogin();
      return;
    }

    setIsJoining(true);
    setError(null);

    const result = await joinWaitlist(referralCode.trim() || undefined);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        navigate(`/waitlist/${userId}`);
      }, 1500);
    } else {
      setError(result.error || "Failed to join waitlist");
    }

    setIsJoining(false);
  };

  const handleViewPosition = () => {
    if (userId) {
      navigate(`/waitlist/${userId}`);
    }
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
            Be among the first to experience cloud gaming on MaddoxCloud.
            Join our waitlist and get early access when spots open up.
          </p>
        </header>

        {!userId ? (
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
            <div className="waitlist-success">
              🎉 You already have access!
            </div>
            <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
              You have an active subscription and can start playing right away. No need to join the waitlist!
            </p>
            <Link to="/" className="waitlist-button waitlist-button-primary" style={{ textDecoration: "none" }}>
              Start Playing
            </Link>
          </div>
        ) : alreadyOnWaitlist ? (
          <div className="waitlist-join-card">
            <div className="waitlist-success">
              ✓ You're already on the waitlist!
            </div>
            <button
              className="waitlist-button waitlist-button-primary"
              onClick={handleViewPosition}
            >
              View Your Position
            </button>
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
              {!showReferralInput ? (
                <button
                  type="button"
                  className="referral-toggle"
                  onClick={() => setShowReferralInput(true)}
                >
                  Have a referral code?
                </button>
              ) : (
                <div className="referral-input-wrapper">
                  <label htmlFor="referral-code" className="referral-label">
                    Referral Code (optional)
                  </label>
                  <input
                    id="referral-code"
                    type="text"
                    className="referral-input"
                    placeholder="Enter code (e.g., MX7K2P)"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    maxLength={10}
                    disabled={isJoining || success}
                  />
                </div>
              )}
            </div>

            <button
              className="waitlist-button waitlist-button-primary"
              onClick={handleJoinWaitlist}
              disabled={isJoining || success}
            >
              {isJoining ? (
                <>
                  <span className="waitlist-spinner" style={{ width: 20, height: 20 }} />
                  Joining...
                </>
              ) : (
                "Join Waitlist"
              )}
            </button>

            {totalCount > 0 && (
              <p style={{ marginTop: "1rem", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                {totalCount.toLocaleString()} {totalCount === 1 ? "person" : "people"} already waiting
              </p>
            )}
          </div>
        )}

        <div className="waitlist-info">
          <p>
            Have a payment code?{" "}
            <a href="/pricing">Skip the waitlist</a> and get immediate access.
            Questions? Join our{" "}
            <a href="https://discord.gg/U4QYdzXEnr" target="_blank" rel="noopener noreferrer">
              Discord community
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
}
