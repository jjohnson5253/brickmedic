import "dotenv/config";
import { readFile, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { GraphStore } from "./store";
import { verifyProof } from "./verify-proof";

const filename = process.argv[2];
if (!filename)
  throw new Error("Usage: npm run verify -- path/to/repair-proof.json");
if ((await stat(filename)).size > 2_000_000)
  throw new Error("Proof file exceeds 2 MB.");
const input = JSON.parse(await readFile(filename, "utf8"));
const store = await GraphStore.connect(
  process.env.FALKORDB_URL ?? "redis://127.0.0.1:6387",
);
try {
  const proofs = Array.isArray(input) ? input : [input];
  if (!proofs.length || proofs.length > 100)
    throw new Error("Expected 1–100 repair proofs.");
  for (const proof of proofs)
    console.log(JSON.stringify(await verifyProof(store, randomUUID(), proof)));
} finally {
  await store.close();
}
