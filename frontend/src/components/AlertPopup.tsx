import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  subscribeToAlerts,
  hideAlert,
  type AlertOptions,
  type AlertType,
} from "../services/alertService";
import { CloseIcon } from "./Icons";
import "./AlertPopup.css";

interface IconProps {
  size?: number;
  className?: string;
}

function ErrorIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <circle cx="12" cy="12" r="10" fill="#ef4444" />
      <path
        d="M15 9L9 15M9 9L15 15"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function WarningIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <path
        d="M12 2L1 21h22L12 2z"
        fill="#f97316"
        stroke="#f97316"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M12 9v4M12 17h.01"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function InfoIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <circle cx="12" cy="12" r="10" fill="#3b82f6" />
      <path
        d="M12 16v-4M12 8h.01"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

const iconMap: Record<AlertType, React.ComponentType<IconProps>> = {
  error: ErrorIcon,
  warning: WarningIcon,
  info: InfoIcon,
};

export function AlertPopup() {
  const [alertData, setAlertData] = useState<AlertOptions | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = subscribeToAlerts((options) => {
      setAlertData(options);
    });
    return unsubscribe;
  }, []);

  const handleClose = () => {
    const redirect = alertData?.onCloseRedirect;
    hideAlert();
    setAlertData(null);
    if (redirect) {
      navigate(redirect);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleLinkClick = () => {
    if (alertData?.link) {
      const href = alertData.link.href;
      hideAlert();
      setAlertData(null);
      if (href.startsWith("http")) {
        window.open(href, "_blank", "noopener,noreferrer");
      } else if (href) {
        navigate(href);
      }
    }
  };

  if (!alertData) return null;

  const IconComponent = iconMap[alertData.type || "error"];

  return (
    <div className="alert-overlay" onClick={handleOverlayClick}>
      <div className="alert-modal">
        <button
          className="alert-close"
          onClick={handleClose}
          aria-label="Close"
        >
          <CloseIcon size={20} />
        </button>

        <div className="alert-header">
          <IconComponent size={32} className="alert-icon" />
          {alertData.title && (
            <h2 className="alert-title">{alertData.title}</h2>
          )}
        </div>

        <p className="alert-message">{alertData.message}</p>

        <button className="alert-cta" onClick={handleLinkClick}>
          {alertData.link.label}
        </button>
      </div>
    </div>
  );
}
