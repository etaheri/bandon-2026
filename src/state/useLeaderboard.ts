import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";

export function useLeaderboard(intervalMs = 20000) {
  const [lb, setLb] = useState<any>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const tick = () => api.leaderboard().then(setLb).catch(() => {});
    tick();
    timer.current = window.setInterval(tick, intervalMs);
    return () => clearInterval(timer.current);
  }, [intervalMs]);
  return lb;
}
