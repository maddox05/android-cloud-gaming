import { useState } from "react";
import { config } from "../config";
import { Avatar } from "./Avatar";
import { CloseIcon, CreditCardIcon } from "./Icons";
import {
  getVideoQuality,
  setVideoQuality,
  VIDEO_SIZE_MAP,
  type VideoQuality,
} from "../utils/videoQuality";
import { PlaytimeDisplay } from "./PlaytimeDisplay";
import "./ProfilePanel.css";
import { useUser } from "../context/UserContext";

interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function ProfilePanel({
  isOpen,
  onClose,
  onSignIn,
  onSignOut,
}: ProfilePanelProps) {
  const { user, accessType } = useUser();
  const [videoQuality, setVideoQualityState] =
    useState<VideoQuality>(getVideoQuality);

  const avatarUrl =
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  const handleQualityChange = (quality: VideoQuality) => {
    // Free users can only use ULD
    if (accessType !== "paid" && quality !== "ULD") return;
    setVideoQuality(quality);
    setVideoQualityState(quality);
  };

  return (
    <>
      <div className={`profile-panel ${isOpen ? "open" : ""}`}>
        <div className="panel-header">
          <h3>Account</h3>
          <button className="panel-close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        {user ? (
          <div className="panel-content">
            <div className="panel-user">
              <Avatar
                src={avatarUrl || "/imgs/example-profile.svg"}
                size="lg"
              />
              <div className="panel-user-info">
                <span className="panel-user-name">
                  {user?.user_metadata?.name || "User"}
                </span>
                <span className="panel-user-email">{user?.email}</span>
              </div>
            </div>

            <div className="panel-setting">
              <span className="panel-setting-label">Stream Quality</span>
              <div className="panel-quality-options">
                {(Object.keys(VIDEO_SIZE_MAP) as VideoQuality[]).map((key) => {
                  const width = VIDEO_SIZE_MAP[key];
                  const height = Math.round((width * 9) / 16); // 16:9 aspect ratio
                  const proOnly = key !== "ULD";
                  const isLocked = proOnly && accessType !== "paid";
                  return (
                    <button
                      key={key}
                      className={`panel-quality-btn ${
                        videoQuality === key ? "active" : ""
                      } ${isLocked ? "locked" : ""}`}
                      onClick={() => handleQualityChange(key)}
                      disabled={isLocked}
                    >
                      <span className="quality-label">
                        {key}
                        {isLocked && <span className="pro-badge">Pro</span>}
                      </span>
                      <span className="quality-spec">{height}p</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {user?.id && <PlaytimeDisplay onUpgradeClick={onClose} />}

            <div className="panel-links">
              <a href={config.STRIPE_BILLING_URL} className="panel-link">
                <CreditCardIcon />
                Payment Settings
              </a>
              <button className="panel-signout" onClick={onSignOut}>
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <div className="panel-content">
            <p className="panel-message">
              Sign in to access your account and manage subscriptions.
            </p>
            <button className="panel-signin" onClick={onSignIn}>
              Sign In
            </button>
          </div>
        )}
      </div>

      {isOpen && <div className="panel-overlay" onClick={onClose} />}
    </>
  );
}
