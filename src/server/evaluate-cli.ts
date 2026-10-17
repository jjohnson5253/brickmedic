import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { GraphStore } from "./store";
import { evaluate } from "./evaluation";

const store = await GraphStore.connect(
  process.env.FALKORDB_URL ?? "redis://127.0.0.1:6387",
);
try {
  const { report, sampleProof } = await evaluate(store);
  await mkdir("docs/evidence", { recursive: true });
  await writeFile(
    "docs/evidence/evaluation.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  await writeFile(
    "docs/evidence/repair-proof.json",
    JSON.stringify(sampleProof, null, 2) + "\n",
  );
  console.log(
    `${report.solved}/${report.cases} cases solved; ${report.proofsReplayed} proofs independently replayed; anchors preserved: ${report.allAnchorsPreserved}.`,
  );
  if (report.solved !== report.cases || !report.allAnchorsPreserved)
    process.exitCode = 1;
} finally {
  await store.close();
}
