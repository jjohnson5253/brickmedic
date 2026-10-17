import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { modelSchema, type Brick, type BrickModel } from "../shared/model";
import { DEMOS } from "./demos";
import { validateGeometry } from "./geometry";
import { BrickMedicService } from "./service";
import { RepairPlanner } from "./planner";
import type { GraphStore } from "./store";
import { verifyProof } from "./verify-proof";

export function evaluationCases(seed = 20261017): BrickModel[] {
  let state = seed >>> 0;
  const pick = (max: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state >>> 8) % max;
  };
  const cases = Object.values(DEMOS).map((m) => modelSchema.parse(m));
  // Separate generated family: multiple anchored towers, varying cuts, gaps and offsets.
  // These are synthetic stress cases, not a real-world or held-out dataset.
  for (let n = 0; n < 32; n++) {
    const bricks: Brick[] = [];
    const towers = 2 + pick(4);
    for (let t = 0; t < towers; t++) {
      const x = t * 6 - 12,
        z = pick(2),
        count = 2 + pick(4);
      const cut = 1 + pick(count),
        gap = 1 + pick(5),
        sideways = pick(2);
      bricks.push({
        id: `base-${t}`,
        part: "3020",
        color: 19,
        x,
        y: 0,
        z: 0,
        rotated: false,
        label: "Original anchor",
      });
      for (let j = 1; j <= count; j++) {
        bricks.push({
          id: `tower-${t}-${j}`,
          part: "3003",
          color: [1, 2, 4, 14][pick(4)],
          x: x + (j >= cut ? sideways : 0),
          y: 1 + (j - 1) * 3 + (j >= cut ? gap : 0),
          z,
          rotated: false,
          label: `Tower ${t + 1}, level ${j}`,
        });
      }
    }
    const model = modelSchema.parse({
      name: `Generated towers ${n + 1}`,
      bricks,
    });
    validateGeometry(model);
    cases.push(model);
  }
  return cases;
}

export async function evaluate(store: GraphStore, seed = 20261017) {
  const service = new BrickMedicService(store, new RepairPlanner(store));
  const results: {
    model: string;
    bricks: number;
    initiallyDisconnected: number;
    remaining: number;
    repairs: number;
    proofsReplayed: number;
    anchorPositionsPreserved: boolean;
    milliseconds: number;
  }[] = [];
  let sampleProof: unknown;
  for (const model of evaluationCases(seed)) {
    const session = randomUUID(),
      start = performance.now();
    try {
      let current = await service.load(session, model);
      const initial = current.analysis.disconnectedIds.length;
      let repairs = 0;
      while (current.analysis.disconnectedIds.length && repairs < 8) {
        current = await service.plan(session);
        if (!current.plan?.recommendedId) break;
        current = await service.apply(
          session,
          current.plan.recommendedId,
          current.revision,
        );
        repairs++;
      }
      const proofs = await service.proofs(session);
      for (const proof of proofs) await verifyProof(store, session, proof);
      if (!sampleProof && model.name === "Space Cadet") sampleProof = proofs[0];
      const unchanged = current.rootIds.every(
        (id) =>
          JSON.stringify(model.bricks.find((b) => b.id === id)) ===
          JSON.stringify(current.model.bricks.find((b) => b.id === id)),
      );
      results.push({
        model: model.name,
        bricks: model.bricks.length,
        initiallyDisconnected: initial,
        remaining: current.analysis.disconnectedIds.length,
        repairs,
        proofsReplayed: proofs.length,
        anchorPositionsPreserved: unchanged,
        milliseconds: Math.round(performance.now() - start),
      });
    } finally {
      await store.delete(session);
    }
  }
  const solved = results.filter((r) => r.remaining === 0).length;
  return {
    report: {
      format: "brickmedic-evaluation/v1",
      generatedAt: new Date().toISOString(),
      seed,
      mode: "deterministic graph planner; no paid model calls",
      dataset:
        "3 authored demos + 32 seeded generated tower models; synthetic, not held out",
      cases: results.length,
      solved,
      failures: results.filter((r) => r.remaining > 0).map((r) => r.model),
      repairs: results.reduce((n, r) => n + r.repairs, 0),
      proofsReplayed: results.reduce((n, r) => n + r.proofsReplayed, 0),
      allAnchorsPreserved: results.every((r) => r.anchorPositionsPreserved),
      results,
    },
    sampleProof,
  };
}
