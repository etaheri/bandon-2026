import { useEffect, useState } from "react";
import { BackButton } from "../ui/BackButton";
import { Login } from "./Login";
import { useBook } from "../state/useBook";
import { usePlayers } from "../state/players";
import { getPlayerId, isAdmin } from "../state/session";
import { api } from "../api/client";
import { homeCss } from "../ui/homeCss";

// The `bc-ghost` button and `bc-kicker` styles live in homeCss (only Home
// injects them). Book is a standalone screen, so inject the same stylesheet
// once — idempotent via the shared `bc-home-css` element id.
function useBroadcastCss() {
  useEffect(() => {
    if (document.getElementById("bc-home-css")) return;
    const el = document.createElement("style");
    el.id = "bc-home-css";
    el.textContent = homeCss;
    document.head.appendChild(el);
  }, []);
}

export function Book() {
  useBroadcastCss();
  const { data, refresh } = useBook();
  const players = usePlayers();
  const [, force] = useState(0);
  const [loggingIn, setLoggingIn] = useState(false);
  const me = getPlayerId();
  const admin = isAdmin();
  const [busy, setBusy] = useState(false);

  // Let users log in right here instead of detouring through Home → Press Start.
  if (loggingIn) return <Login onDone={() => { setLoggingIn(false); force((n) => n + 1); refresh(); }} />;

  const name = (id: string) => players[id]?.name ?? id;

  async function pick(propId: string, optionId: string) {
    if (!me || busy) return;
    setBusy(true);
    try { await api.bookPick({ propId, optionId, playerId: me }); await refresh(); }
    catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }
  async function lock(propId: string) {
    setBusy(true);
    try { await api.bookLock(propId); await refresh(); }
    catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }
  async function resolve(propId: string, winningOptionId: string) {
    setBusy(true);
    try { await api.bookResolve({ propId, winningOptionId }); await refresh(); }
    catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  const props = data?.props ?? [];
  const standings = data?.standings ?? [];

  return (
    <div className="bc-page" style={{ display: "grid", gap: 14, paddingBottom: 40 }}>
      <BackButton />
      <h1 className="bc-screen-title" style={{ fontSize: "clamp(34px,11vw,56px)" }}>The Bandon Book</h1>
      <p className="bc-kicker" style={{ color: "var(--gold)", margin: 0, letterSpacing: 2, textTransform: "uppercase",
        fontFamily: '"Arial Narrow",Impact', fontStyle: "italic", fontWeight: 900 }}>
        Call it. Lock it in. Bragging rights only.
      </p>

      {!me && (
        <button className="btn" onClick={() => setLoggingIn(true)}>🔑 Log in to make picks</button>
      )}

      <div className="panel" style={{ padding: 14, display: "grid", gap: 8 }}>
        <div style={{ fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", opacity: .85 }}>Standings</div>
        {standings.length === 0 && <div style={{ opacity: .6 }}>No calls resolved yet.</div>}
        {standings.map((s: any, i: number) => (
          <div key={s.playerId} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 22, textAlign: "right", opacity: .6 }}>{i + 1}</span>
            <span style={{ flex: 1, fontWeight: 700 }}>
              {s.name} {s.titles.map((t: string) => <span key={t} style={{ marginLeft: 4 }}>{t}</span>)}
            </span>
            <span className="g" style={{ color: "var(--gold)", fontVariantNumeric: "tabular-nums" }}>
              {s.correct}<span style={{ opacity: .5 }}>/{s.resolvedPicked}</span>
            </span>
          </div>
        ))}
      </div>

      <PostProp me={me} onPosted={refresh} onLogin={() => setLoggingIn(true)} />

      {props.length === 0 && <div style={{ opacity: .6, textAlign: "center" }}>No props yet — post the first one.</div>}
      {props.map((p: any) => (
        <PropCard key={p.id} p={p} me={me} admin={admin} busy={busy}
          name={name} onPick={pick} onLock={lock} onResolve={resolve} onLogin={() => setLoggingIn(true)} />
      ))}
    </div>
  );
}

function PropCard({ p, me, admin, busy, name, onPick, onLock, onResolve, onLogin }: {
  p: any; me: string | null; admin: boolean; busy: boolean; name: (id: string) => string;
  onPick: (propId: string, optionId: string) => void;
  onLock: (propId: string) => void;
  onResolve: (propId: string, optionId: string) => void;
  onLogin: () => void;
}) {
  const closed = p.status !== "open";
  const resolved = p.status === "resolved";
  const statusLabel = resolved ? "✓ RESOLVED" : p.status === "locked" ? "🔒 PICKS CLOSED" : "OPEN";
  return (
    <div className="panel" style={{ padding: 14, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>{p.subject}</div>
        <div style={{ fontSize: 12, opacity: .7, whiteSpace: "nowrap" }}>{statusLabel}</div>
      </div>
      {p.description && <div style={{ opacity: .8, fontSize: 14 }}>{p.description}</div>}

      <div style={{ display: "grid", gap: 8 }}>
        {p.options.map((o: any) => {
          const mine = p.myPick === o.id;
          const winner = resolved && p.winningOptionId === o.id;
          const canPick = !closed && !!me && !p.myPick && !busy;
          const needsLogin = !closed && !me; // open prop, not logged in → tap to log in
          return (
            <button key={o.id} className="btn"
              disabled={!canPick && !needsLogin}
              onClick={() => needsLogin ? onLogin() : canPick && onPick(p.id, o.id)}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                opacity: canPick || needsLogin || mine || winner ? 1 : .6,
                borderColor: winner ? "var(--gold)" : mine ? "var(--gold)" : undefined,
                boxShadow: winner ? "0 0 0 2px var(--gold) inset" : undefined,
              }}>
              <span>{winner && "🏆 "}{o.label}{mine && " ✓"}</span>
              <span style={{ opacity: .6, fontVariantNumeric: "tabular-nums" }}>{o.pickCount}</span>
            </button>
          );
        })}
      </div>

      {p.picks.length > 0 && (
        <div style={{ fontSize: 12, opacity: .7 }}>
          {p.options.map((o: any) => {
            const who = p.picks.filter((pk: any) => pk.optionId === o.id).map((pk: any) => name(pk.playerId));
            return who.length ? <div key={o.id}><b>{o.label}:</b> {who.join(", ")}</div> : null;
          })}
        </div>
      )}

      {admin && !resolved && (
        <div style={{ display: "grid", gap: 6, borderTop: "1px solid rgba(255,255,255,.12)", paddingTop: 10 }}>
          {p.status === "open" && (
            <button className="bc-ghost" disabled={busy} onClick={() => onLock(p.id)}>🔒 Lock picks</button>
          )}
          <div style={{ fontSize: 12, opacity: .7 }}>Resolve — pick the winner:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {p.options.map((o: any) => (
              <button key={o.id} className="bc-ghost" disabled={busy} onClick={() => onResolve(p.id, o.id)}>{o.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PostProp({ me, onPosted, onLogin }: { me: string | null; onPosted: () => void; onLogin: () => void }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);

  if (!me) return <button className="bc-ghost" onClick={onLogin}>Log in to post props or make picks</button>;
  if (!open) return <button className="bc-ghost" onClick={() => setOpen(true)}>+ Post a prop</button>;

  const setOpt = (i: number, v: string) => setOptions((a) => a.map((x, j) => (j === i ? v : x)));

  async function submit() {
    const labels = options.map((o) => o.trim()).filter(Boolean);
    if (!subject.trim() || labels.length < 2) { alert("Need a subject and at least 2 options."); return; }
    setBusy(true);
    try {
      await api.bookProp({ creator: me!, subject: subject.trim(), description: description.trim() || undefined, options: labels });
      setSubject(""); setDescription(""); setOptions(["", ""]); setOpen(false);
      onPosted();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="panel" style={{ padding: 14, display: "grid", gap: 8 }}>
      <div style={{ fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>New prop</div>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (e.g. Bruce's first tee shot)" style={{ padding: 12 }} />
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Flavor text (optional)" style={{ padding: 12 }} />
      {options.map((o, i) => (
        <div key={i} style={{ display: "flex", gap: 6 }}>
          <input value={o} onChange={(e) => setOpt(i, e.target.value)} placeholder={`Option ${i + 1}`} style={{ padding: 12, flex: 1 }} />
          {options.length > 2 && <button className="bc-ghost" onClick={() => setOptions((a) => a.filter((_, j) => j !== i))}>✕</button>}
        </div>
      ))}
      {options.length < 8 && <button className="bc-ghost" onClick={() => setOptions((a) => [...a, ""])}>+ Add option</button>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn" disabled={busy} onClick={submit} style={{ flex: 1 }}>Post</button>
        <button className="bc-ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
