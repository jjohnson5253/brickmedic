import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { DEMOS } from "../src/server/demos";
import { createProof, modelHash, validateProof } from "../src/server/proof";
import { modelSchema, type Candidate } from "../src/shared/model";
import { movedModel } from "../src/server/geometry";

function example() {
  const model = modelSchema.parse(DEMOS["space-cadet"]);
  const before = { model, revision: 1, rootIds: ["hull-a", "hull-b"] };
  const candidate = {
    id: randomUUID(),
    movedIds: ["right-tip", "right-wing"],
    offset: { x: -1, y: -2, z: 0 },
  } as Candidate;
  return createProof(
    before,
    {
      ...before,
      revision: 2,
      model: movedModel(model, candidate.movedIds, candidate.offset),
    },
    candidate,
    10,
    12,
    ["right-tip", "right-wing", "hull-b"],
  );
}
describe("replayable repair receipts", () => {
  it("binds both model states, roots, declared movement and revision", () => {
    const proof = example();
    expect(validateProof(proof)).toEqual(proof);
    expect(
      modelHash({
        ...proof.before,
        bricks: [...proof.before.bricks].reverse(),
      }),
    ).toBe(proof.beforeHash);
  });
  it("rejects altered geometry even with a recomputed hash", () => {
    const proof = example();
    proof.after.bricks.find((b) => b.id === "hull-a")!.color = 4;
    expect(() => validateProof(proof)).toThrow("hash mismatch");
    proof.afterHash = modelHash(proof.after);
    expect(() => validateProof(proof)).toThrow("outside its declared");
  });
  it("rejects a moved anchor and a non-improving revision", () => {
    const proof = example();
    expect(() => validateProof({ ...proof, movedIds: ["hull-a"] })).toThrow(
      "anchor",
    );
    expect(() => validateProof({ ...proof, toRevision: 8 })).toThrow(
      "revision",
    );
    expect(() => validateProof({ ...proof, connectedAfter: 10 })).toThrow(
      "improving",
    );
  });
});
