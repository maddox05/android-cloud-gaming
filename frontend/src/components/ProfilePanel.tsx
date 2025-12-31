import type { User } from "@supabase/supabase-js";
import { config } from "../config";
import { Avatar } from "./Avatar";
import { CloseIcon, CreditCardIcon, GoogleIcon } from "./Icons";
import "./ProfilePanel.css";

interface ProfilePanelProps {
  user: User | null;
  avatarUrl?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function ProfilePanel({
  user,
  avatarUrl,
  isOpen,
  onClose,
  onSignIn,
  onSignOut,
}: ProfilePanelProps) {
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
              <Avatar src={avatarUrl} size="lg" />
              <div className="panel-user-info">
                <span className="panel-user-name">
                  {user.user_metadata?.name || "User"}
                </span>
                <span className="panel-user-email">{user.email}</span>
              </div>
            </div>

            <div className="panel-links">
              <a href={config.STRIPE_BILLING_URL} className="panel-link">
                <CreditCardIcon />
                Payment Settings
              </a>
            </div>

            <button className="panel-signout" onClick={onSignOut}>
              Sign Out
            </button>
          </div>
        ) : (
          <div className="panel-content">
            <p className="panel-message">
              Sign in to access your account and manage subscriptions.
            </p>
            <button className="panel-signin" onClick={onSignIn}>
              <GoogleIcon />
              Continue with Google
            </button>
          </div>
        )}
      </div>

      {isOpen && <div className="panel-overlay" onClick={onClose} />}
    </>
  );
}
