import { useState } from "react";
import { api } from "../api/client";
import { setAuthed, setPlayerId } from "../state/session";

export function Login({ onDone }: { onDone: () => void }) {
  const [passcode, setPasscode] = useState("");
  const [players, setPlayers] = useState<any[] | null>(null);
  const [err, setErr] = useState("");

  async function submit() {
    try {
      await api.auth(passcode);
      setAuthed(true);
      const st = await api.state();
      setPlayers(st.players);
    } catch (e: any) { setErr(e.message); }
  }

  if (players) return (
    <div className="bc-page" style={{ display: "grid", alignContent: "center", gap: 14, minHeight: "100dvh" }}>
      <p className="bc-kicker" style={{ textAlign: "center", color: "var(--gold)", margin: 0,
        fontFamily: '"Arial Narrow",Impact', fontStyle: "italic", fontWeight: 900, letterSpacing: 3, textTransform: "uppercase" }}>
        Select Your Player
      </p>
      <h1 className="bc-screen-title bc-fade" style={{ textAlign: "center", fontSize: "clamp(30px,9vw,46px)" }}>Who Are You?</h1>
      <div style={{ display: "grid", gap: 10, marginTop: 6 }}>
        {players.map((p, i) => (
          <button key={p.id} className="btn bc-fade" style={{ animationDelay: `${i * 35}ms` }}
            onClick={() => { setPlayerId(p.id); onDone(); }}>{p.name}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bc-page" style={{ display: "grid", alignContent: "center", gap: 14, minHeight: "100dvh", maxWidth: 440 }}>
      <p style={{ textAlign: "center", margin: 0, color: "var(--gold)",
        fontFamily: '"Arial Narrow",Impact', fontStyle: "italic", fontWeight: 900, letterSpacing: 3, textTransform: "uppercase" }}>
        Bandon Dunes Resort · Oregon
      </p>
      <h1 className="bc-screen-title" style={{ textAlign: "center", fontSize: "clamp(40px,13vw,68px)" }}>Bandon Cup '26</h1>
      <input value={passcode} onChange={e => setPasscode(e.target.value)} placeholder="Trip passcode" inputMode="text"
        style={{ padding: 16, fontSize: 18, textAlign: "center" }} onKeyDown={e => { if (e.key === "Enter") submit(); }} />
      <button className="btn" onClick={submit}>Enter</button>
      {err && <div style={{ color: "var(--bad)", textAlign: "center" }}>{err}</div>}
    </div>
  );
}
