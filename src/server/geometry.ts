import {
  PARTS,
  type Brick,
  type BrickModel,
  type Edge,
  type Offset,
} from "../shared/model";

export function dimensions(brick: Brick) {
  const part = PARTS[brick.part];
  return {
    w: brick.rotated ? part.d : part.w,
    d: brick.rotated ? part.w : part.d,
    h: part.h,
  };
}

export function overlap(a: number, sizeA: number, b: number, sizeB: number) {
  return Math.max(0, Math.min(a + sizeA, b + sizeB) - Math.max(a, b));
}

export function collides(a: Brick, b: Brick) {
  const da = dimensions(a),
    db = dimensions(b);
  return (
    overlap(a.x, da.w, b.x, db.w) > 0 &&
    overlap(a.y, da.h, b.y, db.h) > 0 &&
    overlap(a.z, da.d, b.z, db.d) > 0
  );
}

export function contactStuds(a: Brick, b: Brick) {
  const da = dimensions(a),
    db = dimensions(b);
  if (a.y + da.h !== b.y && b.y + db.h !== a.y) return 0;
  return overlap(a.x, da.w, b.x, db.w) * overlap(a.z, da.d, b.z, db.d);
}

export function validateGeometry(model: BrickModel) {
  for (let i = 0; i < model.bricks.length; i++) {
    for (let j = i + 1; j < model.bricks.length; j++) {
      if (collides(model.bricks[i], model.bricks[j])) {
        throw new Error(
          `Bricks ${model.bricks[i].id} and ${model.bricks[j].id} overlap. Separate them before importing.`,
        );
      }
    }
  }
}

export function movedModel(
  model: BrickModel,
  ids: string[],
  offset: Offset,
): BrickModel {
  const moving = new Set(ids);
  return {
    ...model,
    bricks: model.bricks.map((brick) =>
      moving.has(brick.id)
        ? {
            ...brick,
            x: brick.x + offset.x,
            y: brick.y + offset.y,
            z: brick.z + offset.z,
          }
        : brick,
    ),
  };
}

export function geometryEdges(bricks: Brick[]): Edge[] {
  return bricks.flatMap((a, i) =>
    bricks.slice(i + 1).flatMap((b) => {
      const studs = contactStuds(a, b);
      return studs ? [{ from: a.id, to: b.id, studs }] : [];
    }),
  );
}
