import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { modelSchema } from "../shared/model";
import { DEMOS } from "./demos";
import { AppError, type BrickMedicService } from "./service";

export function createMcpServer(
  service: BrickMedicService,
  session: string,
  allowApply = false,
) {
  const server = new McpServer({ name: "brickmedic", version: "0.2.0" });
  const reply = async (work: () => Promise<unknown>) => {
    try {
      const data = await work();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data) }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text:
              error instanceof AppError
                ? error.message
                : "Graph operation failed. Check FalkorDB and validated tool arguments.",
          },
        ],
      };
    }
  };
  const readOnly = {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  };
  const write = {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: false,
  };
  const candidateInput = z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
  });
  server.registerTool(
    "inspect_model",
    {
      description:
        "Query bricks, loose assemblies, original anchors, edges and shortest base paths in this session's FalkorDB graph. This is stud connectivity, not physical strength.",
      inputSchema: z.object({}),
      annotations: readOnly,
    },
    () => reply(() => service.get(session)),
  );
  server.registerTool(
    "load_demo",
    {
      description:
        "Replace this session's model with a synthetic example and reset repair memory. Available examples: space-cadet, garden-house, little-rover.",
      inputSchema: z.object({
        demo: z.enum(["space-cadet", "garden-house", "little-rover"]),
      }),
      annotations: write,
    },
    ({ demo }) => reply(() => service.load(session, DEMOS[demo])),
  );
  server.registerTool(
    "import_model",
    {
      description:
        "Load a supported BrickMedic JSON model of at most 100 upright rectangular bricks and plates. Validates every part, grid position, original anchor and collision before replacing this session's model. Import is a model load, not a verified repair.",
      inputSchema: z.object({ model: modelSchema }),
      annotations: write,
    },
    ({ model }) => reply(() => service.load(session, model)),
  );
  server.registerTool(
    "plan_repairs",
    {
      description:
        "Recall rejections, enumerate collision-free rigid translations, verify candidates in isolated FalkorDB trial graphs and persist a revision-bound plan. Does not apply a repair. Returns candidate IDs, paths, offsets and evidence.",
      inputSchema: z.object({}),
      annotations: { ...write, destructiveHint: false },
    },
    () => reply(() => service.plan(session)),
  );
  server.registerTool(
    "simulate_removal",
    {
      description:
        "Counterfactual graph query: remove one brick in a disposable trial graph and return which OTHER previously anchored bricks lose every path to an original anchor. Never changes the live model. It measures connectivity impact only.",
      inputSchema: z.object({
        brickId: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),
        revision: z.number().int().positive(),
      }),
      annotations: readOnly,
    },
    ({ brickId, revision }) =>
      reply(() => service.removalImpact(session, brickId, revision)),
  );
  server.registerTool(
    "recall_memory",
    {
      description:
        "Read persistent repair events, rejected placements at the current revision, and independently replayable repair proofs. Reconnect using the same private BRICKMEDIC_SESSION to continue a handoff.",
      inputSchema: z.object({}),
      annotations: readOnly,
    },
    () =>
      reply(async () => {
        const state = await service.get(session);
        return {
          revision: state.revision,
          history: state.history,
          rejected: [
            ...(await service.store.rejected(session, state.revision)),
          ],
          proofs: await service.proofs(session),
        };
      }),
  );
  server.registerTool(
    "reject_repair",
    {
      description:
        "Remember a user-skipped verified candidate at its revision and replan without that placement. Does not move bricks.",
      inputSchema: candidateInput,
      annotations: { ...write, destructiveHint: false },
    },
    ({ id, revision }) => reply(() => service.reject(session, id, revision)),
  );
  server.registerTool(
    "apply_repair",
    {
      description:
        "Apply a previously verified candidate only after the user approves the action in the MCP host. Requires BRICKMEDIC_ALLOW_APPLY=true at startup. Rechecks geometry, base reachability and revision, then atomically writes model plus proof. Never accepts arbitrary coordinates or Cypher.",
      inputSchema: candidateInput,
      annotations: write,
    },
    ({ id, revision }) =>
      reply(async () => {
        if (!allowApply)
          throw new AppError(
            403,
            "Applying repairs is disabled. The owner must enable BRICKMEDIC_ALLOW_APPLY=true at startup and approve the action in the host.",
          );
        return service.apply(session, id, revision);
      }),
  );
  return server;
}
