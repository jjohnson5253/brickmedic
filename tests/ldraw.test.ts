import { describe, expect, it } from "vitest";
import { DEMOS } from "../src/server/demos";
import { exportLdraw, parseLdraw } from "../src/server/ldraw";
import { modelSchema } from "../src/shared/model";

describe("bounded LDraw interchange", () => {
  it.each(Object.entries(DEMOS))(
    "round-trips %s positions, rotations, colors, and parts",
    (_id, input) => {
      const model = modelSchema.parse(input);
      const exported = exportLdraw(model);
      const imported = parseLdraw(exported, model.name);
      expect(
        imported.bricks.map(({ id: _id, label: _label, ...b }) => b),
      ).toEqual(model.bricks.map(({ id: _id, label: _label, ...b }) => b));
    },
  );
  it("rejects submodels and unsupported parts instead of silently omitting geometry", () => {
    expect(() => parseLdraw("0 FILE main.ldr", "Example")).toThrow(
      "MPD submodels",
    );
    expect(() =>
      parseLdraw("1 4 20 -24 20 1 0 0 0 1 0 0 0 1 unsupported.dat", "Example"),
    ).toThrow("not in the supported");
    expect(() => parseLdraw("2 4 0 0 0 1 1 1", "Example")).toThrow(
      "Only type 1",
    );
  });
  it("rejects tilted transforms, non-finite input, and off-grid placements", () => {
    expect(() =>
      parseLdraw("1 4 20 -24 20 1 0 0 0 0 1 0 -1 0 3003.dat", "Example"),
    ).toThrow("upright rotations");
    expect(() =>
      parseLdraw("1 4 NaN -24 20 1 0 0 0 1 0 0 0 1 3003.dat", "Example"),
    ).toThrow("finite");
    expect(() =>
      parseLdraw("1 4 21 -24 20 1 0 0 0 1 0 0 0 1 3003.dat", "Example"),
    ).toThrow("stud grid");
  });
});
