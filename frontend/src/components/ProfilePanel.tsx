import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { config } from "../config";
import { Avatar } from "./Avatar";
import { CloseIcon, CreditCardIcon } from "./Icons";
import {
  getVideoQuality,
  setVideoQuality,
  type VideoQuality,
} from "../utils/videoQuality";
import { PlaytimeDisplay } from "./PlaytimeDisplay";
import "./ProfilePanel.css";

interface ProfilePanelProps {
  user: User | null;
  avatarUrl?: string | null;
  isOpen: boolean;
  isPaid: boolean;
  onClose: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function ProfilePanel({
  user,
  avatarUrl,
  isOpen,
  isPaid,
  onClose,
  onSignIn,
  onSignOut,
}: ProfilePanelProps) {
  const [videoQuality, setVideoQualityState] =
    useState<VideoQuality>(getVideoQuality);

  const handleQualityChange = (quality: VideoQuality) => {
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
                  {user.user_metadata?.name || "User"}
                </span>
                <span className="panel-user-email">{user.email}</span>
              </div>
            </div>

            <div className="panel-setting">
              <span className="panel-setting-label">Stream Quality</span>
              <div className="panel-quality-options">
                {(
                  [
                    { key: "HD", label: "HD", spec: "1920p" },
                    { key: "LD", label: "LD", spec: "1080p" },
                    { key: "ULD", label: "ULD", spec: "640p" },
                  ] as const
                ).map(({ key, label, spec }) => (
                  <button
                    key={key}
                    className={`panel-quality-btn ${
                      videoQuality === key ? "active" : ""
                    }`}
                    onClick={() => handleQualityChange(key)}
                  >
                    <span className="quality-label">{label}</span>
                    <span className="quality-spec">{spec}</span>
                  </button>
                ))}
              </div>
            </div>

            <PlaytimeDisplay userId={user.id} isPaid={isPaid} />

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
