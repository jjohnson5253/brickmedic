import { describe, expect, it } from "vitest";
import { modelSchema, type Brick } from "../src/shared/model";
import {
  collides,
  contactStuds,
  dimensions,
  movedModel,
  validateGeometry,
} from "../src/server/geometry";
import { DEMOS } from "../src/server/demos";

const brick = (extra: Partial<Brick> = {}): Brick => ({
  id: "a",
  part: "3003",
  x: 0,
  y: 0,
  z: 0,
  color: 4,
  rotated: false,
  label: "Test brick",
  ...extra,
});

describe("upright stud geometry", () => {
  it("counts aligned studs only at matching top and bottom planes", () => {
    expect(contactStuds(brick(), brick({ id: "b", y: 3 }))).toBe(4);
    expect(contactStuds(brick(), brick({ id: "b", x: 1, y: 3 }))).toBe(2);
    expect(contactStuds(brick(), brick({ id: "b", y: 4 }))).toBe(0);
  });
  it("does not mistake a side or corner touch for a stud connection", () => {
    expect(contactStuds(brick(), brick({ id: "b", x: 2 }))).toBe(0);
    expect(contactStuds(brick(), brick({ id: "b", x: 2, y: 3 }))).toBe(0);
  });
  it("detects intersections while allowing touching faces", () => {
    expect(collides(brick(), brick({ id: "b", x: 1 }))).toBe(true);
    expect(collides(brick(), brick({ id: "b", x: 2 }))).toBe(false);
    expect(collides(brick(), brick({ id: "b", y: 3 }))).toBe(false);
  });
  it("rotates footprints and handles plate heights separately", () => {
    expect(dimensions(brick({ part: "3020", rotated: true }))).toEqual({
      w: 4,
      d: 2,
      h: 1,
    });
  });
  it("moves an assembly as one rigid translation without changing the source", () => {
    const source = modelSchema.parse(DEMOS["space-cadet"]);
    const moved = movedModel(source, ["right-wing", "right-tip"], {
      x: -1,
      y: -2,
      z: 0,
    });
    expect(moved.bricks.find((b) => b.id === "right-wing")?.y).toBe(3);
    expect(moved.bricks.find((b) => b.id === "right-tip")?.y).toBe(4);
    expect(source.bricks.find((b) => b.id === "right-wing")?.y).toBe(5);
    expect(moved.bricks.find((b) => b.id === "cockpit")).toEqual(
      source.bricks.find((b) => b.id === "cockpit"),
    );
  });
  it.each(Object.entries(DEMOS))(
    "%s is valid input without overlapping bricks",
    (_id, demo) => {
      expect(() => validateGeometry(modelSchema.parse(demo))).not.toThrow();
    },
  );
  it("rejects duplicate IDs and models with no base", () => {
    expect(() =>
      modelSchema.parse({ name: "Duplicate", bricks: [brick(), brick()] }),
    ).toThrow();
    expect(() =>
      modelSchema.parse({ name: "Floating", bricks: [brick({ y: 1 })] }),
    ).toThrow();
  });
});
