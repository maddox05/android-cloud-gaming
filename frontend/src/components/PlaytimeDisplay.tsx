import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../utils/supabase";
import { getUserTimeSpentToday } from "../../../shared/functions";
import { FREE_USER_MAX_TIME_MS } from "../../../shared/const";
import { useUser } from "../context/UserContext";

interface PlaytimeDisplayProps {
  onUpgradeClick?: () => void;
}

export function PlaytimeDisplay({ onUpgradeClick }: PlaytimeDisplayProps) {
  const { user, accessType } = useUser();
  const [timeSpentMs, setTimeSpentMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const userId = user?.id;

  useEffect(() => {
    async function fetchTimeSpent() {
      if (!userId) return;
      setLoading(true);
      const time = await getUserTimeSpentToday(supabase, userId);
      setTimeSpentMs(time);
      setLoading(false);
    }

    fetchTimeSpent();
  }, [userId]);

  const maxMins = FREE_USER_MAX_TIME_MS / 60000;
  const usedMins = (timeSpentMs ?? 0) / 60000;
  const remainingMins = Math.max(0, maxMins - usedMins);
  const percentRemaining = Math.max(0, (remainingMins / maxMins) * 100);

  let content: React.ReactNode;
  let containerClass = "panel-setting playtime-display";

  if (accessType === "paid") {
    content = (
      <span className="playtime-value playtime-unlimited">Unlimited</span>
    );
  } else if (accessType === undefined) {
    content = (
      <span className="playtime-value playtime-loading">Loading...</span>
    );
  } else if (accessType === null) {
    containerClass += " playtime-no-access";
    content = (
      <Link to="/pricing" className="playtime-get-access-cta">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        <span>Get Access</span>
      </Link>
    );
  } else if (loading) {
    content = (
      <span className="playtime-value playtime-loading">Loading...</span>
    );
  } else {
    containerClass += " playtime-free";
    content = (
      <div className="playtime-free-container">
        <div className="playtime-progress-wrapper">
          <div className="playtime-stats">
            <span className="playtime-remaining-text">
              {remainingMins.toFixed(1)} min left
            </span>
            <span className="playtime-total-text">of {maxMins} min</span>
          </div>
          <div className="playtime-progress-bar">
            <div
              className="playtime-progress-fill"
              style={{ width: `${percentRemaining}%` }}
            />
          </div>
        </div>
        <Link
          to="/pricing"
          className="playtime-upgrade-cta"
          onClick={onUpgradeClick}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <span>Get Unlimited</span>
        </Link>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <span className="panel-setting-label">Daily Playtime</span>
      {content}
    </div>
  );
}
