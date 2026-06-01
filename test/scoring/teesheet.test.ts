import { describe, expect, test } from "vitest";
import { monthDay, roundDetails } from "../../src/teesheet";
import type { Round } from "../../src/scoring/types";

const round = (over: Partial<Round> = {}): Round => ({
  id: "r2",
  courseId: "pacific",
  label: "Round 1",
  day: "THU",
  date: "2026-06-04",
  teeTime: "7:30 AM",
  counts: true,
  doublePoints: false,
  ...over,
});

const courses = [
  { id: "pacific", name: "Pacific Dunes", par: 72 },
  { id: "sheep", name: "Sheep Ranch", par: 71 },
];

describe("monthDay", () => {
  test("formats an ISO date as M/D", () => {
    expect(monthDay("2026-06-04")).toBe("6/4");
    expect(monthDay("2026-12-25")).toBe("12/25");
  });

  test("returns empty string for a missing or malformed date", () => {
    expect(monthDay("")).toBe("");
    expect(monthDay("nonsense")).toBe("");
  });
});

describe("roundDetails", () => {
  test("joins the course name into the title and exposes par", () => {
    const d = roundDetails(round(), courses);
    expect(d.title).toBe("Round 1 — Pacific Dunes");
    expect(d.par).toBe(72);
  });

  test("combines weekday and month/day", () => {
    expect(roundDetails(round(), courses).dayDate).toBe("THU 6/4");
  });

  test("carries the tee time and double-points flag through", () => {
    const d = roundDetails(round({ doublePoints: true }), courses);
    expect(d.teeTime).toBe("7:30 AM");
    expect(d.doublePoints).toBe(true);
  });

  test("degrades to label-only with null par when the course is unknown", () => {
    const d = roundDetails(round({ courseId: "ghost" }), courses);
    expect(d.title).toBe("Round 1");
    expect(d.par).toBeNull();
  });

  test("falls back to weekday alone when there is no date", () => {
    expect(roundDetails(round({ date: "" }), courses).dayDate).toBe("THU");
  });
});
