import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { signOut } from "../utils/supabase";
import { useAuthModal } from "../context/AuthModalContext";
import { useUser } from "../context/UserContext";
import { Avatar } from "./Avatar";
import { BurgerIcon, CloseIcon, DiscordIcon, GiftIcon } from "./Icons";
import { MobileMenu } from "./MobileMenu";
import { ProfilePanel } from "./ProfilePanel";
import "./Navbar.css";

interface DiscordBadgeProps {
  text: string;
  showGift?: boolean;
  href?: string;
}

function DiscordBadge({
  text,
  showGift = false,
  href = "https://discord.gg/U4QYdzXEnr",
}: DiscordBadgeProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="discord-badge"
    >
      <DiscordIcon size={24} />
      <span className="discord-text">{text}</span>
      {showGift && (
        <span className="discord-gift">
          <GiftIcon size={16} />
        </span>
      )}
    </a>
  );
}

const NAV_LINKS = [
  { to: "/pricing", label: "Pricing" },
  { to: "/roadmap", label: "Roadmap" },
];

export default function Navbar() {
  const [showPanel, setShowPanel] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { startLogin } = useAuthModal();
  const { user, isPaid } = useUser();

  const userAvatarUrl =
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  // Close panel when clicking outside
  useEffect(() => {
    if (!showPanel) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest(".profile-panel") &&
        !target.closest(".profile-btn")
      ) {
        setShowPanel(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showPanel]);

  const handleSignOut = async () => {
    try {
      await signOut();
      setShowPanel(false);
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (user) {
      setShowPanel(!showPanel);
    } else {
      startLogin();
    }
  };

  return (
    <>
      <header className="header">
        <div className="header-left">
          <Link to="/" className="logo">
            <img src="/imgs/egg_cloud_logo.png" alt="" className="logo-icon" />
            <span className="logo-text">MaddoxCloud</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <div className="header-right desktop-nav">
          {NAV_LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="nav-link">
              {link.label}
            </Link>
          ))}
          <DiscordBadge text="Get 50% off" showGift />
          <button
            className="profile-btn"
            onClick={handleProfileClick}
            title={user ? "Account" : "Sign In"}
          >
            <Avatar
              src={
                user ? userAvatarUrl || "/imgs/example-profile.svg" : undefined
              }
              size="md"
            />
          </button>
        </div>

        {/* Mobile Navigation */}
        <div className="header-right mobile-nav">
          <DiscordBadge text="Get 50% off" showGift />
          <button
            className="profile-btn"
            onClick={handleProfileClick}
            title={user ? "Account" : "Sign In"}
          >
            <Avatar
              src={
                user ? userAvatarUrl || "/imgs/example-profile.svg" : undefined
              }
              size="sm"
            />
          </button>
          <button
            className="burger-btn"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
          >
            {showMobileMenu ? <CloseIcon /> : <BurgerIcon />}
          </button>
        </div>
      </header>

      <MobileMenu
        isOpen={showMobileMenu}
        onClose={() => setShowMobileMenu(false)}
        links={NAV_LINKS}
      />

      <ProfilePanel
        user={user}
        avatarUrl={userAvatarUrl}
        isOpen={showPanel}
        isPaid={isPaid}
        onClose={() => setShowPanel(false)}
        onSignIn={startLogin}
        onSignOut={handleSignOut}
      />
    </>
  );
}
