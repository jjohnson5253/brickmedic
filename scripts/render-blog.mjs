import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { marked } from "marked";

// The input is repository-authored prose, never visitor-supplied Markdown.
const source = await readFile(
  new URL("../docs/blog-post.md", import.meta.url),
  "utf8",
);
const content = marked.parse(
  source.replaceAll("(screenshots/", "(/screenshots/"),
);
await mkdir(new URL("../public/screenshots/", import.meta.url), {
  recursive: true,
});
await cp(
  new URL("../docs/screenshots/", import.meta.url),
  new URL("../public/screenshots/", import.meta.url),
  { recursive: true },
);
await writeFile(
  new URL("../public/blog.html", import.meta.url),
  `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Building BrickMedic with FalkorDB — Jake Johnson</title><meta name="description" content="How BrickMedic finds disconnected brick assemblies, tests repair placements, and verifies connection paths with FalkorDB."><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/blog.css"></head>
<body><header><a href="/">✚ BrickMedic</a><a href="https://github.com/jjohnson5253/brickmedic/tree/feat/brickmedic-hackathon">View the project ↗</a></header><main><article>${content}</article><a class="return" href="/">← Back to the connection lab</a></main><footer>Jake Johnson · Graph Hacks 2026 · MIT licensed project</footer></body></html>`,
);
console.log("Rendered public/blog.html from docs/blog-post.md");
