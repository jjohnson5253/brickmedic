import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { GraphStore } from "../src/server/store";
import { RepairPlanner } from "../src/server/planner";
import { BrickMedicService } from "../src/server/service";
import { createApp } from "../src/server/app";
import { DEMOS } from "../src/server/demos";
import { modelSchema } from "../src/shared/model";
import { parseLdraw } from "../src/server/ldraw";
import { verifyProof } from "../src/server/verify-proof";
import { Client } from "@modelcontextprotocol/client";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/client/stdio";

let store: GraphStore;
const sessions: string[] = [];
const session = () => {
  const id = randomUUID();
  sessions.push(id);
  return id;
};
beforeAll(async () => {
  store = await GraphStore.connect(
    process.env.FALKORDB_URL ?? "redis://127.0.0.1:6387",
  );
});
afterAll(async () => {
  for (const id of sessions) await store.delete(id).catch(() => {});
  await store.close();
});
const service = () => new BrickMedicService(store, new RepairPlanner(store));

describe("real FalkorDB repair lifecycle", () => {
  it("atomically persists a repair proof, independently replays it, and rejects forged paths", async () => {
    const id = session(),
      app = service();
    let state = await app.plan(id);
    state = await app.apply(id, state.plan!.recommendedId!, state.revision);
    const [proof] = await app.proofs(id);
    expect(proof.toRevision).toBe(state.revision);
    expect(await verifyProof(store, id, proof)).toMatchObject({
      valid: true,
      newlyConnected: 2,
    });
    await expect(
      verifyProof(store, id, { ...proof, path: ["right-tip", "hull-a"] }),
    ).rejects.toThrow("connectivity");
    await expect(
      verifyProof(store, id, { ...proof, connectedAfter: 11 }),
    ).rejects.toThrow("connectivity");
  });
  it("finds a brick's removal impact without changing live state or remembering a fake repair", async () => {
    const id = session(),
      app = service();
    let state = await app.plan(id);
    state = await app.apply(id, state.plan!.recommendedId!, state.revision);
    const impact = await app.removalImpact(id, "right-wing", state.revision);
    expect(impact.newlyDisconnectedIds).toEqual(["right-tip"]);
    expect(await app.get(id)).toEqual(state);
    await expect(
      app.removalImpact(id, "missing", state.revision),
    ).rejects.toThrow("not found");
    await expect(
      app.removalImpact(id, "right-wing", state.revision - 1),
    ).rejects.toThrow("changed");
  });
  it("supports a real stdio MCP handoff between fresh clients with persistent rejection memory", async () => {
    const id = session();
    const connect = async () => {
      const client = new Client({
        name: "brickmedic-integration",
        version: "1",
      });
      await client.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: ["--import", "tsx", "src/server/mcp.ts"],
          cwd: process.cwd(),
          env: {
            ...getDefaultEnvironment(),
            FALKORDB_URL: process.env.FALKORDB_URL ?? "redis://127.0.0.1:6387",
            BRICKMEDIC_SESSION: id,
            BRICKMEDIC_ALLOW_APPLY: "true",
          },
          stderr: "pipe",
        }),
      );
      return client;
    };
    const call = async (client: Client, name: string, args = {}) => {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError).not.toBe(true);
      const text = result.content.find((c) => c.type === "text");
      if (text?.type !== "text") throw new Error("Missing tool result");
      return JSON.parse(text.text);
    };
    let client = await connect();
    let rejected: string;
    try {
      expect((await client.listTools()).tools).toHaveLength(8);
      await call(client, "import_model", {
        model: modelSchema.parse(DEMOS["space-cadet"]),
      });
      const state = await call(client, "plan_repairs");
      rejected = state.plan.candidates[0].fingerprint;
      await call(client, "reject_repair", {
        id: state.plan.candidates[0].id,
        revision: state.revision,
      });
    } finally {
      await client.close();
    }
    client = await connect();
    try {
      const memory = await call(client, "recall_memory");
      expect(memory.rejected).toContain(rejected!);
      const state = await call(client, "inspect_model");
      expect(
        state.plan.candidates.every(
          (c: { fingerprint: string }) => c.fingerprint !== rejected,
        ),
      ).toBe(true);
      const repaired = await call(client, "apply_repair", {
        id: state.plan.recommendedId,
        revision: state.revision,
      });
      expect(repaired.analysis.disconnectedIds).toEqual([]);
      expect((await call(client, "recall_memory")).proofs).toHaveLength(1);
    } finally {
      await client.close();
    }
  }, 20_000);
  it.each([
    ["space-cadet", 2],
    ["garden-house", 4],
    ["little-rover", 4],
  ] as const)("detects and completely repairs %s", async (demo, count) => {
    const id = session(),
      app = service();
    let state = await app.load(id, modelSchema.parse(DEMOS[demo]));
    expect(state.analysis.disconnectedIds).toHaveLength(count);
    const originalRoots = state.rootIds;
    for (let i = 0; i < 3 && state.analysis.disconnectedIds.length; i++) {
      state = await app.plan(id);
      const candidate = state.plan!.candidates.find(
        (c) => c.id === state.plan!.recommendedId,
      )!;
      expect(candidate.path.length).toBeGreaterThan(1);
      state = await app.apply(id, candidate.id, state.revision);
    }
    expect(state.analysis.disconnectedIds).toEqual([]);
    expect(state.rootIds).toEqual(originalRoots);
    expect(
      Object.values(state.analysis.paths).every((p) =>
        originalRoots.includes(p.at(-1)!),
      ),
    ).toBe(true);
    expect(state.history.some((e) => e.kind === "applied")).toBe(true);
  });

  it("persists geometry, rejections, plans, and repair history beyond a client reconnect", async () => {
    const id = session(),
      app = service();
    let state = await app.plan(id);
    const rejected = state.plan!.candidates[0].fingerprint;
    state = await app.reject(id, state.plan!.candidates[0].id, state.revision);
    expect(
      state.plan!.candidates.every((c) => c.fingerprint !== rejected),
    ).toBe(true);
    const other = await GraphStore.connect(
      process.env.FALKORDB_URL ?? "redis://127.0.0.1:6387",
    );
    try {
      const reconnected = new BrickMedicService(
        other,
        new RepairPlanner(other),
      );
      const saved = await reconnected.get(id);
      expect(saved).toEqual(state);
      const again = await reconnected.plan(id);
      expect(
        again.plan!.candidates.every((c) => c.fingerprint !== rejected),
      ).toBe(true);
      expect(again.history.some((e) => e.kind === "rejected")).toBe(true);
    } finally {
      await other.close();
    }
  });

  it("blocks stale and concurrently repeated repairs", async () => {
    const id = session(),
      app = service();
    const state = await app.plan(id),
      candidate = state.plan!.candidates[0];
    const results = await Promise.allSettled([
      app.apply(id, candidate.id, state.revision),
      app.apply(id, candidate.id, state.revision),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect((await app.get(id)).revision).toBe(state.revision + 1);
  });

  it("does not share plans or model edits across sessions", async () => {
    const a = session(),
      b = session(),
      app = service();
    const state = await app.plan(a);
    await app.load(b, modelSchema.parse(DEMOS["garden-house"]));
    await expect(app.apply(b, state.plan!.candidates[0].id, 1)).rejects.toThrow(
      "out of date",
    );
    expect((await app.get(a)).model.name).toBe("Space Cadet");
    expect((await app.get(b)).model.name).toBe("Garden House");
  });

  it("allows an AI chooser to select only a server-verified candidate and surfaces failures", async () => {
    const id = session();
    const choose = vi.fn(async (candidates) => ({
      id: candidates[1].id,
      reason: "A verified alternative.",
    }));
    const app = new BrickMedicService(
      store,
      new RepairPlanner(store, { choose }),
    );
    const state = await app.plan(id);
    expect(choose).toHaveBeenCalledOnce();
    expect(state.plan!.mode).toBe("anthropic");
    expect(state.plan!.recommendedId).toBe(state.plan!.candidates[1].id);
    const invalid = new BrickMedicService(
      store,
      new RepairPlanner(store, {
        choose: async () => ({ id: "invented", reason: "Wrong" }),
      }),
    );
    await expect(invalid.plan(session())).rejects.toThrow("unverified");
    const unavailable = new BrickMedicService(
      store,
      new RepairPlanner(store, {
        choose: async () => {
          throw new Error("Provider unavailable");
        },
      }),
    );
    await expect(unavailable.plan(session())).rejects.toThrow(
      "Provider unavailable",
    );
  });

  it("cleans up all temporary simulation graphs", async () => {
    const { FalkorDB } = await import("falkordb");
    const db = await FalkorDB.connect({
      url: process.env.FALKORDB_URL ?? "redis://127.0.0.1:6387",
    });
    try {
      expect(
        (await db.list()).filter((name) =>
          name.startsWith("brickmedic_trial_"),
        ),
      ).toEqual([]);
    } finally {
      await db.close();
    }
  });
});

describe("HTTP input and browser boundaries", () => {
  it("isolates cookie sessions, blocks cross-origin writes, and exports the current repaired model", async () => {
    const app = createApp(service()),
      agent = request.agent(app);
    const initial = await agent.get("/api/state").expect(200);
    const cookie = initial.headers["set-cookie"][0];
    sessions.push(cookie.match(/brickmedic_session=([^;]+)/)![1]);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    await agent
      .post("/api/plan")
      .set("Origin", "https://untrusted.example")
      .send({})
      .expect(403);
    const planned = await agent.post("/api/plan").send({}).expect(200);
    await agent
      .post("/api/apply")
      .send({
        id: planned.body.plan.recommendedId,
        revision: planned.body.revision,
      })
      .expect(200);
    const downloaded = await agent.get("/api/export/ldr").expect(200);
    expect(parseLdraw(downloaded.text, "Export").bricks).toHaveLength(12);
    expect(downloaded.headers["content-disposition"]).toContain("attachment");
    const reloaded = await agent.get("/api/state").expect(200);
    expect(reloaded.body.analysis.disconnectedIds).toEqual([]);
  });
  it("rejects malformed, oversized, and unsupported inputs", async () => {
    const app = createApp(service());
    await request(app)
      .post("/api/load")
      .send({ demo: "../../anything" })
      .expect(400);
    await request(app)
      .post("/api/apply")
      .send({ id: "not-an-id", revision: -1 })
      .expect(400);
    await request(app)
      .post("/api/import")
      .send({ format: "ldr", content: "0 FILE main.ldr", name: "Invalid" })
      .expect(400);
    await request(app)
      .post("/api/import")
      .send({ format: "json", content: "{", name: "Invalid" })
      .expect(400);
    await request(app)
      .post("/api/import")
      .send({ format: "ldr", content: "x".repeat(101_000), name: "Invalid" })
      .expect(400);
    await request(app).get("/api/missing").expect(404);
  });
  it("reports database failure instead of returning a fabricated analysis", async () => {
    const appService = service();
    vi.spyOn(appService, "get").mockRejectedValueOnce(
      new Error("Graph offline"),
    );
    const response = await request(createApp(appService))
      .get("/api/state")
      .expect(503);
    expect(response.body.error).toContain("unavailable");
    expect(response.body).not.toHaveProperty("analysis");
  });
});
