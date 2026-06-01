import { useState, useEffect } from "react";
import { themeCss } from "./ui/theme";
import { isAuthed, getPlayerId } from "./state/session";
import { Login } from "./screens/Login";
import { Home } from "./screens/Home";
import { ScoreEntry } from "./screens/ScoreEntry";
import { TeeSheet } from "./screens/TeeSheet";
import { Board } from "./screens/Board";
import { Admin } from "./screens/Admin";

export function App() {
  const [, force] = useState(0);
  const path = window.location.pathname;
  const tv = new URLSearchParams(window.location.search).get("tv") === "1";

  useEffect(() => {
    const s = document.createElement("style"); s.textContent = themeCss; document.head.appendChild(s);
  }, []);

  // Board kiosk mode is public-ish but still behind auth in v1.
  if (!isAuthed() || !getPlayerId()) {
    if (path === "/board" && tv) { /* allow TV without login if desired later */ }
    return <Login onDone={() => force(n => n + 1)} />;
  }

  if (path.startsWith("/board")) return <Board tv={tv} />;
  if (path.startsWith("/score")) return <ScoreEntry />;
  if (path.startsWith("/tee")) return <TeeSheet />;
  if (path.startsWith("/admin")) return <Admin />;
  return <Home />;
}

export const go = (p: string) => { window.history.pushState({}, "", p); window.dispatchEvent(new PopStateEvent("popstate")); };
