import { useState, useEffect, type ReactNode } from "react";
import { themeCss } from "./ui/theme";
import { isAuthed, getPlayerId } from "./state/session";
import { Login } from "./screens/Login";
import { Home } from "./screens/Home";
import { ScoreEntry } from "./screens/ScoreEntry";
import { TeeSheet } from "./screens/TeeSheet";
import { Board } from "./screens/Board";
import { Admin } from "./screens/Admin";
import { Rules } from "./screens/Rules";
import { Book } from "./screens/Book";

export function App() {
  const [, force] = useState(0);
  const path = window.location.pathname;
  const tv = new URLSearchParams(window.location.search).get("tv") === "1";

  useEffect(() => {
    const s = document.createElement("style"); s.textContent = themeCss; document.head.appendChild(s);
  }, []);

  // Public, no login: board (incl. TV), tee sheet, home.
  let screen: ReactNode;
  if (path.startsWith("/board")) screen = <Board tv={tv} />;
  else if (path.startsWith("/rules")) screen = <Rules />;
  else if (path.startsWith("/book")) screen = <Book />;
  else if (path.startsWith("/tee")) screen = <TeeSheet />;
  else if (path.startsWith("/score") || path.startsWith("/admin")) {
    // Login required only to enter scores or admin.
    if (!isAuthed() || !getPlayerId()) screen = <Login onDone={() => force(n => n + 1)} />;
    else screen = path.startsWith("/score") ? <ScoreEntry /> : <Admin />;
  } else {
    screen = <Home />; // public
  }

  return (
    <>
      {screen}
      {/* CRT scanline overlay, app-wide. Hidden on the TV board so it never
          interferes with a projected leaderboard.
          TEMP: commented out to evaluate a cleaner, scanline-free look.
          Re-enable by uncommenting the line below. */}
      {/* {!tv && <div className="bc-crt" />} */}
    </>
  );
}

export const go = (p: string) => { window.history.pushState({}, "", p); window.dispatchEvent(new PopStateEvent("popstate")); };
