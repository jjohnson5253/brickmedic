# BrickMedic demo narration

This narrated, captioned walkthrough uses screenshots from the working application and explanatory tool/evaluation cards. The narration uses a synthetic voice. It demonstrates deterministic graph mode, not a live language-model run.

## 1 Find the missing connection.

A brick model can look finished while a whole assembly is disconnected. BrickMedic turns the build into a FalkorDB graph and finds every piece with no path to the original base.

## 2 Inspect. Test. Explain.

The planner moves loose assemblies together. Here, one stud left and two plates down reconnects the wing through four stud contacts. Every offered candidate is checked in a separate trial graph, and the actual connection path is shown.

## 3 Apply a repair. Verify again.

Applying the repair checks geometry and reachability again. All twelve bricks now have a path to the original anchors. Revision checks reject stale or repeated applications, and the result is saved in FalkorDB.

## 4 Ask a counterfactual.

What depends on this brick? Removing the repaired wing in a disposable graph disconnects its tip. The live model stays unchanged. Alternate connection routes are respected. This measures stud connectivity, not physical strength.

## 5 An agent can use the tools.

The local MCP server lets an AI host inspect or import a model, plan repairs, simulate removal, recall memory, reject a placement, and apply an approved repair. A real protocol test reconnects a fresh client and confirms that rejection memory survives. The host brings its own model.

## 6 Take the evidence with you.

Each applied repair atomically saves a replayable proof alongside the model. Download it and run the verifier. Fresh FalkorDB graphs independently check the movement, anchors, connection counts, and every path hop. Changed geometry or invented evidence fails validation.

## 7 Reproduce the results.

The evaluation repaired all thirty-five synthetic models, replayed all one hundred fourteen proofs, and preserved every original anchor. Forty-four tests cover geometry, persistence, protocol handoff, and failure cases. The demo uses deterministic mode. The public repository includes complete setup, evidence, and the build article.
