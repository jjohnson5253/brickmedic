/** All executable Cypher is fixed application code. User input is bound as parameters. */
export const QUERIES = {
  snapshot:
    "MATCH (m:Model) RETURN m.snapshot AS snapshot, m.roots AS roots, m.revision AS revision",
  write: `
    MERGE (m:Model {id: 'model'})
    SET m.snapshot = $snapshot, m.roots = $roots, m.revision = $revision, m.plan = ''
    WITH m OPTIONAL MATCH (old:Brick) DETACH DELETE old
    WITH DISTINCT m
    FOREACH (b IN $bricks |
      CREATE (:Brick {id: b.id, label: b.label, part: b.part, color: b.color,
        x: b.x, y: b.y, z: b.z, w: b.w, d: b.d, h: b.h, root: b.root}))
    FOREACH (p IN $proofs |
      CREATE (:Repair {id: p.id, revision: p.revision, beforeHash: p.beforeHash,
        afterHash: p.afterHash, proof: p.proof})-[:FOR]->(m))
    WITH m MATCH (a:Brick), (b:Brick)
    WHERE a.y + a.h = b.y
      AND a.x < b.x + b.w AND a.x + a.w > b.x
      AND a.z < b.z + b.d AND a.z + a.d > b.z
    CREATE (a)-[contact:CONNECTED {studs:
      (CASE WHEN a.x + a.w < b.x + b.w THEN a.x + a.w ELSE b.x + b.w END -
       CASE WHEN a.x > b.x THEN a.x ELSE b.x END) *
      (CASE WHEN a.z + a.d < b.z + b.d THEN a.z + a.d ELSE b.z + b.d END -
       CASE WHEN a.z > b.z THEN a.z ELSE b.z END)}]->(b)
    CREATE (b)-[:CONNECTED {studs: contact.studs}]->(a)`,
  anchored: `MATCH (root:Brick {root: true})-[:CONNECTED*0..100]->(b:Brick)
    RETURN DISTINCT b.id AS id ORDER BY id`,
  component: `MATCH (start:Brick {id: $id})-[:CONNECTED*0..100]->(b:Brick)
    RETURN DISTINCT b.id AS id ORDER BY id`,
  edges: `MATCH (a:Brick)-[c:CONNECTED]->(b:Brick)
    WHERE a.id < b.id
    RETURN a.id AS from, b.id AS to, c.studs AS studs ORDER BY from, to`,
  path: `MATCH (b:Brick {id: $id}), (root:Brick {root: true})
    WITH shortestPath((b)-[:CONNECTED*0..100]->(root)) AS path WHERE path IS NOT NULL
    WITH path ORDER BY length(path) LIMIT 1 RETURN [n IN nodes(path) | n.id] AS path`,
  history: `MATCH (e:Event)-[:FOR]->(:Model)
    RETURN e.id AS id, e.kind AS kind, e.detail AS detail, e.time AS time ORDER BY time DESC LIMIT 30`,
  event: `MATCH (m:Model) CREATE (:Event {id: $id, kind: $kind, detail: $detail, time: $time})-[:FOR]->(m)`,
  plan: "MATCH (m:Model) SET m.plan = $plan",
  readPlan: "MATCH (m:Model) RETURN m.plan AS plan",
  reject: `MATCH (m:Model) CREATE (:Rejection {fingerprint: $fingerprint, revision: $revision})-[:FOR]->(m)`,
  rejections: `MATCH (r:Rejection)-[:FOR]->(:Model) WHERE r.revision = $revision RETURN r.fingerprint AS fingerprint`,
  clearMemory: "MATCH (n) WHERE NOT n:Brick AND NOT n:Model DETACH DELETE n",
  proofs: `MATCH (r:Repair)-[:FOR]->(:Model)
    RETURN r.proof AS proof ORDER BY r.revision DESC LIMIT 100`,
  removeBrick: "MATCH (b:Brick {id: $id}) DETACH DELETE b",
} as const;
