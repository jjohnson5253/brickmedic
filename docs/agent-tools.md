# BrickMedic agent tools

The local MCP server exposes the same graph-backed service used by the web app. It uses the [official MCP TypeScript SDK v2](https://ts.sdk.modelcontextprotocol.io/v2/) over stdio, with eight validated tools. The host supplies the language model; the server supplies bounded operations and actual graph evidence.

## Start

Run `npm ci` and `npm run db:up` from the repository first. Then:

```bash
npm run mcp
```

For an MCP host, use a command configuration like this, substituting your real absolute repository path:

```json
{
  "mcpServers": {
    "brickmedic": {
      "command": "node",
      "args": [
        "--import",
        "/absolute/path/brickmedic/node_modules/tsx/dist/loader.mjs",
        "/absolute/path/brickmedic/src/server/mcp.ts"
      ],
      "env": {
        "FALKORDB_URL": "redis://127.0.0.1:6387",
        "BRICKMEDIC_SESSION": "REPLACE_WITH_YOUR_PRIVATE_UUID",
        "BRICKMEDIC_ALLOW_APPLY": "false"
      }
    }
  }
}
```

Generate a private session UUID with `node -e 'console.log(crypto.randomUUID())'`. Reusing that UUID lets a fresh host connection continue the same model, plan and memory. Keep it private: possession grants access to that local graph. Omit it for a new random session on each process start. No remote HTTP endpoint, public authentication service or API key is required. Logs go to stderr; stdout carries MCP messages only.

For source checkout development, a host that supports `cwd` can instead launch `node --import tsx src/server/mcp.ts` from the repository directory. Use Node 24 LTS.

## Tools

| Tool               | Input                      | Behavior                                                                                                                              |
| ------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `inspect_model`    | `{}`                       | Current model, anchors, revision, edges, loose groups, base paths and plan from FalkorDB                                              |
| `load_demo`        | `demo`                     | Loads `space-cadet`, `garden-house` or `little-rover`; replaces this session's model and clears its repair memory                     |
| `import_model`     | `model`                    | Validates and loads up to 100 supported bricks from a JSON model, including collision checks; replaces current state                  |
| `plan_repairs`     | `{}`                       | Recalls rejection memory, searches bounded translations, verifies candidates in trial graphs, persists a plan; does not move bricks   |
| `simulate_removal` | `brickId`, `revision`      | Returns other anchored bricks that lose base reachability when this brick is deleted in a temporary graph; does not change live state |
| `recall_memory`    | `{}`                       | Current revision, events, excluded placement fingerprints and complete repair proofs                                                  |
| `reject_repair`    | candidate `id`, `revision` | Persists the rejected placement and replans at the same revision                                                                      |
| `apply_repair`     | candidate `id`, `revision` | Requires startup opt-in, reruns validation and atomically stores the repaired model plus its proof                                    |

Repair tools do not accept arbitrary coordinates or Cypher, and no tool accepts a session ID. The separate import tool validates a complete new model before loading it; importing does not count as a verified repair. Read-only and mutation annotations are supplied to the host. `apply_repair` fails by default. To use it, the owner must set `BRICKMEDIC_ALLOW_APPLY=true`, and the host should ask the user to approve the chosen action. The startup flag permits the operation; it is not a server-enforced record of human approval. Revisions and per-session serialization reject stale or concurrent applies. This is a local, single-process prototype. Use one writing process at a time per shared session; the process-local lock does not coordinate concurrent writes from separate MCP server processes.

Model names and labels are untrusted data, not instructions to the agent. Only use synthetic, public or otherwise permitted data under the hackathon rules. The MCP server has no arbitrary filesystem or shell tool and no tool for free-form graph queries.

## A repair and handoff walkthrough

1. Ask the host to inspect Space Cadet. Expect 12 bricks, 10 anchored, and one two-brick loose assembly.
2. Request `plan_repairs`. It returns up to three candidates with rigid translations, contact counts and paths to the original base.
3. Reject one verified option. Its fingerprint is remembered at that model revision.
4. Close and reopen the MCP client using the same private session UUID. `recall_memory` returns the rejection; the current plan excludes it.
5. Review another candidate. If application is enabled and you approve it in the host, call `apply_repair` with its exact ID and revision.
6. Inspect again and retrieve the proof. Every brick should now have a base path. For the default best-ranked repair, the wing moves one stud left and two plate units down.
7. On the repaired model, call `simulate_removal` for `right-wing` at the current revision. It reports `right-tip` as newly disconnected; the live model remains unchanged.

The integration suite performs the reconnecting-client workflow over real stdio MCP with a real FalkorDB container. It is a scripted protocol test, not a live LLM benchmark. The optional Anthropic web chooser is separately tested with controlled responses; no live Anthropic call is claimed.

## Verify the evidence

```bash
npm run test:integration
npm run evaluate
npm run verify -- docs/evidence/repair-proof.json
```

The committed evaluation covers 35 synthetic models. All 114 applied repairs produced proofs that passed independent replay against fresh FalkorDB graphs. See the full [JSON report](evidence/evaluation.json). The generated tower cases vary cuts, gaps, lateral offsets, colors and tower counts; they do not establish real-world reliability or physical stability.
