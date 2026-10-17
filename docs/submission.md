# BrickMedic submission

**Status:** Submitted as a solo entry and updated on October 17, 2026 at 1:59 PM America/Chicago. The saved WeMakeDevs record was read back with the revised description, both tracks, released repository, new demo and published blog. Source is merged into the repository's default `main` branch.

**Project:** BrickMedic — Find the missing connection

**Author:** Jake Johnson

**Tracks:** Agents That Act on Connected Data; Agent Memory and Coordination.

## Released artifacts

- [Public repository](https://github.com/jjohnson5253/brickmedic)
- [Published build article](https://jjohnson5253.github.io/brickmedic/)
- [Unlisted YouTube demo, 1:51](https://youtu.be/5bnvr_zqBGQ)
- [Original narrated demo file](brickmedic-demo.mp4) and [narration](demo-script.md)
- [MCP setup and eight tools](agent-tools.md)
- [Evaluation results](evidence/evaluation.json), [example proof](evidence/repair-proof.json), and [container durability result](evidence/durability.json)
- [Saved submission fields](evidence/submission.json) and [confirmation screenshot](submission-confirmation.jpg)
- [Manage the submitted entry](https://www.wemakedevs.org/hackathons/falkordb/submit), requiring the author's account

The complete local setup is the application submission path. The public GitHub Pages site hosts the article and evidence, rather than a live database-backed application.

## What the entry demonstrates

BrickMedic finds assemblies with no connection path to the original base, proposes bounded collision-free translations, and verifies candidates in temporary FalkorDB graphs. A responsive 3D preview and explicit base path explain the proposed action. Strict LDraw/JSON import and repaired-model export support up to 100 upright rectangular bricks and plates.

Eight typed MCP tools let an AI host load or import a model, inspect it, plan repairs, test removal impact, recall memory, reject a placement, and apply a verified candidate when enabled. The server owns the session scope and repair validation. Applying through MCP is disabled by default; the owner must opt in and the host should ask for user approval.

FalkorDB persists plans, rejected-placement fingerprints, events and repair proofs. An integration test closes one MCP client and reconnects a fresh client to continue the saved plan. This demonstrates a protocol handoff and persistent memory with scripted clients; it does not claim autonomous language-model collaboration. Shared sessions should use one writing process at a time.

Every applied repair atomically stores both model states, normalized SHA-256 hashes, original anchors, movement, revisions, counts and a verified base path. The independent verifier rebuilds both states in fresh FalkorDB graphs and checks the evidence again. A removal counterfactual deletes a selected brick only in a disposable graph, then reports other previously anchored bricks that lose all base paths.

## Reproduce the walkthrough

1. Follow the [README setup](../README.md#run-locally) and load Space Cadet. Expect 10 of 12 bricks connected.
2. Inspect the model. The best-ranked repair moves the two-brick wing one stud left and two plate units down.
3. Open Graph evidence to inspect the Cypher query and proposed base path.
4. Apply the verified repair. All 12 bricks now have paths to the original anchors.
5. In Connection graph, select the starboard wing and choose **What if I remove this brick?** Its tip loses connectivity in the trial; the live model stays unchanged.
6. Download the proof and run `npm run verify -- brickmedic-repair-proof.json`.
7. Follow the [MCP handoff walkthrough](agent-tools.md#a-repair-and-handoff-walkthrough), or run `npm run test:integration` for the scripted protocol test.

The video uses screenshots captured from the working local app, explanatory tool/evaluation cards, captions and synthetic narration. It demonstrates deterministic graph mode. External MCP hosts supply their own model. The optional Anthropic web chooser was tested with controlled responses; no live provider call is claimed.

## Validation

- **44 passing tests:** 30 unit tests and 14 real-FalkorDB integration tests.
- **35/35 synthetic models repaired:** three authored demos plus 32 seeded generated tower models, not a real-world or held-out benchmark.
- **114/114 repair proofs independently replayed**, with all original anchors preserved.
- Model, revision, active plan and rejection history survived replacing the Docker container with append-only persistence in its named volume.
- Clean dependency install, TypeScript, production build and GitHub CI passed. The dependency audit reported zero vulnerabilities.
- Desktop and 390-pixel phone layouts were checked, including counterfactual results and proof downloads. The published article's images and assets loaded successfully.

## AI assistance and scope

Codex assisted with implementation, tests, documentation, article and demo preparation. Jake selected the project and directed its scope, graph rationale, public release and submission. AI assistance is disclosed in the entry, article, README and video description.

All included models are synthetic. BrickMedic checks supported stud connectivity, not clutch strength, stress, gravity, legal assembly order, arbitrary connectors or the complete LEGO catalog. LEGO is a trademark of the LEGO Group; the project is independent.

The [official deadline](https://www.wemakedevs.org/hackathons/falkordb/schedule) is October 18, 2026 at 11:59 PM IST, equivalent to 1:29 PM America/Chicago.
