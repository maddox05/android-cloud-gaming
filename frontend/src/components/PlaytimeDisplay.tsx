import { useState, useEffect } from "react";
import { supabase } from "../utils/supabase";
import { getUserTimeSpentToday } from "../../../shared/functions";
import { FREE_USER_MAX_TIME_MS } from "../../../shared/const";

interface PlaytimeDisplayProps {
  userId: string;
  isPaid: boolean;
}

export function PlaytimeDisplay({ userId, isPaid }: PlaytimeDisplayProps) {
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

  const maxMins = Math.ceil(FREE_USER_MAX_TIME_MS / 60000);
  const usedMins = Math.ceil((timeSpentMs ?? 0) / 60000);
  const remainingMins = Math.max(0, maxMins - usedMins);

  return (
    <div className="panel-setting playtime-display">
      <span className="panel-setting-label">Daily Playtime</span>
      <span className="playtime-value">
        {remainingMins} / {maxMins} mins remaining
      </span>
    </div>
  );
}
