import { describe, expect, it } from "vitest";
import { DEMOS } from "../src/server/demos";
import { placements } from "../src/server/planner";
import { collides, contactStuds, movedModel } from "../src/server/geometry";
import { modelSchema, type GraphAnalysis } from "../src/shared/model";

const model = modelSchema.parse(DEMOS["space-cadet"]);
const loose = ["right-tip", "right-wing"];
const analysis: GraphAnalysis = {
  anchoredIds: model.bricks
    .filter((b) => !loose.includes(b.id))
    .map((b) => b.id),
  disconnectedIds: loose,
  groups: [loose],
  edges: [],
  paths: {},
};

describe("repair search bounds", () => {
  it("prefers the smallest valid translation for the complete loose assembly", () => {
    const candidates = placements(model, analysis, new Set());
    expect(candidates[0].offset).toEqual({ x: -1, y: -2, z: 0 });
    expect(candidates[0].movedIds).toEqual(loose);
    expect(candidates.length).toBeLessThanOrEqual(12);
  });
  it("never proposes a collision or a move disconnected from all anchors", () => {
    for (const candidate of placements(model, analysis, new Set())) {
      const next = movedModel(model, loose, candidate.offset);
      const moved = next.bricks.filter((b) => loose.includes(b.id));
      const rest = next.bricks.filter((b) => !loose.includes(b.id));
      expect(moved.some((b) => rest.some((a) => collides(b, a)))).toBe(false);
      expect(moved.some((b) => rest.some((a) => contactStuds(b, a) > 0))).toBe(
        true,
      );
      expect(moved.every((b) => b.y >= 0)).toBe(true);
    }
  });
  it("remembers rejected fingerprints independently of candidate UUIDs", () => {
    const first = placements(model, analysis, new Set())[0];
    expect(
      placements(model, analysis, new Set([first.fingerprint])).some(
        (p) => p.fingerprint === first.fingerprint,
      ),
    ).toBe(false);
  });
});
