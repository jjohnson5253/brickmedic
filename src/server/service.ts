import { BrickModel, modelSchema, SessionState } from "../shared/model";
import { DEMOS } from "./demos";
import { movedModel, validateGeometry } from "./geometry";
import { RepairPlanner } from "./planner";
import { GraphStore, type Snapshot } from "./store";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Single-process session serialization. Different visitors can operate independently. */
export class SessionGate {
  private readonly tails = new Map<string, Promise<void>>();
  async run<T>(session: string, work: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(session) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.tails.set(session, next);
    await previous;
    try {
      return await work();
    } finally {
      release();
      if (this.tails.get(session) === next) this.tails.delete(session);
    }
  }
}

export class BrickMedicService {
  readonly gate = new SessionGate();
  constructor(
    readonly store: GraphStore,
    private readonly planner: RepairPlanner,
  ) {}

  private async ensure(session: string): Promise<Snapshot> {
    const snapshot = await this.store.read(session);
    if (snapshot) return snapshot;
    const model = modelSchema.parse(DEMOS["space-cadet"]);
    validateGeometry(model);
    const first = {
      model,
      revision: 1,
      rootIds: model.bricks.filter((b) => b.y === 0).map((b) => b.id),
    };
    await this.store.write(session, first);
    await this.store.event(session, "loaded", `Loaded ${model.name}.`);
    return first;
  }

  private async state(
    session: string,
    snapshot: Snapshot,
  ): Promise<SessionState> {
    return {
      ...snapshot,
      analysis: await this.store.analyze(session, snapshot),
      history: await this.store.history(session),
      plan: await this.store.readPlan(session),
    };
  }

  get(session: string) {
    return this.gate.run(session, async () =>
      this.state(session, await this.ensure(session)),
    );
  }

  load(session: string, input: BrickModel) {
    return this.gate.run(session, async () => {
      const model = modelSchema.parse(input);
      validateGeometry(model);
      const current = await this.store.read(session);
      const snapshot = {
        model,
        revision: (current?.revision ?? 0) + 1,
        rootIds: model.bricks.filter((b) => b.y === 0).map((b) => b.id),
      };
      await this.store.write(session, snapshot);
      await this.store.clearMemory(session);
      await this.store.event(session, "loaded", `Loaded ${model.name}.`);
      return this.state(session, snapshot);
    });
  }

  plan(session: string) {
    return this.gate.run(session, async () => {
      const snapshot = await this.ensure(session);
      const analysis = await this.store.analyze(session, snapshot);
      await this.planner.plan(session, snapshot, analysis);
      return this.state(session, snapshot);
    });
  }

  apply(session: string, id: string, revision: number) {
    return this.gate.run(session, async () => {
      const snapshot = await this.ensure(session);
      const plan = await this.store.readPlan(session);
      const candidate = plan?.candidates.find((c) => c.id === id);
      if (
        !candidate ||
        candidate.revision !== revision ||
        revision !== snapshot.revision
      ) {
        throw new AppError(
          409,
          "This repair is out of date. Run the inspection again.",
        );
      }
      const model = modelSchema.parse(
        movedModel(snapshot.model, candidate.movedIds, candidate.offset),
      );
      validateGeometry(model);
      const next = { ...snapshot, model, revision: snapshot.revision + 1 };
      const before = await this.store.analyze(
        session,
        snapshot,
        undefined,
        false,
      );
      const trial = await this.store.simulate(
        session,
        next,
        candidate.movedIds[0],
      );
      if (
        trial.analysis.anchoredIds.length <= before.anchoredIds.length ||
        !before.anchoredIds.every((brickId) =>
          trial.analysis.anchoredIds.includes(brickId),
        )
      ) {
        throw new AppError(
          409,
          "Repair did not improve connectivity while preserving the existing connections.",
        );
      }
      await this.store.write(session, next);
      await this.store.event(
        session,
        "applied",
        `${candidate.title}. ${candidate.newlyConnected} bricks reconnected; verified in FalkorDB.`,
      );
      return this.state(session, next);
    });
  }

  reject(session: string, id: string, revision: number) {
    return this.gate.run(session, async () => {
      const snapshot = await this.ensure(session);
      const plan = await this.store.readPlan(session);
      const candidate = plan?.candidates.find((c) => c.id === id);
      if (
        !candidate ||
        revision !== snapshot.revision ||
        candidate.revision !== revision
      )
        throw new AppError(409, "This repair is out of date.");
      await this.store.reject(session, candidate.fingerprint, revision);
      await this.store.event(
        session,
        "rejected",
        `Skipped a placement for ${candidate.movedIds.length} bricks. The planner will remember.`,
      );
      await this.planner.plan(
        session,
        snapshot,
        await this.store.analyze(session, snapshot),
      );
      return this.state(session, snapshot);
    });
  }
}
