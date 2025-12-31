import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import {
  getCurrentUser,
  signInWithGoogle,
  signOut,
  onAuthStateChange,
} from "../utils/supabase";
import { Avatar } from "./Avatar";
import { BurgerIcon, CloseIcon, DiscordIcon } from "./Icons";
import { MobileMenu } from "./MobileMenu";
import { ProfilePanel } from "./ProfilePanel";
import "./Navbar.css";

const NAV_LINKS = [{ to: "/pricing", label: "Pricing" }];

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const userAvatarUrl =
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  useEffect(() => {
    getCurrentUser().then(setUser);
    const unsubscribe = onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return unsubscribe;
  }, []);

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

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      setShowPanel(false);
    } catch (err) {
      console.error("Sign in failed:", err);
    }
  };

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
      handleSignIn();
    }
  };

  return (
    <>
      <header className="header">
        <div className="header-left">
          <Link to="/" className="logo">
            <img src="/favicon.png" alt="" className="logo-icon" />
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
          <a
            href="https://discord.gg/U4QYdzXEnr"
            target="_blank"
            rel="noopener noreferrer"
            className="discord-badge"
          >
            <DiscordIcon size={24} />
            <span className="discord-count">6</span>
          </a>
          <button
            className="profile-btn"
            onClick={handleProfileClick}
            title={user ? "Account" : "Sign In"}
          >
            <Avatar src={userAvatarUrl} size="md" />
          </button>
        </div>

        {/* Mobile Navigation */}
        <div className="header-right mobile-nav">
          <a
            href="https://discord.gg/U4QYdzXEnr"
            target="_blank"
            rel="noopener noreferrer"
            className="discord-badge"
          >
            <DiscordIcon size={24} />
            <span className="discord-count">6</span>
          </a>
          <button
            className="profile-btn"
            onClick={handleProfileClick}
            title={user ? "Account" : "Sign In"}
          >
            <Avatar src={userAvatarUrl} size="sm" />
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
        onClose={() => setShowPanel(false)}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />
    </>
  );
}
