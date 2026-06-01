import { describe, it, expect } from "vitest";
import { pacificDate } from "../../src/time";

// pacificDate resolves a Pacific (PDT) wall-clock moment to an absolute instant.
// Asserting via toISOString() (always UTC) makes these tests independent of the
// machine/device timezone — which is the whole point of pinning.
describe("pacificDate", () => {
  it("resolves a Pacific wall-clock time to the correct UTC instant", () => {
    // 7:30 AM PDT == 14:30 UTC
    expect(pacificDate(2026, 6, 4, 7, 30).toISOString()).toBe("2026-06-04T14:30:00.000Z");
    // 2:00 PM PDT == 21:00 UTC
    expect(pacificDate(2026, 6, 4, 14, 0).toISOString()).toBe("2026-06-04T21:00:00.000Z");
    // 12:10 PM PDT == 19:10 UTC
    expect(pacificDate(2026, 6, 4, 12, 10).toISOString()).toBe("2026-06-04T19:10:00.000Z");
  });
  it("handles hour overflow across midnight UTC", () => {
    // 6:00 PM PDT == 01:00 UTC the next day
    expect(pacificDate(2026, 6, 6, 18, 0).toISOString()).toBe("2026-06-07T01:00:00.000Z");
  });
});
