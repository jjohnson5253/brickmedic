import { randomUUID } from "node:crypto";
import { FalkorDB } from "falkordb";
import type Graph from "falkordb/dist/src/graph";
import type {
  BrickModel,
  Edge,
  GraphAnalysis,
  HistoryEntry,
  Plan,
} from "../shared/model";
import { dimensions } from "./geometry";
import { QUERIES } from "./queries";

export type Snapshot = {
  model: BrickModel;
  rootIds: string[];
  revision: number;
};

export class GraphStore {
  constructor(
    private readonly db: FalkorDB,
    private readonly ready: () => boolean,
  ) {}

  static async connect(url: string) {
    const db = await FalkorDB.connect({
      url,
      socket: { connectTimeout: 4000 },
    });
    const connection = await db.connection;
    db.on("error", () => {
      console.error("FalkorDB connection interrupted.");
    });
    return new GraphStore(db, () => connection.isReady);
  }

  graph(session: string): Graph {
    if (!this.ready()) throw new Error("FalkorDB connection is unavailable.");
    if (!/^[a-f0-9-]{36}$/.test(session)) throw new Error("Invalid session");
    return this.db.selectGraph(`brickmedic_${session.replaceAll("-", "")}`);
  }

  async read(session: string): Promise<Snapshot | null> {
    try {
      const result = await this.graph(session).roQuery<{
        snapshot: string;
        roots: string[];
        revision: number;
      }>(QUERIES.snapshot);
      const row = result.data?.[0];
      return row
        ? {
            model: JSON.parse(row.snapshot),
            rootIds: row.roots,
            revision: row.revision,
          }
        : null;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "ERR Invalid graph operation on empty key"
      )
        return null;
      throw error;
    }
  }

  async write(
    session: string,
    snapshot: Snapshot,
    graph = this.graph(session),
  ) {
    const bricks = snapshot.model.bricks.map((b) => ({
      ...b,
      ...dimensions(b),
      root: snapshot.rootIds.includes(b.id),
    }));
    await graph.query(QUERIES.write, {
      params: {
        snapshot: JSON.stringify(snapshot.model),
        roots: snapshot.rootIds,
        revision: snapshot.revision,
        bricks,
      },
      TIMEOUT: 5000,
    });
  }

  async analyze(
    session: string,
    snapshot: Snapshot,
    graph = this.graph(session),
    includePaths = true,
  ): Promise<GraphAnalysis> {
    const connected = await graph.roQuery<{ id: string }>(QUERIES.anchored, {
      TIMEOUT: 5000,
    });
    const anchoredIds = (connected.data ?? []).map((row) => row.id);
    const anchored = new Set(anchoredIds);
    const disconnectedIds = snapshot.model.bricks
      .filter((b) => !anchored.has(b.id))
      .map((b) => b.id);
    const remaining = new Set(disconnectedIds),
      groups: string[][] = [];
    while (remaining.size) {
      const first = [...remaining][0];
      const component = await graph.roQuery<{ id: string }>(QUERIES.component, {
        params: { id: first },
        TIMEOUT: 5000,
      });
      const ids = (component.data ?? []).map((row) => row.id);
      if (!ids.length)
        throw new Error("Graph component lookup returned no bricks.");
      ids.forEach((id) => remaining.delete(id));
      groups.push(ids);
    }
    const edges = await graph.roQuery<Edge>(QUERIES.edges);
    const paths: Record<string, string[]> = {};
    if (includePaths) {
      for (const id of anchoredIds) {
        const path = await graph.roQuery<{ path: string[] }>(QUERIES.path, {
          params: { id },
          TIMEOUT: 5000,
        });
        paths[id] = path.data?.[0]?.path ?? [];
      }
    }
    return {
      anchoredIds,
      disconnectedIds,
      groups,
      edges: edges.data ?? [],
      paths,
    };
  }

  async simulate(session: string, snapshot: Snapshot, sampleId: string) {
    const scratch = this.db.selectGraph(
      `brickmedic_trial_${randomUUID().replaceAll("-", "")}`,
    );
    try {
      await this.write(session, snapshot, scratch);
      const analysis = await this.analyze(session, snapshot, scratch, false);
      const path = await scratch.roQuery<{ path: string[] }>(QUERIES.path, {
        params: { id: sampleId },
        TIMEOUT: 5000,
      });
      return { analysis, path: path.data?.[0]?.path ?? [] };
    } finally {
      await scratch.delete();
    }
  }

  async history(session: string): Promise<HistoryEntry[]> {
    const result = await this.graph(session).roQuery<HistoryEntry>(
      QUERIES.history,
    );
    return result.data ?? [];
  }

  async event(session: string, kind: HistoryEntry["kind"], detail: string) {
    await this.graph(session).query(QUERIES.event, {
      params: {
        id: randomUUID(),
        kind,
        detail,
        time: new Date().toISOString(),
      },
    });
  }

  async savePlan(session: string, plan: Plan) {
    await this.graph(session).query(QUERIES.plan, {
      params: { plan: JSON.stringify(plan) },
    });
  }

  async readPlan(session: string): Promise<Plan | null> {
    const result = await this.graph(session).roQuery<{ plan: string }>(
      QUERIES.readPlan,
    );
    return result.data?.[0]?.plan ? JSON.parse(result.data[0].plan) : null;
  }

  async reject(session: string, fingerprint: string, revision: number) {
    await this.graph(session).query(QUERIES.reject, {
      params: { fingerprint, revision },
    });
  }

  async rejected(session: string, revision: number) {
    const result = await this.graph(session).roQuery<{ fingerprint: string }>(
      QUERIES.rejections,
      { params: { revision } },
    );
    return new Set((result.data ?? []).map((r) => r.fingerprint));
  }

  async clearMemory(session: string) {
    await this.graph(session).query(QUERIES.clearMemory);
  }
  async ping() {
    if (!this.ready()) throw new Error("FalkorDB connection is unavailable.");
    await this.db.list();
  }
  async delete(session: string) {
    await this.graph(session).delete();
  }
  async close() {
    await this.db.close();
  }
}
