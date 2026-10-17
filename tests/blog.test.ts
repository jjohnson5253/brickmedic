import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("published article artifact", () => {
  it("renders a standalone static article with portable assets and working evidence references", () => {
    execFileSync(process.execPath, ["scripts/render-blog.mjs", "--pages"]);
    const html = readFileSync("site/index.html", "utf8");
    expect(html).toContain("35 synthetic cases");
    expect(html).not.toContain('href="/blog.css"');
    expect(html).not.toContain('src="/screenshots/');
    const css = readFileSync("site/blog.css", "utf8");
    for (const [, path] of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
      if (!path.startsWith("https://"))
        expect(existsSync(`site/${path}`), path).toBe(true);
    }
    expect(css).toContain('url("fonts/manrope.ttf")');
    expect(existsSync("site/evidence/repair-proof.json")).toBe(true);
  });
});
