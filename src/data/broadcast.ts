// Full-week broadcast schedule for the landing page.
//
// Every tee time of the trip lives here — including the Wednesday warm-up at
// Bandon Trails and the Sunday send-off (Pacific Dunes + Bandon Preserve) that
// are NOT scored. The six counting rounds carry a `roundId` (r2..r7) so the
// "Enter Score" CTA can deep-link into the real scoring screen; the warm-up and
// send-off have `roundId: null` and are shown for the vibe only.
//
// Group seats are stored as player ids and resolved through PLAYERS, so the
// logged-in player's foursome can be highlighted across the whole schedule.

import { pacificDate } from "../time";

export type TeamId = "GORSE" | "DRIFTWOOD";

export const PLAYERS: Record<string, { name: string; first: string; team: TeamId; hcp: number }> = {
  taheri:   { name: "Erik Taheri",     first: "Erik",    team: "DRIFTWOOD", hcp: 4.6 },
  desabio:  { name: "Pete DeSabio",    first: "Pete",    team: "GORSE",     hcp: 8.6 },
  laflair:  { name: "Matt LaFlair",    first: "Matt",    team: "GORSE",     hcp: 8.6 },
  stenzel:  { name: "Bruce Stenzel",   first: "Bruce",   team: "GORSE",     hcp: 14 },
  meissner: { name: "Ryan Meissner",   first: "Ryan",    team: "GORSE",     hcp: 14 },
  grattan:  { name: "Jeff Grattan",    first: "Jeff",    team: "DRIFTWOOD", hcp: 15 },
  sloan:    { name: "Gavin Sloan",     first: "Gavin",   team: "DRIFTWOOD", hcp: 14.6 },
  johnson:  { name: "Anthony Johnson", first: "Anthony", team: "DRIFTWOOD", hcp: 10 },
};

export const TEAMS: Record<TeamId, { name: string; color: string; roster: string[] }> = {
  GORSE:     { name: "Gorse",     color: "#F4A300", roster: ["desabio", "laflair", "stenzel", "meissner"] },
  DRIFTWOOD: { name: "Driftwood", color: "#2E8BFF", roster: ["taheri", "grattan", "sloan", "johnson"] },
};

export interface TeeGroup {
  time: string;       // 24h "HH:MM" — used to build a Date
  label: string;      // display "3:40 PM"
  course: string;     // course name
  seats: string[];    // player ids, in tee-sheet order
}

export type SessionKind = "WARMUP" | "COUNTS" | "SENDOFF";

export interface Session {
  id: string;
  kind: SessionKind;
  tag: string;        // short broadcast tag: "WARM-UP", "ROUND 1", "SEND-OFF"
  roundId: string | null; // links to scoring round (r2..r7) when it counts
  double: boolean;
  date: string;       // YYYY-MM-DD
  dayLabel: string;   // "WED · JUN 3"
  groups: TeeGroup[];
}

export const SESSIONS: Session[] = [
  {
    id: "warmup", kind: "WARMUP", tag: "WARM-UP", roundId: null, double: false,
    date: "2026-06-03", dayLabel: "WED · JUN 3",
    groups: [
      { time: "15:40", label: "3:40 PM", course: "Bandon Trails", seats: ["sloan", "grattan", "laflair", "meissner"] },
      { time: "15:50", label: "3:50 PM", course: "Bandon Trails", seats: ["johnson", "stenzel", "taheri", "desabio"] },
    ],
  },
  {
    id: "r2", kind: "COUNTS", tag: "ROUND 1", roundId: "r2", double: false,
    date: "2026-06-04", dayLabel: "THU · JUN 4",
    groups: [
      { time: "07:30", label: "7:30 AM", course: "Pacific Dunes", seats: ["desabio", "meissner", "laflair", "taheri"] },
      { time: "07:40", label: "7:40 AM", course: "Pacific Dunes", seats: ["grattan", "sloan", "stenzel", "johnson"] },
    ],
  },
  {
    id: "r3", kind: "COUNTS", tag: "ROUND 2", roundId: "r3", double: false,
    date: "2026-06-04", dayLabel: "THU · JUN 4",
    groups: [
      { time: "14:00", label: "2:00 PM", course: "Old Macdonald", seats: ["meissner", "stenzel", "desabio", "sloan"] },
      { time: "14:10", label: "2:10 PM", course: "Old Macdonald", seats: ["laflair", "grattan", "johnson", "taheri"] },
    ],
  },
  {
    id: "r4", kind: "COUNTS", tag: "ROUND 3", roundId: "r4", double: false,
    date: "2026-06-05", dayLabel: "FRI · JUN 5",
    groups: [
      { time: "09:30", label: "9:30 AM", course: "Bandon Dunes", seats: ["taheri", "laflair", "sloan", "stenzel"] },
      { time: "09:40", label: "9:40 AM", course: "Bandon Dunes", seats: ["desabio", "johnson", "meissner", "grattan"] },
    ],
  },
  {
    id: "r5", kind: "COUNTS", tag: "ROUND 4", roundId: "r5", double: false,
    date: "2026-06-05", dayLabel: "FRI · JUN 5",
    groups: [
      { time: "15:40", label: "3:40 PM", course: "Sheep Ranch", seats: ["stenzel", "laflair", "grattan", "desabio"] },
      { time: "15:50", label: "3:50 PM", course: "Sheep Ranch", seats: ["meissner", "johnson", "taheri", "sloan"] },
    ],
  },
  {
    id: "r6", kind: "COUNTS", tag: "ROUND 5", roundId: "r6", double: false,
    date: "2026-06-06", dayLabel: "SAT · JUN 6",
    groups: [
      { time: "07:20", label: "7:20 AM", course: "Bandon Trails", seats: ["stenzel", "meissner", "johnson", "laflair"] },
      { time: "07:30", label: "7:30 AM", course: "Bandon Trails", seats: ["grattan", "desabio", "taheri", "sloan"] },
    ],
  },
  {
    id: "r7", kind: "COUNTS", tag: "ROUND 6", roundId: "r7", double: true,
    date: "2026-06-06", dayLabel: "SAT · JUN 6",
    groups: [
      { time: "14:40", label: "2:40 PM", course: "Pacific Dunes", seats: ["taheri", "meissner", "grattan", "stenzel"] },
      { time: "14:50", label: "2:50 PM", course: "Pacific Dunes", seats: ["johnson", "laflair", "desabio", "sloan"] },
    ],
  },
  {
    id: "sendoff", kind: "SENDOFF", tag: "SEND-OFF", roundId: null, double: false,
    date: "2026-06-07", dayLabel: "SUN · JUN 7",
    groups: [
      { time: "07:00", label: "7:00 AM", course: "Pacific Dunes", seats: ["laflair", "taheri", "sloan", "stenzel"] },
      { time: "07:30", label: "7:30 AM", course: "Bandon Preserve", seats: ["desabio", "meissner"] },
    ],
  },
];

/** Absolute Date for a group's tee time, pinned to Pacific (see src/time.ts). */
export function teeDate(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return pacificDate(y ?? 1970, m ?? 1, d ?? 1, h ?? 0, min ?? 0);
}

/** Earliest tee of a session. */
export function sessionStart(s: Session): Date {
  return s.groups
    .map((g) => teeDate(s.date, g.time))
    .sort((a, b) => a.getTime() - b.getTime())[0]!;
}

const ROUND_MS = 5.5 * 60 * 60 * 1000; // assume a session is "live" for ~5.5h

export type Phase =
  | { kind: "PRE"; next: Session }
  | { kind: "LIVE"; live: Session; next: Session | null }
  | { kind: "DONE" };

/** Where the trip is relative to `now`: pre-trip, mid-session, or complete. */
export function phaseAt(now: Date): Phase {
  const sorted = [...SESSIONS].sort((a, b) => sessionStart(a).getTime() - sessionStart(b).getTime());
  const t = now.getTime();
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i]!;
    const start = sessionStart(s).getTime();
    if (t < start) return { kind: "PRE", next: s };
    if (t < start + ROUND_MS) return { kind: "LIVE", live: s, next: sorted[i + 1] ?? null };
  }
  return { kind: "DONE" };
}

/** Course label for a session header (handles the split Sunday send-off). */
export function sessionCourses(s: Session): string {
  const names = [...new Set(s.groups.map((g) => g.course))];
  return names.join(" + ");
}

/** "2d 4h", "3h 12m", "8m" style countdown to a target. */
export function countdown(toMs: number, now: Date): string {
  let ms = toMs - now.getTime();
  if (ms <= 0) return "NOW";
  const d = Math.floor(ms / 86400000); ms -= d * 86400000;
  const h = Math.floor(ms / 3600000); ms -= h * 3600000;
  const m = Math.floor(ms / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
