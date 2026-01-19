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

// SVG Icons for share buttons
const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

const RedditIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
  </svg>
);

// Share platform configurations
const SHARE_PLATFORMS = {
  tiktok: {
    icon: TikTokIcon,
    buttonLabel: "Share on TikTok",
    buttonClass: "share-button-tiktok",
    panelClass: "share-info-tiktok",
    title: "Share on TikTok",
    bonus: "TikTok videos can go viral and get you TONS of referrals!",
    description:
      "Make a video showing how to play games like Clash Royale, Roblox, or other blocked games at school using MaddoxCloud!",
    steps: [
      "Show the problem (games blocked at school)",
      "Show the solution (using MaddoxCloud)",
      "Tell viewers to use your referral link at the end",
    ],
    exampleLabel: "Example video:",
    exampleLink: "https://www.tiktok.com/@rockyf2p/video/7594482245730077983",
    exampleText: "Watch example TikTok",
  },
  reddit: {
    icon: RedditIcon,
    buttonLabel: "Share on Reddit",
    buttonClass: "share-button-reddit",
    panelClass: "share-info-reddit",
    title: "Share on Reddit",
    bonus:
      "Reddit posts stay searchable forever - passive referrals for months!",
    description: "This is a two-step strategy that works really well:",
    steps: [
      {
        label: "Step 1:",
        text: "Create a post in subreddits like r/school, r/highschool, etc. asking how to play games like Roblox or Clash Royale at school",
        links: [
          { text: "r/school", url: "https://reddit.com/r/school" },
          { text: "r/highschool", url: "https://reddit.com/r/highschool" },
        ],
      },
      {
        label: "Step 2:",
        text: 'A few days later, edit your post saying "Hey I found MaddoxCloud!" and include your referral code',
      },
    ],
    exampleLabel: "Example post:",
    exampleLink:
      "https://www.reddit.com/r/highschool/comments/1pu4lc0/how_are_people_playing_clash_royale_on_the_school/",
    exampleText: "See example Reddit post",
  },
};

type SharePlatform = keyof typeof SHARE_PLATFORMS;

interface ShareInfoPanelProps {
  platform: SharePlatform;
}

function ShareInfoPanel({ platform }: ShareInfoPanelProps) {
  const config = SHARE_PLATFORMS[platform];

  return (
    <div className={`share-info-panel ${config.panelClass}`}>
      <h4>{config.title}</h4>
      <div className="share-bonus-badge">
        <span className="bonus-icon">🚀</span>
        {config.bonus}
      </div>
      <p>{config.description}</p>
      {platform === "tiktok" ? (
        <ul>
          {(config.steps as string[]).map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ul>
      ) : (
        <ol>
          {(
            config.steps as Array<{
              label: string;
              text: string;
              links?: Array<{ text: string; url: string }>;
            }>
          ).map((step, i) => (
            <li key={i}>
              <strong>{step.label}</strong>{" "}
              {step.links ? (
                <>
                  Create a post in subreddits like{" "}
                  {step.links.map((link, j) => (
                    <span key={j}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {link.text}
                      </a>
                      {j < step.links!.length - 1 ? ", " : ""}
                    </span>
                  ))}
                  , etc. asking how to play games like Roblox or Clash Royale at
                  school
                </>
              ) : (
                step.text
              )}
            </li>
          ))}
        </ol>
      )}
      <div className="share-example">
        <strong>{config.exampleLabel}</strong>
        <a href={config.exampleLink} target="_blank" rel="noopener noreferrer">
          {config.exampleText}
        </a>
      </div>
    </div>
  );
}

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
  const [showReferralSection, setShowReferralSection] = useState(false);
  const [showTikTokInfo, setShowTikTokInfo] = useState(false);
  const [showRedditInfo, setShowRedditInfo] = useState(false);
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
            You're on the list! We'll email you a <strong>invite code</strong>{" "}
            when it's your turn.
          </p>
          <Link to="/redeem" className="redeem-hint-card">
            <span className="redeem-hint-icon">🎟️</span>
            <span className="redeem-hint-text">
              <span className="redeem-hint-title">
                Got an invite code from the waitlist or a friend?
              </span>
              <span className="redeem-hint-subtitle">
                Redeem it to skip the waitlist
              </span>
            </span>
            <span className="redeem-hint-arrow">→</span>
          </Link>
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
                  calculateTimeJumped(
                    position.created_at,
                    position.time_joined,
                  ),
                ) || "0 hours"}
              </div>
              <div className="meta-label">Time jumped from referrals</div>
            </div>
          </div>
        </div>

        {/* Referral Code Section - Collapsible */}
        {position.referral_code && (
          <div
            className={`referral-code-card ${showReferralSection ? "expanded" : ""}`}
          >
            <button
              className="referral-code-header"
              onClick={() => setShowReferralSection(!showReferralSection)}
            >
              <span className="referral-code-icon">🎁</span>
              <h3>Your Referral Code</h3>
              <span
                className={`referral-chevron ${showReferralSection ? "open" : ""}`}
              >
                ▼
              </span>
            </button>

            {showReferralSection && (
              <div className="referral-code-content">
                <p className="referral-code-description">
                  Share this code with friends! When they join using your code,
                  you'll move up in the queue.
                </p>
                <div className="referral-code-display">
                  <span className="referral-code-value">
                    {position.referral_code}
                  </span>
                  <button
                    className="referral-code-copy"
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

                {/* Share Buttons */}
                <div className="share-buttons-container">
                  <button
                    className={`share-button ${SHARE_PLATFORMS.tiktok.buttonClass}`}
                    onClick={() => setShowTikTokInfo(!showTikTokInfo)}
                  >
                    <TikTokIcon />
                    {SHARE_PLATFORMS.tiktok.buttonLabel}
                  </button>
                  <button
                    className={`share-button ${SHARE_PLATFORMS.reddit.buttonClass}`}
                    onClick={() => setShowRedditInfo(!showRedditInfo)}
                  >
                    <RedditIcon />
                    {SHARE_PLATFORMS.reddit.buttonLabel}
                  </button>
                </div>

                {showTikTokInfo && <ShareInfoPanel platform="tiktok" />}
                {showRedditInfo && <ShareInfoPanel platform="reddit" />}
              </div>
            )}
          </div>
        )}

        <div className="waitlist-info">
          <p>
            Want faster access? Check out our{" "}
            <Link to="/pricing">pricing plans</Link> to skip the waitlist.
            <br></br>Questions? Join our{" "}
            <a
              href="https://discord.gg/U4QYdzXEnr"
              target="_blank"
              rel="noopener noreferrer"
            >
              Discord community
            </a>{" "}
            for support and random invite code drops that give you instant
            access!
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
