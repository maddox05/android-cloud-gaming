import { Link } from "react-router-dom";
import "./MobileMenu.css";

interface NavLink {
  to: string;
  label: string;
}

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  links: NavLink[];
}

export function MobileMenu({ isOpen, onClose, links }: MobileMenuProps) {
  return (
    <div className={`mobile-menu ${isOpen ? "open" : ""}`}>
      {links.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          className="mobile-menu-link"
          onClick={onClose}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
