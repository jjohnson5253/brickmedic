import { validateProof } from "./proof";
import type { GraphStore } from "./store";

export async function verifyProof(
  store: GraphStore,
  session: string,
  input: unknown,
) {
  const proof = validateProof(input);
  const before = await store.simulate(
    session,
    {
      model: proof.before,
      rootIds: proof.rootIds,
      revision: proof.fromRevision,
    },
    proof.movedIds[0],
  );
  const after = await store.simulate(
    session,
    {
      model: proof.after,
      rootIds: proof.rootIds,
      revision: proof.toRevision,
    },
    proof.movedIds[0],
  );
  const pathIsValid = proof.path.every(
    (id, i) =>
      i === 0 ||
      after.analysis.edges.some(
        (e) =>
          (e.from === proof.path[i - 1] && e.to === id) ||
          (e.to === proof.path[i - 1] && e.from === id),
      ),
  );
  if (
    before.analysis.anchoredIds.length !== proof.connectedBefore ||
    after.analysis.anchoredIds.length !== proof.connectedAfter ||
    !before.analysis.anchoredIds.every((id) =>
      after.analysis.anchoredIds.includes(id),
    ) ||
    !proof.movedIds.every(
      (id) =>
        before.analysis.disconnectedIds.includes(id) &&
        after.analysis.anchoredIds.includes(id),
    ) ||
    !proof.movedIds.includes(proof.path[0]) ||
    !proof.rootIds.includes(proof.path.at(-1)!) ||
    !pathIsValid
  )
    throw new Error(
      "Proof evidence does not match independently queried connectivity.",
    );
  return {
    valid: true,
    proofId: proof.id,
    beforeHash: proof.beforeHash,
    afterHash: proof.afterHash,
    newlyConnected: proof.connectedAfter - proof.connectedBefore,
    verifiedBy: "fresh FalkorDB trial graphs",
  };
}
