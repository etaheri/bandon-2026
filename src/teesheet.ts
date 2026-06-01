import type { Round } from "./scoring/types";

export interface RoundDetails {
  /** "Round 1 — Pacific Dunes", or just the label when the course is unknown. */
  title: string;
  /** "THU 6/4", or the weekday alone when there is no date. */
  dayDate: string;
  teeTime: string;
  /** Course par, or null when the course is unknown. */
  par: number | null;
  doublePoints: boolean;
}

/** Format an ISO `YYYY-MM-DD` date as `M/D`. Empty/malformed → "". */
export function monthDay(dateISO: string): string {
  if (!dateISO) return "";
  const [, m, d] = dateISO.split("-").map(Number);
  if (!m || !d) return "";
  return `${m}/${d}`;
}

/** Build the tee-sheet header fields for a round, joining its course. */
export function roundDetails(
  round: Round,
  courses: { id: string; name: string; par: number }[],
): RoundDetails {
  const course = courses.find((c) => c.id === round.courseId);
  const md = monthDay(round.date);
  return {
    title: course ? `${round.label} — ${course.name}` : round.label,
    dayDate: md ? `${round.day} ${md}` : round.day,
    teeTime: round.teeTime,
    par: course ? course.par : null,
    doublePoints: round.doublePoints,
  };
}
