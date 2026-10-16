# Building BrickMedic with FalkorDB

_By Jake Johnson · October 16, 2026 · Built for Graph Hacks_

A small brick spaceship can look finished while its wing is floating a fraction of a brick above the hull. The interesting question is whether every piece has a chain of actual connections back to the base.

I built **BrickMedic** to make that question visible. It inspects a model, finds disconnected assemblies, proposes a translation, and verifies the repaired model in FalkorDB. You can orbit the build, preview the proposed placement, and follow the connection path behind the recommendation.

![BrickMedic showing a verified placement for a detached spaceship wing](screenshots/repair-preview.jpg)

## Turning a brick model into a graph

My work on [BrickBuilder](https://github.com/jjohnson5253/brickbuilderai) made this a natural problem to explore. BrickMedic is a separate hackathon project, with a new FalkorDB implementation and a deliberately small geometry vocabulary: upright rectangular bricks and plates.

Each brick becomes a `Brick` node. A pair of bricks earns a connection when one brick's top meets the other's underside and their footprints overlap on the stud grid. Side contact alone does not count. Intersecting bricks fail validation.

The bricks on the base plane when the model is loaded become fixed anchors. Moving a loose piece onto the floor later does not turn it into a new anchor. That matters: the goal is to reconnect the assembly to the original build.

The central query asks which bricks can be reached from those anchors:

```cypher
MATCH (root:Brick {root: true})-[:CONNECTED*0..100]->(b:Brick)
RETURN DISTINCT b.id AS id
ORDER BY id
```

FalkorDB's directed shortest-path traversal led to one practical design choice: each physical stud connection is stored as two directed `CONNECTED` relationships. That lets a path travel up or down through an assembly. The interface counts each physical connection once.

Bricks absent from the reachable set are disconnected. A second traversal groups them into assemblies so a wing and its tip move together.

## Inspecting and testing a repair

The planner follows five steps:

1. Query the connection graph and identify loose assemblies.
2. Retrieve rejected placements remembered for the current revision.
3. Generate nearby translations that align stud faces, remain inside the model bounds, and introduce no collisions.
4. Build each shortlisted proposal in a temporary FalkorDB graph and query its connection paths.
5. Offer up to three verified repairs, ordered by assembly size, movement, and stud contacts.

The search is bounded: a translation can move up to eight studs on either horizontal axis and nine plate units vertically. It tests up to twelve shortlisted placements and stops after finding three valid options. A model may need a change outside that window; the interface says so when the search finds no repair.

For the spaceship demo, the preferred move shifts the two-brick wing assembly **one stud left and two plate units down**. That creates four stud contacts with the anchored build. A trial graph verifies a path from the wing tip, through the wing, to a base brick.

The green ghost in the viewer shows that proposed placement before it changes the model. Applying it triggers another server-side validation, updates the graph, and records the result. The spaceship goes from ten connected bricks out of twelve to twelve out of twelve.

## Giving AI a constrained decision

BrickMedic has two explicit modes. The default deterministic planner ranks the verified candidates without an API key. When an Anthropic key is configured on the server, an AI chooser selects a candidate and explains the choice.

The AI receives candidate IDs and verified evidence. It cannot submit arbitrary coordinates, execute Cypher, or bypass the geometry checks. The server rejects an ID outside the verified candidate list. A provider failure produces an error instead of silently presenting a deterministic result as an AI decision.

The adapter and failure boundaries were tested with controlled chooser implementations. A live Anthropic request was not run for this build. The screenshots show the deterministic graph planner.

## Remembering rejected placements

A valid connection can still be an undesirable design choice. The user can skip it, and BrickMedic stores the placement fingerprint in FalkorDB. Another inspection at that revision excludes the same placement, even after reconnecting to the app.

Plans and repair events also live in the graph. Each browser receives its own randomly named graph, keeping one visitor's model and proposals separate from another's. Model revisions prevent an old or repeated apply request from changing a newer build. Reloading a demo or importing a new model resets that model's repair memory.

## What the demo verified

The integration tests ran against a real local FalkorDB container. The three synthetic models exercise different disconnected assemblies:

| Model        | Bricks | Initially disconnected | Repairs applied | Connected afterward |
| ------------ | -----: | ---------------------: | --------------: | ------------------: |
| Space Cadet  |     12 |                      2 |               1 |                  12 |
| Garden House |      9 |                      4 |               1 |                   9 |
| Little Rover |      8 |                      4 |               2 |                   8 |

The tests also cover remembered rejections, reconnecting a database client, session isolation, concurrent repeated repairs, invalid inputs, temporary-graph cleanup, and LDraw export. Geometry tests check the difference between a stud connection, a touching side, and an intersection.

![BrickMedic after applying a repair and verifying that every brick connects to the base](screenshots/repaired-build.jpg)

## What I learned

The anchor definition is as important as the traversal. Treating every brick that reaches the floor as grounded would let the planner solve the wrong problem. Preserving the original anchor IDs makes a repair mean something specific.

The graph is also a useful boundary between a proposed action and an accepted result. A candidate has to survive a trial graph before it appears in the interface. The model is queried again after applying it. That makes the explanation inspectable: the user can see the exact sequence of bricks that reconnects the assembly.

Keeping the part catalog small made the geometry rules testable. BrickMedic verifies stud connectivity within that catalog. It does not simulate clutch strength, gravity, center of mass, building order, or the full LEGO parts system. Broader connector geometry would be the next substantial step.

## Run BrickMedic

The project is public and MIT licensed. It includes three synthetic demos, a 3D viewer, a connection graph, strict LDraw and JSON import, repaired-model export, and local setup instructions.

Start with the [BrickMedic repository](https://github.com/jjohnson5253/brickmedic/tree/feat/brickmedic-hackathon). FalkorDB is required for inspection, proposal verification, model state, and repair memory; the app does not substitute an in-memory graph when the database is unavailable.

_AI assistance disclosure: Codex assisted with the implementation, tests, documentation, and this article. The submitted code and graph behavior require participant review and understanding, as specified in the [Graph Hacks rules](https://www.wemakedevs.org/hackathons/falkordb/rules)._
