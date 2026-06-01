import { describe, expect, test } from "vitest";
import { allScored, groupMembers, groupOf } from "../../src/groups";
import type { Player } from "../../src/scoring/types";

const P = (id: string): Player => ({
  id,
  name: id.toUpperCase(),
  handicap: 10,
  quotaOverride: null,
  team: "GORSE",
});

// players[] order is intentionally NOT the tee-assignment order, so we can
// assert group members come back in players[] order.
const players: Player[] = [P("a"), P("b"), P("c"), P("d"), P("e")];

const tee = [
  { round_id: "r2", player_id: "c", group_no: 1 },
  { round_id: "r2", player_id: "a", group_no: 1 },
  { round_id: "r2", player_id: "b", group_no: 2 },
  { round_id: "r2", player_id: "d", group_no: 2 },
  // "e" is unassigned for r2
];

describe("groupOf", () => {
  test("returns the group number a player is assigned to", () => {
    expect(groupOf("r2", "a", tee)).toBe(1);
    expect(groupOf("r2", "b", tee)).toBe(2);
  });

  test("returns null when the player has no assignment for the round", () => {
    expect(groupOf("r2", "e", tee)).toBeNull();
    expect(groupOf("r3", "a", tee)).toBeNull();
  });
});

describe("groupMembers", () => {
  test("returns every player in the same group, in players[] order", () => {
    expect(groupMembers("r2", "a", tee, players).map((p) => p.id)).toEqual([
      "a",
      "c",
    ]);
  });

  test("falls back to just the player when they are unassigned", () => {
    expect(groupMembers("r2", "e", tee, players).map((p) => p.id)).toEqual([
      "e",
    ]);
  });

  test("returns empty when the player does not exist at all", () => {
    expect(groupMembers("r2", "zzz", tee, players)).toEqual([]);
  });
});

describe("allScored", () => {
  const members = [P("a"), P("c")];

  test("true only when every member has a non-null score for the hole", () => {
    const scores = { a: { 1: 5 }, c: { 1: 4 } };
    expect(allScored(members, scores, 1)).toBe(true);
  });

  test("treats a pick-up (gross 0) as scored", () => {
    const scores = { a: { 1: 0 }, c: { 1: 4 } };
    expect(allScored(members, scores, 1)).toBe(true);
  });

  test("false when a member is missing or null for the hole", () => {
    expect(allScored(members, { a: { 1: 5 }, c: { 1: null } }, 1)).toBe(false);
    expect(allScored(members, { a: { 1: 5 } }, 1)).toBe(false);
  });

  test("false for an empty group", () => {
    expect(allScored([], { a: { 1: 5 } }, 1)).toBe(false);
  });
});
