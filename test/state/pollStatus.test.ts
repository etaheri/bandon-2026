import { describe, it, expect } from "vitest";
import { pollStatus } from "../../src/state/pollStatus";

describe("pollStatus", () => {
  it("is offline before any data has loaded", () => {
    expect(pollStatus(0, false)).toBe("offline");
  });
  it("is live when the last poll succeeded and data exists", () => {
    expect(pollStatus(0, true)).toBe("live");
  });
  it("is reconnecting after 1-2 consecutive failures with data", () => {
    expect(pollStatus(1, true)).toBe("reconnecting");
    expect(pollStatus(2, true)).toBe("reconnecting");
  });
  it("is offline after 3+ consecutive failures", () => {
    expect(pollStatus(3, true)).toBe("offline");
    expect(pollStatus(9, true)).toBe("offline");
  });
});
