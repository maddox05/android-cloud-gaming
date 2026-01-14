import { useState, useEffect } from "react";
import { useUser } from "../context/useUser";
import { useAuthModal } from "../context/AuthModalContext";
import { GoogleIcon, MicrosoftIcon, MailIcon } from "./Icons";
import { getLinkedProviders } from "../utils/supabase";
import { checkHasPassword } from "../utils/server_funcs";
import "./AccountLinkingSection.css";

export function AccountLinkingSection() {
  const { user } = useUser();
  const { startLinkGoogle, startLinkAzure, startLinkEmail } = useAuthModal();
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);

  const linkedProviders = getLinkedProviders(user);
  const isGoogleLinked = linkedProviders.includes("google");
  const isAzureLinked = linkedProviders.includes("azure");

  // Check if user has email identity (signed up with email)
  const hasEmailIdentity = linkedProviders.includes("email");

  // Fetch password status from server
  useEffect(() => {
    if (!user || hasEmailIdentity) {
      // If user signed up with email, they have password auth
      setHasPassword(hasEmailIdentity);
      return;
    }

    checkHasPassword().then(setHasPassword);
  }, [user, hasEmailIdentity]);

  const isEmailLinked = hasPassword === true;

  return (
    <div className="account-linking-section">
      <span className="panel-setting-label">Linked Accounts</span>
      <div className="linked-accounts-list">
        {/* Google */}
        <div className="linked-account-row">
          <div className="linked-account-info">
            <GoogleIcon size={20} />
            <span className="linked-account-name">Google</span>
          </div>
          {isGoogleLinked ? (
            <span className="linked-status">Linked</span>
          ) : (
            <button className="link-account-btn" onClick={startLinkGoogle}>
              Link
            </button>
          )}
        </div>

        {/* Microsoft */}
        <div className="linked-account-row">
          <div className="linked-account-info">
            <MicrosoftIcon size={20} />
            <span className="linked-account-name">Microsoft</span>
          </div>
          {isAzureLinked ? (
            <span className="linked-status">Linked</span>
          ) : (
            <button className="link-account-btn" onClick={startLinkAzure}>
              Link
            </button>
          )}
        </div>

        {/* Email & Password */}
        <div className="linked-account-row">
          <div className="linked-account-info">
            <MailIcon size={20} />
            <span className="linked-account-name">Email & Password</span>
          </div>
          {hasPassword === null ? (
            <span className="linked-status-loading">...</span>
          ) : isEmailLinked ? (
            <span className="linked-status">Linked</span>
          ) : (
            <button className="link-account-btn" onClick={startLinkEmail}>
              Link
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
