import { describe, expect, it } from "vitest";
import { evaluationCases } from "../src/server/evaluation";
import { validateGeometry } from "../src/server/geometry";

describe("seeded evaluation family", () => {
  it("reproduces valid synthetic cases and varies with the seed", () => {
    const cases = evaluationCases();
    expect(cases).toHaveLength(35);
    expect(cases).toEqual(evaluationCases());
    expect(cases).not.toEqual(evaluationCases(42));
    expect(
      new Set(cases.slice(3).map((m) => m.bricks.length)).size,
    ).toBeGreaterThan(8);
    for (const model of cases)
      expect(() => validateGeometry(model)).not.toThrow();
  });
});
