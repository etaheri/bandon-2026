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
    <div style={{ padding: 24 }}>
      <h1 className="head">Who are you?</h1>
      <div style={{ display: "grid", gap: 10 }}>
        {players.map(p => (
          <button key={p.id} className="btn" onClick={() => { setPlayerId(p.id); onDone(); }}>{p.name}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ padding: 24, display: "grid", gap: 14, placeContent: "center", height: "100%" }}>
      <h1 className="head" style={{ textAlign: "center" }}>Bandon Cup '26</h1>
      <input value={passcode} onChange={e => setPasscode(e.target.value)} placeholder="Trip passcode" inputMode="text"
        style={{ padding: 16, fontSize: 18, borderRadius: 10, border: "none" }} />
      <button className="btn" onClick={submit}>Enter</button>
      {err && <div style={{ color: "#ff8080" }}>{err}</div>}
    </div>
  );
}
