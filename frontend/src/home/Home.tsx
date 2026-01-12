import { useNavigate, Link } from "react-router-dom";
import { useAuthModal } from "../context/AuthModalContext";
import { useUser } from "../context/UserContext";
import { showAlert } from "../services/alertService";
import GameCard from "./GameCard";
import { GitHubIcon } from "../components/Icons";
import "./Home.css";
import { GAMES_LIST } from "../../../shared/const";

const FEATURES = [
  // {
  //   icon: "link",
  //   title: "New Proxy Links Daily",
  //   description: "Fresh links that work in school - updated every day",
  // },
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
  {
    icon: "code",
    title: "Open Source",
    description: "Fully transparent code you can inspect and contribute to",
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
    case "code":
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
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      );
    default:
      return null;
  }
};

export default function Home() {
  const navigate = useNavigate();
  const { startLogin } = useAuthModal();
  const { user, accessType } = useUser();

  const handlePlay = (appId: string) => {
    if (!user) {
      startLogin();
      return;
    }
    if (accessType === null) {
      // access type is undefined on default and null if the user doesnt have access
      showAlert({
        type: "warning",
        title: "Access Required",
        message: "Your account doesn't have access. Please join the waitlist or purchase the paid version!",
        link: { href: "/pricing", label: "View Pricing" },
      });
      return;
    }
    navigate(`/queue/${encodeURIComponent(appId)}`);
  };

  return (
    <main className="main-content">
      {/* Games Grid - First */}
      <section className="games-section">
        <h2 className="section-title">All Games</h2>
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
        <h1>Play Clash Royale Anywhere</h1>
        <p>The best cloud gaming to play mobile games on a laptop or desktop</p>
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
          Buy Now
        </Link>
        <a
          href="https://github.com/maddox05/android-cloud-gaming"
          target="_blank"
          rel="noopener noreferrer"
          className="open-source-link"
        >
          <span className="github-icon-circle">
            <GitHubIcon size={20} />
          </span>
          <span>Open Source</span>
        </a>
      </section>
    </main>
  );
}
