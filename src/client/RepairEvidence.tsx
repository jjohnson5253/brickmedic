import { ArrowDownToLine, ShieldCheck } from "lucide-react";
import { track } from "./api";

export function RepairEvidence({ hasRepair }: { hasRepair: boolean }) {
  if (!hasRepair) return null;
  return (
    <div className="repair-proof-card">
      <span className="proof-icon">
        <ShieldCheck size={22} />
      </span>
      <div>
        <strong>A repair you can reproduce.</strong>
        <p>
          Download the before and after models, hashes, fixed anchors and
          verified path. Replay the proof against FalkorDB.
        </p>
        <code>npm run verify -- brickmedic-repair-proof.json</code>
      </div>
      <a
        className="download-button"
        href="/api/proof"
        onClick={() => track("repair_proof_downloaded")}
      >
        <ArrowDownToLine size={15} /> Download proof
      </a>
    </div>
  );
}
