import { useEffect } from "react";
import "./Roadmap.css";

// Icons for each milestone
const RocketIcon = () => (
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
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
);

const SchoolIcon = () => (
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
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c3 3 9 3 12 0v-5" />
  </svg>
);

const SaveIcon = () => (
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
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const UserIcon = () => (
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
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const GamepadIcon = () => (
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
    <line x1="6" y1="12" x2="10" y2="12" />
    <line x1="8" y1="10" x2="8" y2="14" />
    <line x1="15" y1="13" x2="15.01" y2="13" />
    <line x1="18" y1="11" x2="18.01" y2="11" />
    <rect x="2" y="6" width="20" height="12" rx="2" />
  </svg>
);

const ServerIcon = () => (
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
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" />
    <line x1="6" y1="18" x2="6.01" y2="18" />
  </svg>
);

interface RoadmapItem {
  id: string;
  title: string;
  date: string;
  season: string;
  description: string;
  features: string[];
  icon: React.ReactNode;
  status: "completed" | "current" | "upcoming";
}

const roadmapData: RoadmapItem[] = [
  {
    id: "free-version",
    title: "Free Version Launch",
    date: "January 2025",
    season: "Winter 2025",
    description:
      "Introducing our free tier with core gaming features for everyone.",
    features: [
      "360p streaming quality",
      "10 minutes daily playtime",
      "Standard queue priority",
      "Ad-supported experience",
    ],
    icon: <RocketIcon />,
    status: "current",
  },
  {
    id: "byod-proxy",
    title: "BYOD & Proxy Links",
    date: "January 2025",
    season: "Winter 2025",
    description: "Play your favorite games anywhere, even on school networks.",
    features: [
      "Bring Your Own Domain support",
      "Proxy link access for premium users",
      "Bypass network restrictions",
      "Seamless school gaming",
    ],
    icon: <SchoolIcon />,
    status: "upcoming",
  },
  {
    id: "save-data",
    title: "Cloud Save System",
    date: "Spring 2025",
    season: "Spring 2025",
    description: "Never lose your progress again with cloud-synced game saves.",
    features: [
      "Automatic game data backup",
      "Cross-session persistence",
      "Tutorial progress saved",
      "Instant resume gameplay",
    ],
    icon: <SaveIcon />,
    status: "upcoming",
  },
  {
    id: "account-login",
    title: "In-Game Account Login",
    date: "Spring 2025",
    season: "Spring 2025",
    description: "Login to your game accounts and access all your content.",
    features: [
      "Google Play Games integration",
      "Game-specific account sync",
      "Access purchased content",
      "Friend lists & social features",
    ],
    icon: <UserIcon />,
    status: "upcoming",
  },
  {
    id: "roblox",
    title: "Roblox Support",
    date: "Spring 2025",
    season: "Spring 2025",
    description: "Full Roblox experience with advanced input mapping.",
    features: [
      "Complete keyboard mapping",
      "Mobile-to-desktop controls",
      "Full Roblox game library",
      "Optimized performance",
    ],
    icon: <GamepadIcon />,
    status: "upcoming",
  },
  {
    id: "infrastructure",
    title: "Infrastructure 2.0",
    date: "Summer 2025",
    season: "Summer 2025",
    description: "Massive infrastructure overhaul for ultimate scalability.",
    features: [
      "Dynamic instance scaling",
      "Reduced queue times",
      "Global server expansion",
      "Enhanced reliability",
    ],
    icon: <ServerIcon />,
    status: "upcoming",
  },
];

const Roadmap = () => {
  useEffect(() => {
    document.title = "Roadmap | MaddoxCloud";
  }, []);

  return (
    <div className="roadmap-page">
      <div className="roadmap-hero">
        <div className="roadmap-hero-content">
          <span className="roadmap-badge">Our Vision</span>
          <h1>Product Roadmap</h1>
          <p>
            See what's coming next to MaddoxCloud. We're building the future of
            cloud gaming, one feature at a time.
          </p>
        </div>
        <div className="roadmap-hero-glow"></div>
      </div>

      <div className="roadmap-container">
        <div className="roadmap-timeline">
          {roadmapData.map((item, index) => (
            <div
              key={item.id}
              className={`roadmap-item ${item.status}`}
              style={
                {
                  "--animation-delay": `${index * 0.1}s`,
                } as React.CSSProperties
              }
            >
              <div className="roadmap-item-connector">
                <div className="roadmap-item-dot">
                  <div className="roadmap-item-icon">{item.icon}</div>
                </div>
                {index < roadmapData.length - 1 && (
                  <div className="roadmap-item-line"></div>
                )}
              </div>

              <div className="roadmap-item-content">
                <div className="roadmap-item-header">
                  <span className={`roadmap-status-badge ${item.status}`}>
                    {item.status === "completed" && "Completed"}
                    {item.status === "current" && "In Development"}
                    {item.status === "upcoming" && "Coming Soon"}
                  </span>
                  <span className="roadmap-date">{item.date}</span>
                </div>

                <h2 className="roadmap-item-title">{item.title}</h2>
                <p className="roadmap-item-description">{item.description}</p>

                <ul className="roadmap-features">
                  {item.features.map((feature, featureIndex) => (
                    <li key={featureIndex}>
                      <svg
                        className="feature-check"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="roadmap-cta">
        <div className="roadmap-cta-content">
          <h2>Want to shape our roadmap?</h2>
          <p>
            Join our community and let us know what features you want to see
            next.
          </p>
          <a
            href="https://discord.gg/7AvDCdYJQS"
            target="_blank"
            rel="noopener noreferrer"
            className="roadmap-cta-button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            Join Discord
          </a>
        </div>
      </div>
    </div>
  );
};

export default Roadmap;
