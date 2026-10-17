# BrickMedic submission

**Project:** BrickMedic — a graph-powered repair agent for disconnected brick assemblies.

**Author:** Jake Johnson

**Status:** Submitted as a solo entry on October 17, 2026. The saved WeMakeDevs record was read back and confirmed with the project title, both tracks, repository branch, demo video, and blog link.

**Primary track:** Agents That Act on Connected Data

**Secondary track:** Agent Memory and Coordination. The prototype persists plans, rejected placements, and history across reconnects; it does not implement multiple collaborating agents.

## Short description

BrickMedic finds brick assemblies with no connection path to the original base, proposes collision-free translations, and verifies each candidate in a temporary FalkorDB graph. A 3D preview and explicit connection paths let the user inspect a repair before applying it. The optional AI chooser selects only from verified candidate IDs. The default deterministic graph planner is fully usable without an AI key.

## Links and artifacts

- [Public repository and implementation branch](https://github.com/jjohnson5253/brickmedic/tree/feat/brickmedic-hackathon)
- [README with setup, graph data model, and Cypher](../README.md)
- [Build post](blog-post.md)
- [Unlisted YouTube demo submitted to the hackathon](https://youtu.be/gdq4DtKQlIs)
- [Original demo video file](brickmedic-demo.mp4)
- [Model examples](../public/models)
- [Submission confirmation screenshot](submission-confirmation.jpg)
- [Manage the submitted entry on WeMakeDevs](https://www.wemakedevs.org/hackathons/falkordb/submit) (requires the author's account)

This submission uses complete local setup instructions. No public application deployment has been claimed. The implementation is in an open pull request awaiting the author's review and merge under the author's protected-branch policy.

## Demo walkthrough

The included video uses screenshots captured from the working local application, sequenced with explanatory captions. It demonstrates deterministic graph mode. Reproduce it interactively:

1. Start Docker, run `npm ci`, `npm run db:up`, and `npm run dev`.
2. Open `http://127.0.0.1:4317`. Load **Space Cadet**.
3. Observe 10 connected bricks out of 12 and one loose assembly.
4. Click **Inspect & find repairs**. The preferred candidate moves the wing one stud left and two plates down.
5. Open **Graph evidence** to see the reachability query and a proposed connection path.
6. Click **Apply verified repair**. The graph now verifies 12 connected bricks out of 12.
7. Open **Connection graph** and select a brick to highlight its path to an anchor.
8. Download the repaired `.ldr`. Load Garden House or Little Rover to try another repair.
9. To demonstrate persistent memory, inspect a model, skip a placement, reload the page, and inspect again. That placement remains excluded at the same revision.

## Verification

The local validation passed 21 unit tests and 11 tests against a real FalkorDB container. All synthetic models were fully reconnected: Space Cadet in one repair, Garden House in one repair, and Little Rover in two repairs. Tests also cover rejections, reconnecting a database client, session isolation, stale and concurrent applies, controlled AI selection and failure handling, invalid imports, exports, and temporary-graph cleanup.

The AI adapter was verified with controlled chooser implementations; a live Anthropic request was not run. API-key-free screenshots and the video are labeled deterministic mode. Desktop and phone viewport checks accompany the code checks.

## AI assistance disclosure

Codex assisted with implementation, tests, prose, screenshots, and video preparation. The participant remains responsible for reviewing and understanding the implementation. This assistance was disclosed in the submitted description and YouTube video description. All included data is synthetic. BrickMedic checks the supported stud-connection geometry; it does not simulate physical strength or arbitrary LEGO connectors.

## Submission checklist

- Public source repository: submitted with the implementation branch URL.
- README, graph data model, queries, local setup, and demo: included.
- Build post for the blog prize: included.
- Live hosted deployment: not included; local setup is the chosen submission path.
- Track selection and final event submission: completed and verified on October 17, 2026.
- Code pull request: remains open for participant review and merge.

Deadline: **October 18, 2026, 11:59 PM IST**, equivalent to **1:29 PM America/Chicago**. See the [official schedule](https://www.wemakedevs.org/hackathons/falkordb/schedule).
