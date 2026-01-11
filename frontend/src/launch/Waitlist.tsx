import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  getWaitlistPosition,
  getTotalWaitlistCount,
  removeSelfFromWaitlist,
  type WaitlistPosition,
} from "./waitlist_functions";
import { getCurrentUser } from "../utils/supabase";
import "./Waitlist.css";

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function calculateTimeJumped(createdAt: string, timeJoined: string): number {
  const created = new Date(createdAt).getTime();
  const joined = new Date(timeJoined).getTime();
  const diffMs = created - joined;
  // Each referral subtracts 1 hour, so diff in hours = number of referrals used
  return Math.round(diffMs / (1000 * 60 * 60));
}

function formatTimeJumped(hours: number): string {
  if (hours === 0) return "";
  if (hours === 1) return "1 hour";
  if (hours < 24) return `${hours} hours`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours === 0) {
    return days === 1 ? "1 day" : `${days} days`;
  }
  return days === 1
    ? `1 day, ${remainingHours} hour${remainingHours > 1 ? "s" : ""}`
    : `${days} days, ${remainingHours} hour${remainingHours > 1 ? "s" : ""}`;
}

export default function Waitlist() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [position, setPosition] = useState<WaitlistPosition | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!userId) {
        navigate("/waitlist", { replace: true });
        return;
      }

      setIsLoading(true);
      try {
        const currentUser = await getCurrentUser();

        // Redirect non-owners to the join page
        if (currentUser?.id !== userId) {
          navigate("/waitlist", { replace: true });
          return;
        }

        const [positionData, count] = await Promise.all([
          getWaitlistPosition(userId),
          getTotalWaitlistCount(),
        ]);

        setPosition(positionData);
        setTotalCount(count);
      } catch (err) {
        console.error("Error fetching waitlist data:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [userId, navigate]);

  const handleCopyCode = async () => {
    if (!position?.referral_code) return;
    try {
      await navigator.clipboard.writeText(position.referral_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleCopyReferralLink = async () => {
    if (!position?.referral_code) return;
    const referralUrl = `${window.location.origin}/waitlist?ref=${position.referral_code}`;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleLeaveWaitlist = async () => {
    setIsLeaving(true);
    setLeaveError(null);

    const result = await removeSelfFromWaitlist();

    if (result.success) {
      // Redirect to the join page after leaving
      navigate("/waitlist");
    } else {
      setLeaveError(result.error || "Failed to leave waitlist");
      setIsLeaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="waitlist-container">
        <div className="waitlist-content">
          <div className="waitlist-loading">
            <div className="waitlist-spinner" />
            <p>Loading your position...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!position) {
    return (
      <div className="waitlist-container">
        <div className="waitlist-content">
          <div className="waitlist-not-found">
            <div className="not-found-icon">🔍</div>
            <h2 className="not-found-title">Not on Waitlist</h2>
            <p className="not-found-message">
              This user isn't on the waitlist yet.
            </p>
            <button
              className="waitlist-button waitlist-button-primary"
              onClick={() => navigate("/waitlist")}
            >
              Join the Waitlist
            </button>
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
          <h1 className="waitlist-title">Your Waitlist Position</h1>
          <p className="waitlist-subtitle">
            You're on the list! We'll notify you when it's your turn.
          </p>
        </header>

        <div className="waitlist-position-card">
          <p className="position-label">Position in Line</p>
          <div className="position-number">#{position.position}</div>
          <p className="position-suffix">
            {position.position}
            {getOrdinalSuffix(position.position)} in queue
          </p>

          <div className="position-meta">
            <div className="meta-item">
              <div className="meta-value">{totalCount.toLocaleString()}</div>
              <div className="meta-label">Total in waitlist</div>
            </div>
            <div className="meta-item">
              <div className="meta-value">
                {formatDate(position.created_at)}
              </div>
              <div className="meta-label">Joined on</div>
            </div>
            <div className="meta-item">
              <div className="meta-value">
                {formatTimeJumped(
                  calculateTimeJumped(position.created_at, position.time_joined)
                ) || "0 hours"}
              </div>
              <div className="meta-label">Time jumped from referrals</div>
            </div>
          </div>
        </div>

        {/* Referral Code Section */}
        {position.referral_code && (
          <div className="referral-code-card">
            <div className="referral-code-header">
              <span className="referral-code-icon">🎁</span>
              <h3>Your Referral Code</h3>
            </div>
            <p className="referral-code-description">
              Share this code with friends! When they join using your code,
              you'll move up in the queue.
            </p>
            <div className="referral-code-display">
              <span className="referral-code-value">
                {position.referral_code}
              </span>
              <button className="referral-code-copy" onClick={handleCopyCode}>
                {copiedCode ? "Copied!" : "Copy"}
              </button>
            </div>
            <button
              className="waitlist-button waitlist-button-secondary"
              onClick={handleCopyReferralLink}
              style={{ marginTop: "1rem" }}
            >
              📋 Copy Referral Link
            </button>
          </div>
        )}

        <div className="waitlist-info">
          <p>
            Want faster access? Check out our{" "}
            <Link to="/pricing">pricing plans</Link> to skip the waitlist.
            Questions? Join our{" "}
            <a
              href="https://discord.gg/U4QYdzXEnr"
              target="_blank"
              rel="noopener noreferrer"
            >
              Discord community
            </a>
            .
          </p>
          <p>
            Have a code? <Link to="/redeem">Redeem it here</Link> to get instant
            access.
          </p>
        </div>

        {/* Leave Waitlist */}
        <div className="leave-waitlist-section">
          {!showLeaveConfirm ? (
            <button
              className="leave-waitlist-button"
              onClick={() => setShowLeaveConfirm(true)}
            >
              Leave Waitlist
            </button>
          ) : (
            <div className="leave-confirm-card">
              <p className="leave-confirm-text">
                Are you sure you want to leave the waitlist? You'll lose your
                position and will need to rejoin at the back of the line.
              </p>
              {leaveError && <div className="waitlist-error">{leaveError}</div>}
              <div className="leave-confirm-buttons">
                <button
                  className="waitlist-button waitlist-button-danger"
                  onClick={handleLeaveWaitlist}
                  disabled={isLeaving}
                >
                  {isLeaving ? "Leaving..." : "Yes, Leave Waitlist"}
                </button>
                <button
                  className="waitlist-button waitlist-button-secondary"
                  onClick={() => {
                    setShowLeaveConfirm(false);
                    setLeaveError(null);
                  }}
                  disabled={isLeaving}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
