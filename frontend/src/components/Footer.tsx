import { Link } from "react-router-dom";
import {
  DiscordIcon,
  YouTubeIcon,
  TikTokIcon,
  InstagramIcon,
  MailIcon,
  GitHubIcon,
} from "./Icons";
import "./Footer.css";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-container">
        {/* Brand Section */}
        <div className="footer-section footer-brand">
          <Link to="/" className="footer-logo">
            <img
              src="/imgs/egg_cloud_logo.png"
              alt="MaddoxCloud"
              className="footer-logo-icon"
            />
            <span className="footer-logo-text">MaddoxCloud</span>
          </Link>
          <p className="footer-tagline">
            Cloud gaming, simplified. Play anywhere, anytime.
          </p>
          <div className="footer-social">
            <a
              href="https://discord.gg/U4QYdzXEnr"
              className="social-link"
              aria-label="Discord"
            >
              <DiscordIcon size={20} />
            </a>
            <a
              href="https://youtube.com/@maddoxcloud"
              className="social-link"
              aria-label="YouTube"
            >
              <YouTubeIcon size={20} />
            </a>
            <a
              href="https://tiktok.com/@maddoxcloud"
              className="social-link"
              aria-label="TikTok"
            >
              <TikTokIcon size={20} />
            </a>
            <a
              href="https://instagram.com/maddoxcloud"
              className="social-link"
              aria-label="Instagram"
            >
              <InstagramIcon size={20} />
            </a>
          </div>
        </div>

        {/* Pages Section */}
        <div className="footer-section">
          <h4 className="footer-heading">Pages</h4>
          <nav className="footer-nav">
            <Link to="/" className="footer-link">
              Home
            </Link>
            <Link to="/pricing" className="footer-link">
              Pricing
            </Link>
            <Link to="/waitlist" className="footer-link">
              Waitlist
            </Link>
            <Link to="/roadmap" className="footer-link">
              Roadmap
            </Link>
            <Link to="/about" className="footer-link">
              About
            </Link>
            <Link to="/blog" className="footer-link">
              Blog
            </Link>
          </nav>
        </div>

        {/* Legal Section */}
        <div className="footer-section">
          <h4 className="footer-heading">Legal</h4>
          <nav className="footer-nav">
            <Link to="/privacy-policy" className="footer-link">
              Privacy Policy
            </Link>
            <Link to="/copyright-policy" className="footer-link">
              Copyright Policy
            </Link>
            <Link to="/terms-of-service" className="footer-link">
              Terms of Service
            </Link>
          </nav>
        </div>

        {/* Support Section */}
        <div className="footer-section">
          <h4 className="footer-heading">Support</h4>
          <div className="footer-support">
            <a
              href="https://discord.gg/U4QYdzXEnr"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-support-link"
            >
              <DiscordIcon size={16} />
              <span>Join our Discord</span>
            </a>
            <a
              href="mailto:contact@maddoxcloud.com"
              className="footer-support-link"
            >
              <MailIcon size={16} />
              <span>contact@maddoxcloud.com</span>
            </a>
            <a
              href="https://github.com/maddox05/android-cloud-gaming/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-support-link"
            >
              <GitHubIcon size={16} />
              <span>Report A Bug</span>
            </a>
          </div>
        </div>
      </div>

      {/* Copyright Bar */}
      <div className="footer-bottom">
        <span className="footer-copyright">
          &copy; {currentYear} MaddoxCloud. All rights reserved.
        </span>
        <span className="footer-divider">|</span>
        <a
          href="https://github.com/maddox05/android-cloud-gaming"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-opensource"
        >
          <GitHubIcon size={16} />
          <span>Open Source</span>
        </a>
      </div>
    </footer>
  );
}
