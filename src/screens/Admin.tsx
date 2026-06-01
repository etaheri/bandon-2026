import { useEffect, useState } from "react";
import { api } from "../api/client";
import { go } from "../App";

export function Admin() {
  const [state, setState] = useState<any>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { api.state().then(setState); }, []);
  if (!state) return <div style={{ padding: 24 }}>Loading…</div>;

  const update = (id: string, field: string, v: any) =>
    setState((s: any) => ({ ...s, players: s.players.map((p: any) => p.id === id ? { ...p, [field]: v } : p) }));

  async function save() {
    try {
      await api.adminHandicaps(state.players.map((p: any) => ({ id: p.id, handicap: Number(p.handicap) })));
      await api.adminSettings({
        allowance: Number(state.settings.allowance),
        quotaOverrides: state.players.map((p: any) => ({ id: p.id, quota: p.quotaOverride === "" || p.quotaOverride == null ? null : Number(p.quotaOverride) })),
      });
      setMsg("Saved ✓");
    } catch (e: any) { setMsg(e.message + " (need admin passcode)"); }
  }

  return (
    <div style={{ padding: 20, display: "grid", gap: 14 }}>
      <div className="head" style={{ display: "flex", justifyContent: "space-between" }}>
        <button className="btn" onClick={() => go("/")}>‹</button><span>Admin</span><span />
      </div>
      <label className="panel" style={{ padding: 12 }}>
        Handicap allowance:
        <input value={state.settings.allowance} onChange={e => setState((s: any) => ({ ...s, settings: { ...s.settings, allowance: e.target.value } }))}
          style={{ marginLeft: 8, width: 80 }} />
        <span style={{ opacity: .6 }}> (e.g. 0.75)</span>
      </label>
      <div className="panel" style={{ padding: 12, display: "grid", gap: 8 }}>
        <div className="head">Players</div>
        {state.players.map((p: any) => (
          <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1fr 70px 90px", gap: 8, alignItems: "center" }}>
            <span>{p.name} <span style={{ opacity: .5 }}>({p.team})</span></span>
            <input value={p.handicap} onChange={e => update(p.id, "handicap", e.target.value)} placeholder="hcp" />
            <input value={p.quotaOverride ?? ""} onChange={e => update(p.id, "quotaOverride", e.target.value)} placeholder="quota" />
          </div>
        ))}
      </div>
      <button className="btn" onClick={save}>Save</button>
      {msg && <div className="head">{msg}</div>}
      <div style={{ opacity: .6, fontSize: 12 }}>Set quotas after the Wednesday calibration round. Leave quota blank to use flat 36.</div>
    </div>
  );
}
