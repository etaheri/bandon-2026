import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { pollStatus, type PollStatus } from "./pollStatus";

export interface LeaderboardState {
  lb: any;
  status: PollStatus;
  lastUpdatedAt: number | null; // epoch ms of last successful poll
}

export function useLeaderboard(intervalMs = 20000): LeaderboardState {
  const [lb, setLb] = useState<any>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [fails, setFails] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const tick = () =>
      api.leaderboard()
        .then(data => { setLb(data); setLastUpdatedAt(Date.now()); setFails(0); })
        .catch(() => setFails(f => f + 1));
    tick();
    timer.current = window.setInterval(tick, intervalMs);
    return () => clearInterval(timer.current);
  }, [intervalMs]);

  return { lb, status: pollStatus(fails, lb != null), lastUpdatedAt };
}
