import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../utils/supabase";
import { getUserTimeSpentToday } from "../../../shared/functions";
import { FREE_USER_MAX_TIME_MS } from "../../../shared/const";

interface PlaytimeDisplayProps {
  userId: string;
  isPaid: boolean;
  onUpgradeClick?: () => void;
}

export function PlaytimeDisplay({
  userId,
  isPaid,
  onUpgradeClick,
}: PlaytimeDisplayProps) {
  const [timeSpentMs, setTimeSpentMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTimeSpent() {
      setLoading(true);
      const time = await getUserTimeSpentToday(supabase, userId);
      setTimeSpentMs(time);
      setLoading(false);
    }

    fetchTimeSpent();
  }, [userId]);

  if (isPaid) {
    return (
      <div className="panel-setting playtime-display">
        <span className="panel-setting-label">Daily Playtime</span>
        <span className="playtime-value playtime-unlimited">Unlimited</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="panel-setting playtime-display">
        <span className="panel-setting-label">Daily Playtime</span>
        <span className="playtime-value playtime-loading">Loading...</span>
      </div>
    );
  }

  const maxMins = FREE_USER_MAX_TIME_MS / 60000;
  const usedMins = (timeSpentMs ?? 0) / 60000;
  const remainingMins = Math.max(0, maxMins - usedMins);
  const percentRemaining = Math.max(0, (remainingMins / maxMins) * 100);

  return (
    <div className="panel-setting playtime-display playtime-free">
      <span className="panel-setting-label">Daily Playtime</span>
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
    </div>
  );
}
