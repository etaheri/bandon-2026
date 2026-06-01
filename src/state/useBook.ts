import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { getPlayerId } from "./session";

// Polls /api/book on an interval (the Book is a clubhouse/wifi activity, so a
// gentle poll is fine). `refresh` lets the screen re-pull immediately after a
// write (pick / lock / resolve) instead of waiting for the next tick.
export function useBook(intervalMs = 15000) {
  const [data, setData] = useState<any>(null);
  const timer = useRef<number | undefined>(undefined);
  const refresh = useCallback(
    () => api.book(getPlayerId()).then(setData).catch(() => {}),
    [],
  );
  useEffect(() => {
    refresh();
    timer.current = window.setInterval(refresh, intervalMs);
    return () => clearInterval(timer.current);
  }, [intervalMs, refresh]);
  return { data, refresh };
}
