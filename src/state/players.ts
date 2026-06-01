// Single source of truth for player display data (name, handicap, team).
//
// Names and handicaps live in the database and are admin-editable, so every
// screen must read them from the API — not from the static broadcast roster,
// which would silently go stale the moment an admin edits a handicap. The
// static roster in broadcast.ts is kept only as an offline/pre-load fallback so
// the public landing page still renders something before /state resolves.
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { PLAYERS as STATIC } from "../data/broadcast";
import { playingHandicap } from "../scoring/strokes";

export type TeamId = "GORSE" | "DRIFTWOOD";
/** `handicap` is the course handicap index; `playing` is the strokes actually
 *  received this trip (index × allowance, rounded) — i.e. the pops on a card. */
export interface PlayerInfo { name: string; handicap: number; playing: number; team: TeamId; }

const DEFAULT_ALLOWANCE = 0.75;

const fallback: Record<string, PlayerInfo> = Object.fromEntries(
  Object.entries(STATIC).map(([id, p]) => [id, { name: p.name, handicap: p.hcp, playing: playingHandicap(p.hcp, DEFAULT_ALLOWANCE), team: p.team }]),
);

let cache: Record<string, PlayerInfo> | null = null;
let inflight: Promise<Record<string, PlayerInfo>> | null = null;

function load(): Promise<Record<string, PlayerInfo>> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = api.state()
      .then((s: any) => {
        const allowance = Number(s.settings?.allowance) || DEFAULT_ALLOWANCE;
        const dir: Record<string, PlayerInfo> = {};
        for (const p of s.players) dir[p.id] = { name: p.name, handicap: p.handicap, playing: playingHandicap(p.handicap, allowance), team: p.team };
        cache = dir;
        return dir;
      })
      .catch(() => fallback); // offline / pre-auth — show the static roster
  }
  return inflight;
}

/**
 * Player directory sourced from the API, shared across screens via a module
 * cache. Returns the static fallback until the first /state load resolves.
 */
export function usePlayers(): Record<string, PlayerInfo> {
  const [dir, setDir] = useState<Record<string, PlayerInfo>>(cache ?? fallback);
  useEffect(() => {
    let on = true;
    load().then(d => { if (on) setDir(d); });
    return () => { on = false; };
  }, []);
  return dir;
}

/** Best-effort synchronous lookup (cache or fallback) for non-hook call sites. */
export function playerDir(): Record<string, PlayerInfo> {
  return cache ?? fallback;
}
