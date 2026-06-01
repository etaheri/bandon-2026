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

describe("roundStart", () => {
  it("parses date + tee time into a local Date", () => {
    const d = roundStart(R("x", "2026-06-04", "2:00 PM"));
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(4);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(0);
  });
  it("parses AM and noon-area times", () => {
    expect(roundStart(R("x", "2026-06-04", "7:30 AM")).getHours()).toBe(7);
    expect(roundStart(R("x", "2026-06-04", "12:10 PM")).getHours()).toBe(12);
  });
});

describe("classifyRounds", () => {
  const at = (s: string) => new Date(s);
  it("before the trip: none live, all upcoming", () => {
    const c = classifyRounds(rounds, at("2026-06-04T06:00:00"));
    expect(c.map(x => x.status)).toEqual(["UPCOMING", "UPCOMING", "UPCOMING"]);
    expect(liveRound(rounds, at("2026-06-04T06:00:00"))).toBeNull();
    expect(nextUpcoming(rounds, at("2026-06-04T06:00:00"))?.id).toBe("r2");
  });
  it("mid-morning: that round is live", () => {
    const c = classifyRounds(rounds, at("2026-06-04T09:00:00"));
    expect(c.find(x => x.roundId === "r2")!.status).toBe("LIVE");
    expect(c.find(x => x.roundId === "r3")!.status).toBe("UPCOMING");
    expect(liveRound(rounds, at("2026-06-04T09:00:00"))?.id).toBe("r2");
  });
  it("gap between rounds: morning stays live until afternoon starts", () => {
    expect(liveRound(rounds, at("2026-06-04T13:00:00"))?.id).toBe("r2");
    expect(liveRound(rounds, at("2026-06-04T14:30:00"))?.id).toBe("r3");
  });
  it("last round stays live (no later round); earlier are completed", () => {
    const c = classifyRounds(rounds, at("2026-06-05T10:00:00"));
    expect(c.find(x => x.roundId === "r2")!.status).toBe("COMPLETED");
    expect(c.find(x => x.roundId === "r3")!.status).toBe("COMPLETED");
    expect(c.find(x => x.roundId === "r4")!.status).toBe("LIVE");
  });
});
