import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { redeemInviteCode } from "../utils/supabase";
import { useAuthModal } from "../context/AuthModalContext";
import { useUser } from "../context/UserContext";
import "./RedeemInvite.css";

export default function RedeemInvite() {
  const { inviteCode: urlInviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { startLogin } = useAuthModal();
  const user = useUser();

  const [inviteCode, setInviteCode] = useState(urlInviteCode || "");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Redirect users who already have access to home page
  useEffect(() => {
    if (user.accessType !== null) {
      navigate("/", { replace: true });
    }
  }, [user.accessType, navigate]);

  const handleRedeem = async () => {
    if (!inviteCode.trim()) {
      setError("Please enter an invite code");
      return;
    }

    setError(null);
    setIsRedeeming(true);

    try {
      const result = await redeemInviteCode(inviteCode.trim());

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || "Failed to redeem invite code");
      }
    } catch (err) {
      console.error("Redeem error:", err);
      setError("An unexpected error occurred");
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleLogin = () => {
    startLogin();
  };

  // Success state
  if (success) {
    return (
      <div className="redeem-container">
        <div className="redeem-content">
          <div className="redeem-card">
            <div className="redeem-icon redeem-icon-success">🎉</div>
            <h1 className="redeem-title">Welcome!</h1>
            <p className="redeem-subtitle">
              Your invite code has been redeemed successfully. You now have full
              access to the platform!
            </p>
            <button
              className="redeem-button redeem-button-primary"
              onClick={() => navigate("/")}
            >
              Start Playing
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user.user?.id) {
    return (
      <div className="redeem-container">
        <div className="redeem-content">
          <header className="redeem-header">
            <div className="redeem-icon">🎫</div>
            <h1 className="redeem-title">Redeem Your Invite</h1>
            <p className="redeem-subtitle">
              You've been invited to join! Sign in to redeem your access code.
            </p>
          </header>

          <div className="redeem-card">
            {urlInviteCode && (
              <div className="redeem-code-preview">
                <span className="code-preview-label">Your invite code:</span>
                <span className="code-preview-value">{urlInviteCode}</span>
              </div>
            )}
            <p className="login-prompt-text">
              Please sign in to redeem your invite code and get access.
            </p>
            <button
              className="redeem-button redeem-button-primary"
              onClick={handleLogin}
            >
              Sign In to Redeem
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main redeem form
  return (
    <div className="redeem-container">
      <div className="redeem-content">
        <header className="redeem-header">
          <div className="redeem-icon">🎫</div>
          <h1 className="redeem-title">Redeem Your Invite</h1>
          <p className="redeem-subtitle">
            Enter your invite code below to unlock access to the platform.
          </p>
        </header>

        <div className="redeem-card">
          {error && <div className="redeem-error">{error}</div>}

          <div className="redeem-form">
            <label htmlFor="invite-code" className="redeem-label">
              Invite Code
            </label>
            <input
              id="invite-code"
              type="text"
              className="redeem-input"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              disabled={isRedeeming}
            />
            <p className="redeem-hint">
              This is the code you received via email when you were selected
              from the waitlist.
            </p>
          </div>

          <button
            className="redeem-button redeem-button-primary"
            onClick={handleRedeem}
            disabled={isRedeeming || !inviteCode.trim()}
          >
            {isRedeeming ? "Redeeming..." : "Redeem Invite Code"}
          </button>
        </div>

        <div className="redeem-info">
          <p>
            Don't have an invite code? <a href="/waitlist">Join the waitlist</a>{" "}
            to get early access.
          </p>
        </div>
      </div>
    </div>
  );
}
