import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { isLoggedIn, signInWithGoogle } from "../utils/supabase";
import GameCard from "./GameCard";
import "./Home.css";
import { GAMES_LIST } from "../../../shared/const";

const FEATURES = [
  {
    icon: "link",
    title: "New Proxy Links Daily",
    description: "Fresh links that work in school - updated every day",
  },
  {
    icon: "clock",
    title: "No Queue Times",
    description: "Jump straight into your game, no waiting",
  },
  {
    icon: "shield",
    title: "We Don't Save Your Data",
    description: "Your privacy matters - we keep nothing",
  },
  {
    icon: "zap",
    title: "Fast",
    description: "Low latency streaming for smooth gameplay",
  },
  {
    icon: "gift",
    title: "Free Trial",
    description: "Try it out before you commit",
  },
];

// Feature Icons
const FeatureIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "link":
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      );
    case "clock":
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "shield":
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "zap":
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case "gift":
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 12 20 22 4 22 4 12" />
          <rect x="2" y="7" width="20" height="5" />
          <line x1="12" y1="22" x2="12" y2="7" />
          <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
          <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
        </svg>
      );
    default:
      return null;
  }
};

export default function Home() {
  const navigate = useNavigate();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handlePlay = async (appId: string) => {
    const loggedIn = await isLoggedIn();
    if (!loggedIn) {
      setShowLoginModal(true);
      return;
    }
    navigate(`/queue/${encodeURIComponent(appId)}`);
  };

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      setShowLoginModal(false);
    } catch (err) {
      console.error("Sign in failed:", err);
    }
  };

  return (
    <main className="main-content">
      {/* Games Grid - First */}
      <section className="games-section">
        <div className="game-grid">
          {GAMES_LIST.map((game) => (
            <GameCard
              key={game.id}
              id={game.id}
              name={game.name}
              description={game.description}
              thumbnail={game.thumbnail}
              onPlay={handlePlay}
            />
          ))}
        </div>
      </section>

      {/* Hero Section */}
      <section className="hero">
        <h1>Play Clash Royale In School</h1>
        <p>The best cloud gaming to play mobile games unblocked in school</p>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="features-grid">
          {FEATURES.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="feature-icon">
                <FeatureIcon type={feature.icon} />
              </div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <Link to="/pricing" className="cta-button">
          Start Trial
        </Link>
      </section>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="modal-overlay show">
          <div className="modal-content">
            <h2>Sign In Required</h2>
            <p>Please sign in to play games</p>
            <button className="google-btn" onClick={handleSignIn}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>
            <button
              className="cancel-btn"
              onClick={() => setShowLoginModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
