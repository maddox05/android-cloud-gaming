import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  getWaitlistPosition,
  getTotalWaitlistCount,
  getCurrentUser,
  removeSelfFromWaitlist,
  type WaitlistPosition,
} from "../utils/supabase";
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

export default function Waitlist() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [position, setPosition] = useState<WaitlistPosition | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const [positionData, count, currentUser] = await Promise.all([
          getWaitlistPosition(userId),
          getTotalWaitlistCount(),
          getCurrentUser(),
        ]);

        setPosition(positionData);
        setTotalCount(count);
        setIsOwner(currentUser?.id === userId);
      } catch (err) {
        console.error("Error fetching waitlist data:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [userId]);

  const handleCopyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleCopyCode = async () => {
    if (!position?.invite_code) return;
    try {
      await navigator.clipboard.writeText(position.invite_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleCopyReferralLink = async () => {
    if (!position?.invite_code) return;
    const referralUrl = `${window.location.origin}/waitlist?ref=${position.invite_code}`;
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
          <h1 className="waitlist-title">
            {isOwner ? "Your Waitlist Position" : "Waitlist Position"}
          </h1>
          <p className="waitlist-subtitle">
            {isOwner
              ? "You're on the list! We'll notify you when it's your turn."
              : "See where this user stands in line for MaddoxCloud."}
          </p>
        </header>

        <div className="waitlist-position-card">
          <p className="position-label">Position in Line</p>
          <div className="position-number">
            #{position.position}
          </div>
          <p className="position-suffix">
            {position.position}{getOrdinalSuffix(position.position)} in queue
          </p>

          <div className="position-meta">
            <div className="meta-item">
              <div className="meta-value">{totalCount.toLocaleString()}</div>
              <div className="meta-label">Total in waitlist</div>
            </div>
            <div className="meta-item">
              <div className="meta-value">{formatDate(position.time_joined)}</div>
              <div className="meta-label">Joined on</div>
            </div>
          </div>
        </div>

        {/* Invite Code Section - Only show to owner */}
        {isOwner && position.invite_code && (
          <div className="invite-code-card">
            <div className="invite-code-header">
              <span className="invite-code-icon">🎁</span>
              <h3>Your Referral Code</h3>
            </div>
            <p className="invite-code-description">
              Share this code with friends! When they join using your code, you'll move up in the queue.
            </p>
            <div className="invite-code-display">
              <span className="invite-code-value">{position.invite_code}</span>
              <button 
                className="invite-code-copy"
                onClick={handleCopyCode}
              >
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

        {isOwner && (
          <div className="waitlist-share">
            <p className="share-label">Share your waitlist page:</p>
            <div className="share-url">
              <input
                type="text"
                value={window.location.href}
                readOnly
              />
              <button onClick={handleCopyLink}>
                {copiedLink ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}

        <div className="waitlist-info">
          <p>
            Want faster access? Check out our{" "}
            <Link to="/pricing">pricing plans</Link> to skip the waitlist.
            Questions? Join our{" "}
            <a href="https://discord.gg/U4QYdzXEnr" target="_blank" rel="noopener noreferrer">
              Discord community
            </a>.
          </p>
        </div>

        {/* Leave Waitlist - Only show to owner */}
        {isOwner && (
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
                  Are you sure you want to leave the waitlist? You'll lose your position and will need to rejoin at the back of the line.
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
        )}
      </div>
    </div>
  );
}
