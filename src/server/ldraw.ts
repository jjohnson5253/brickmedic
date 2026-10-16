import {
  PARTS,
  type Brick,
  type BrickModel,
  modelSchema,
} from "../shared/model";
import { dimensions } from "./geometry";

const ROTATIONS = [
  [1, 0, 0, 0, 1, 0, 0, 0, 1],
  [0, 0, -1, 0, 1, 0, 1, 0, 0],
  [-1, 0, 0, 0, 1, 0, 0, 0, -1],
  [0, 0, 1, 0, 1, 0, -1, 0, 0],
];

/** Deliberately strict subset: flat files, standard bricks/plates, upright quarter turns. */
export function parseLdraw(text: string, name: string): BrickModel {
  if (text.length > 100_000)
    throw new Error("LDraw files must be smaller than 100 KB.");
  const bricks: Brick[] = [];
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line) continue;
    const fields = line.split(/\s+/);
    const fail = (message: string): never => {
      throw new Error(`Line ${index + 1}: ${message}`);
    };
    if (fields[0] === "0") {
      if (
        fields[1]?.toUpperCase() === "FILE" ||
        fields[1]?.toUpperCase() === "NOFILE"
      )
        fail("MPD submodels are not supported. Flatten the file first.");
      continue;
    }
    if (fields[0] !== "1" || fields.length !== 15)
      fail("Only type 1 brick references are supported.");
    const part = fields[14]
      .toLowerCase()
      .replace(/\.dat$/, "") as keyof typeof PARTS;
    if (!(part in PARTS))
      fail(
        `Part ${fields[14]} is not in the supported brick and plate catalog.`,
      );
    const values = fields.slice(1, 14).map(Number);
    if (!values.every(Number.isFinite))
      fail(
        "All coordinates, colors, and matrix entries must be finite numbers.",
      );
    const [color, ldx, ldy, ldz, ...matrix] = values;
    const rotation = ROTATIONS.findIndex((r) =>
      r.every((value, i) => Math.abs(value - matrix[i]) < 1e-6),
    );
    if (rotation < 0)
      fail(
        "Only upright rotations of 0, 90, 180, or 270 degrees are supported.",
      );
    const rotated = rotation === 1 || rotation === 3;
    const definition = PARTS[part];
    const w = rotated ? definition.d : definition.w,
      d = rotated ? definition.w : definition.d;
    const x = ldx / 20 - w / 2,
      y = -ldy / 8 - definition.h,
      z = ldz / 20 - d / 2;
    if (![x, y, z].every(Number.isInteger))
      fail("Bricks must align to the stud grid and plate-height grid.");
    bricks.push({
      id: `brick-${String(bricks.length + 1).padStart(3, "0")}`,
      part,
      x,
      y,
      z,
      color,
      rotated,
      label: `${definition.name} ${bricks.length + 1}`,
    });
    if (bricks.length > 100) fail("The model limit is 100 bricks.");
  }
  if (!bricks.length) throw new Error("The file contains no supported bricks.");
  const base = Math.min(...bricks.map((b) => b.y));
  return modelSchema.parse({
    name,
    description: "Imported from an upright LDraw model.",
    bricks: bricks.map((b) => ({ ...b, y: b.y - base })),
  });
}

export function exportLdraw(model: BrickModel) {
  const safeName = model.name.replace(/[\r\n]/g, " ");
  return [
    `0 ${safeName} — BrickMedic export`,
    "0 // Coordinates use LDraw units. Connectivity checked in the supported upright brick subset.",
    ...model.bricks.map((b) => {
      const d = dimensions(b);
      const rotation = b.rotated ? ROTATIONS[1] : ROTATIONS[0];
      return `1 ${b.color} ${(b.x + d.w / 2) * 20} ${-(b.y + d.h) * 8} ${(b.z + d.d / 2) * 20} ${rotation.join(" ")} ${b.part}.dat`;
    }),
    "",
  ].join("\n");
}
