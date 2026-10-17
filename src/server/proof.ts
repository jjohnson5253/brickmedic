import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { modelSchema, type BrickModel, type Candidate } from "../shared/model";
import { movedModel, validateGeometry } from "./geometry";
import type { Snapshot } from "./store";

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const proofSchema = z.object({
  format: z.literal("brickmedic-repair-proof/v1"),
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  before: modelSchema,
  after: modelSchema,
  beforeHash: hashSchema,
  afterHash: hashSchema,
  rootIds: z.array(z.string()).min(1).max(100),
  fromRevision: z.number().int().positive(),
  toRevision: z.number().int().positive(),
  movedIds: z.array(z.string()).min(1).max(100),
  offset: z.object({
    x: z.number().int(),
    y: z.number().int(),
    z: z.number().int(),
  }),
  connectedBefore: z.number().int().min(1).max(100),
  connectedAfter: z.number().int().min(1).max(100),
  path: z.array(z.string()).min(2).max(100),
});
export type RepairProof = z.infer<typeof proofSchema>;

/** Stable across JSON key order; hashes bind evidence to exact model contents. */
export function modelHash(model: BrickModel): string {
  const normalized = modelSchema.parse(model);
  normalized.bricks.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export function createProof(
  before: Snapshot,
  after: Snapshot,
  candidate: Candidate,
  connectedBefore: number,
  connectedAfter: number,
  path: string[],
): RepairProof {
  return proofSchema.parse({
    format: "brickmedic-repair-proof/v1",
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    before: before.model,
    after: after.model,
    beforeHash: modelHash(before.model),
    afterHash: modelHash(after.model),
    rootIds: before.rootIds,
    fromRevision: before.revision,
    toRevision: after.revision,
    movedIds: candidate.movedIds,
    offset: candidate.offset,
    connectedBefore,
    connectedAfter,
    path,
  });
}

/** Structural checks precede independent replay against fresh FalkorDB graphs. */
export function validateProof(input: unknown): RepairProof {
  const proof = proofSchema.parse(input);
  validateGeometry(proof.before);
  validateGeometry(proof.after);
  if (
    modelHash(proof.before) !== proof.beforeHash ||
    modelHash(proof.after) !== proof.afterHash
  )
    throw new Error("Proof model hash mismatch.");
  const roots = proof.before.bricks.filter((b) => b.y === 0).map((b) => b.id);
  // Anchors can have been loaded at a prior revision, but none can move or disappear.
  if (
    new Set(proof.rootIds).size !== proof.rootIds.length ||
    proof.rootIds.some((id) => !roots.includes(id)) ||
    new Set(proof.movedIds).size !== proof.movedIds.length ||
    proof.movedIds.some(
      (id) =>
        proof.rootIds.includes(id) ||
        !proof.before.bricks.some((b) => b.id === id),
    )
  )
    throw new Error("Proof anchor or moved-brick IDs are invalid.");
  if (
    proof.toRevision !== proof.fromRevision + 1 ||
    proof.connectedAfter <= proof.connectedBefore
  )
    throw new Error("Proof must describe one improving revision.");
  const expected = movedModel(proof.before, proof.movedIds, proof.offset);
  if (modelHash(expected) !== proof.afterHash)
    throw new Error(
      "Proof changed bricks outside its declared rigid translation.",
    );
  return proof;
}
