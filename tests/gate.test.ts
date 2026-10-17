import { expect, it } from "vitest";
import { SessionGate } from "../src/server/service";

it("serializes one session, permits other sessions, and releases after errors", async () => {
  const gate = new SessionGate(),
    events: string[] = [];
  let unlock!: () => void;
  const wait = new Promise<void>((resolve) => {
    unlock = resolve;
  });
  const first = gate
    .run("same", async () => {
      events.push("first");
      await wait;
      throw new Error("test");
    })
    .catch(() => {});
  const second = gate.run("same", async () => {
    events.push("second");
  });
  await gate.run("other", async () => {
    events.push("other");
  });
  expect(events).toEqual(["first", "other"]);
  unlock();
  await Promise.all([first, second]);
  expect(events).toEqual(["first", "other", "second"]);
});
