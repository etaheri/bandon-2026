import { useEffect, useState } from "react";
import { api } from "../api/client";
import { BackButton } from "../ui/BackButton";
import { balanceTeams, type TeamBalance } from "../scoring/teams";

export function Admin() {
  const [state, setState] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState<TeamBalance | null>(null);
  useEffect(() => { api.state().then(setState); }, []);
  if (!state) return <div style={{ padding: 24 }}>Loading…</div>;

  const update = (id: string, field: string, v: any) =>
    setState((s: any) => ({ ...s, players: s.players.map((p: any) => p.id === id ? { ...p, [field]: v } : p) }));

  const allowance = Number(state.settings.allowance) || 0.75;
  const nameOf = (id: string) => state.players.find((p: any) => p.id === id)?.name ?? id;

  function computeBalance() {
    const roster = state.players.map((p: any) => ({
      id: p.id, name: p.name, handicap: Number(p.handicap), quotaOverride: null, team: p.team,
    }));
    setPreview(balanceTeams(roster, allowance));
    setMsg("");
  }

  async function applyBalance() {
    if (!preview) return;
    const assign = [
      ...preview.teams.GORSE.map((id) => ({ id, team: "GORSE" as const })),
      ...preview.teams.DRIFTWOOD.map((id) => ({ id, team: "DRIFTWOOD" as const })),
    ];
    try {
      // Persist any edited handicaps first so the saved split matches the preview.
      await api.adminHandicaps(state.players.map((p: any) => ({ id: p.id, handicap: Number(p.handicap) })));
      await api.adminTeams(assign);
      const team = Object.fromEntries(assign.map((a) => [a.id, a.team]));
      setState((s: any) => ({ ...s, players: s.players.map((p: any) => ({ ...p, team: team[p.id] ?? p.team })) }));
      setPreview(null);
      setMsg("Teams balanced ✓");
    } catch (e: any) { setMsg(e.message + " (need admin passcode)"); }
  }

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
    <div className="bc-page" style={{ display: "grid", gap: 14 }}>
      <div className="bc-topbar" style={{ marginBottom: 2 }}>
        <BackButton />
        <h1 className="bc-screen-title">Admin</h1>
        <span className="sp" />
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
      <div className="panel" style={{ padding: 12, display: "grid", gap: 8 }}>
        <div className="head">Teams</div>
        <div style={{ opacity: .6, fontSize: 12 }}>
          Auto-balance splits the field into two even teams with the closest possible total
          playing handicap (at {allowance.toFixed(2)} allowance), keeping the lowest indexes on
          opposite sides. Review the preview, then apply.
        </div>
        {!preview ? (
          ["GORSE", "DRIFTWOOD"].map((t) => (
            <div key={t} style={{ fontSize: 14 }}>
              <b>{t}:</b> {state.players.filter((p: any) => p.team === t).map((p: any) => p.name).join(", ") || "—"}
            </div>
          ))
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {(["GORSE", "DRIFTWOOD"] as const).map((t) => (
              <div key={t} style={{ fontSize: 14 }}>
                <b>{t}</b> <span style={{ opacity: .6 }}>(playing {preview.playingTotals[t]})</span>: {preview.teams[t].map(nameOf).join(", ")}
              </div>
            ))}
          </div>
        )}
        {!preview ? (
          <button className="btn" onClick={computeBalance}>Auto-balance teams</button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={applyBalance}>Apply balanced teams</button>
            <button className="btn" onClick={() => setPreview(null)} style={{ opacity: .7 }}>Cancel</button>
          </div>
        )}
      </div>
      <button className="btn" onClick={save}>Save</button>
      {msg && <div className="head">{msg}</div>}
      <div style={{ opacity: .6, fontSize: 12 }}>Set quotas after the Wednesday calibration round. Leave quota blank to use flat 36.</div>
    </div>
  );
}
