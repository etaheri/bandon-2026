// Bandon Cup '26 runs Jun 3–7 2026 — entirely Pacific DAYLIGHT time (UTC−7); there
// is no daylight-saving transition during the trip. Tee times in the schedule are
// Pacific wall-clock. The group is East-Coast based and will check the app on Eastern
// phones before and during travel, so "live / up next / countdown / FINAL-by-clock"
// must resolve those wall-clock times to an absolute instant pinned to Pacific — NOT
// the viewing device's local timezone (which is JS's default `new Date(y,m,d,h,min)`).
const PACIFIC_UTC_OFFSET_HOURS = 7; // PDT = UTC−7, valid for every date in this trip

/**
 * Resolve a Pacific (PDT) wall-clock moment to an absolute Date, independent of the
 * device's timezone. `month1` is 1-based. `Date.UTC` handles hour overflow
 * (e.g. 18 + 7 = 25 → 01:00 UTC the next day).
 */
export function pacificDate(year: number, month1: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month1 - 1, day, hour + PACIFIC_UTC_OFFSET_HOURS, minute));
}
