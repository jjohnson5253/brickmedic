import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { marked } from "marked";

const pages = process.argv.includes("--pages");
const output = new URL(pages ? "../site/" : "../public/", import.meta.url);

// The input is repository-authored prose, never visitor-supplied Markdown.
const source = await readFile(
  new URL("../docs/blog-post.md", import.meta.url),
  "utf8",
);
const content = marked.parse(
  source.replaceAll(
    "(evidence/",
    "(https://github.com/jjohnson5253/brickmedic/blob/main/docs/evidence/",
  ),
);
await mkdir(new URL("screenshots/", output), {
  recursive: true,
});
await cp(
  new URL("../docs/screenshots/", import.meta.url),
  new URL("screenshots/", output),
  { recursive: true },
);
if (pages) {
  await cp(
    new URL("../public/fonts/", import.meta.url),
    new URL("fonts/", output),
    { recursive: true },
  );
  await cp(
    new URL("../public/favicon.svg", import.meta.url),
    new URL("favicon.svg", output),
  );
  const css = await readFile(
    new URL("../public/blog.css", import.meta.url),
    "utf8",
  );
  await writeFile(
    new URL("blog.css", output),
    css.replaceAll('url("/fonts/', 'url("fonts/'),
  );
  await cp(
    new URL("../docs/evidence/", import.meta.url),
    new URL("evidence/", output),
    { recursive: true },
  );
}
const home = pages ? "https://github.com/jjohnson5253/brickmedic" : "/";
await writeFile(
  new URL(pages ? "index.html" : "blog.html", output),
  `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Building BrickMedic with FalkorDB — Jake Johnson</title><meta name="description" content="How BrickMedic finds disconnected brick assemblies, tests repair placements, and verifies connection paths with FalkorDB."><link rel="icon" href="favicon.svg"><link rel="stylesheet" href="blog.css"></head>
<body><header><a href="${home}">✚ BrickMedic</a><a href="https://github.com/jjohnson5253/brickmedic">View the project ↗</a></header><main><article>${content}</article><a class="return" href="${home}">${pages ? "Get the code and reproduce the results →" : "← Back to the connection lab"}</a></main><footer>Jake Johnson · Graph Hacks 2026 · MIT licensed project</footer></body></html>`,
);
console.log(
  `Rendered ${pages ? "site/index.html" : "public/blog.html"} from docs/blog-post.md`,
);
