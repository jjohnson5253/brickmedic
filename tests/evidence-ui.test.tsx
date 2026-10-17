import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("../src/client/api", () => ({ track: vi.fn() }));
import { RepairEvidence } from "../src/client/RepairEvidence";

describe("repair evidence UI", () => {
  it("offers proof export only after an actual applied repair", () => {
    expect(renderToStaticMarkup(<RepairEvidence hasRepair={false} />)).toBe("");
    const html = renderToStaticMarkup(<RepairEvidence hasRepair />);
    expect(html).toContain('href="/api/proof"');
    expect(html).toContain("npm run verify");
    expect(html).toContain("before and after models");
  });
});
