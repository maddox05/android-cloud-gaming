import { useState, useEffect, type FormEvent } from "react";
import { useAuthModal } from "../context/AuthModalContext";
import {
  signInWithGoogle,
  signInWithMicrosoft,
  signInWithEmail,
  signUpWithEmail,
  onAuthStateChange,
} from "../utils/supabase";
import { CloseIcon, GoogleIcon, MicrosoftIcon, MailIcon } from "./Icons";
import "./AuthModal.css";

export function AuthModal() {
  const { isAuthModalOpen, authMode, closeAuthModal, setAuthMode } = useAuthModal();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Close modal on successful auth
  useEffect(() => {
    const unsubscribe = onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        closeAuthModal();
      }
    });
    return unsubscribe;
  }, [closeAuthModal]);

  // Reset form when modal opens/closes or mode changes
  useEffect(() => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setSuccessMessage("");
  }, [isAuthModalOpen, authMode]);

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      setError("");
      await signInWithGoogle();
    } catch (err) {
      console.error("Google auth failed:", err);
      setError("Failed to sign in with Google");
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftAuth = async () => {
    try {
      setLoading(true);
      setError("");
      await signInWithMicrosoft();
    } catch (err) {
      console.error("Microsoft auth failed:", err);
      setError("Failed to sign in with Microsoft");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (authMode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      if (authMode === "signup") {
        const result = await signUpWithEmail(email, password);
        if (result.success) {
          setSuccessMessage("Check your email to confirm your account!");
          setEmail("");
          setPassword("");
          setConfirmPassword("");
        } else {
          setError(result.error || "Failed to create account");
        }
      } else {
        const result = await signInWithEmail(email, password);
        if (result.success) {
          closeAuthModal();
        } else {
          setError(result.error || "Failed to sign in");
        }
      }
    } catch (err) {
      console.error("Email auth failed:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeAuthModal();
    }
  };

  if (!isAuthModalOpen) return null;

  const isLogin = authMode === "login";
  const title = isLogin ? "Sign In" : "Create Account";
  const subtitle = isLogin
    ? "Sign in to play games"
    : "Create an account to get started";
  const switchText = isLogin
    ? "Don't have an account?"
    : "Already have an account?";
  const switchAction = isLogin ? "Sign up" : "Sign in";

  return (
    <div className="auth-modal-overlay" onClick={handleOverlayClick}>
      <div className="auth-modal">
        <button
          className="auth-modal-close"
          onClick={closeAuthModal}
          aria-label="Close"
        >
          <CloseIcon size={20} />
        </button>

        <div className="auth-modal-header">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>

        <div className="auth-modal-content">
          {/* Google Button */}
          <button
            className="auth-btn auth-btn-google"
            onClick={handleGoogleAuth}
            disabled={loading}
          >
            <GoogleIcon size={20} />
            <span>Continue with Google</span>
          </button>

          {/* Microsoft Button */}
          <button
            className="auth-btn auth-btn-microsoft"
            onClick={handleMicrosoftAuth}
            disabled={loading}
          >
            <MicrosoftIcon size={20} />
            <span>Continue with Microsoft</span>
          </button>

          <div className="auth-divider">
            <span>or</span>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailSubmit} className="auth-form">
            <div className="auth-input-group">
              <MailIcon size={18} />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
              />
            </div>

            <div className="auth-input-group">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
            </div>

            {!isLogin && (
              <div className="auth-input-group">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>
            )}

            {error && <p className="auth-error">{error}</p>}
            {successMessage && <p className="auth-success">{successMessage}</p>}

            <button
              type="submit"
              className="auth-btn auth-btn-primary"
              disabled={loading}
            >
              {loading ? "Please wait..." : isLogin ? "Sign In" : "Sign Up"}
            </button>
          </form>
        </div>

        <div className="auth-modal-footer">
          <span>{switchText}</span>
          <button
            className="auth-switch-btn"
            onClick={() => setAuthMode(isLogin ? "signup" : "login")}
            disabled={loading}
          >
            {switchAction}
          </button>
        </div>
      </div>
    </div>
  );
}
