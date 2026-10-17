import "dotenv/config";
import { randomUUID } from "node:crypto";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { GraphStore } from "./store";
import { RepairPlanner } from "./planner";
import { BrickMedicService } from "./service";
import { createMcpServer } from "./mcp-tools";
import { z } from "zod";

const session = z
  .string()
  .uuid()
  .parse(process.env.BRICKMEDIC_SESSION ?? randomUUID());
const store = await GraphStore.connect(
  process.env.FALKORDB_URL ?? "redis://127.0.0.1:6387",
);
const service = new BrickMedicService(store, new RepairPlanner(store));
const handle = serveStdio(() =>
  createMcpServer(
    service,
    session,
    process.env.BRICKMEDIC_ALLOW_APPLY === "true",
  ),
);
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await handle.close();
  await store.close();
};
process.stdin.once("end", () => {
  void stop();
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    void stop();
  });
console.error(
  "BrickMedic MCP ready. Tool state and evidence are stored in FalkorDB.",
);
