import { describe, it, expect } from "vitest";
import { roundStart, classifyRounds, liveRound, nextUpcoming } from "../../src/schedule";
import type { Round } from "../../src/scoring/types";

const R = (id: string, date: string, teeTime: string): Round =>
  ({ id, courseId: "c", label: id.toUpperCase(), day: "THU", date, teeTime, counts: true, doublePoints: false });

const rounds: Round[] = [
  R("r2", "2026-06-04", "7:30 AM"),
  R("r3", "2026-06-04", "2:00 PM"),
  R("r4", "2026-06-05", "9:30 AM"),
];

// roundStart pins tee times to Pacific (PDT, UTC−7). Asserting via toISOString()
// (always UTC) keeps these tests independent of the machine's timezone.
describe("roundStart", () => {
  it("parses date + tee time into a Pacific-pinned instant", () => {
    // 2:00 PM PDT == 21:00 UTC
    expect(roundStart(R("x", "2026-06-04", "2:00 PM")).toISOString()).toBe("2026-06-04T21:00:00.000Z");
  });
  it("parses AM and noon-area times", () => {
    // 7:30 AM PDT == 14:30 UTC; 12:10 PM PDT == 19:10 UTC
    expect(roundStart(R("x", "2026-06-04", "7:30 AM")).toISOString()).toBe("2026-06-04T14:30:00.000Z");
    expect(roundStart(R("x", "2026-06-04", "12:10 PM")).toISOString()).toBe("2026-06-04T19:10:00.000Z");
  });
});

describe("classifyRounds", () => {
  // `now` values carry an explicit -07:00 offset so they mean a fixed Pacific instant
  // regardless of the test machine's timezone.
  const at = (s: string) => new Date(s);
  it("before the trip: none live, all upcoming", () => {
    const c = classifyRounds(rounds, at("2026-06-04T06:00:00-07:00"));
    expect(c.map(x => x.status)).toEqual(["UPCOMING", "UPCOMING", "UPCOMING"]);
    expect(liveRound(rounds, at("2026-06-04T06:00:00-07:00"))).toBeNull();
    expect(nextUpcoming(rounds, at("2026-06-04T06:00:00-07:00"))?.id).toBe("r2");
  });
  it("mid-morning: that round is live", () => {
    const c = classifyRounds(rounds, at("2026-06-04T09:00:00-07:00"));
    expect(c.find(x => x.roundId === "r2")!.status).toBe("LIVE");
    expect(c.find(x => x.roundId === "r3")!.status).toBe("UPCOMING");
    expect(liveRound(rounds, at("2026-06-04T09:00:00-07:00"))?.id).toBe("r2");
  });
  it("gap between rounds: morning stays live until afternoon starts", () => {
    expect(liveRound(rounds, at("2026-06-04T13:00:00-07:00"))?.id).toBe("r2");
    expect(liveRound(rounds, at("2026-06-04T14:30:00-07:00"))?.id).toBe("r3");
  });
  it("last round stays live (no later round); earlier are completed", () => {
    const c = classifyRounds(rounds, at("2026-06-05T10:00:00-07:00"));
    expect(c.find(x => x.roundId === "r2")!.status).toBe("COMPLETED");
    expect(c.find(x => x.roundId === "r3")!.status).toBe("COMPLETED");
    expect(c.find(x => x.roundId === "r4")!.status).toBe("LIVE");
  });
});
