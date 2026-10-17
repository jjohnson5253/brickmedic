import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { createMcpServer } from "../src/server/mcp-tools";
import { AppError, type BrickMedicService } from "../src/server/service";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
});
async function connect(allowApply = false) {
  const service = {
    get: vi.fn().mockResolvedValue({ revision: 3 }),
    apply: vi.fn().mockResolvedValue({ revision: 4 }),
    removalImpact: vi.fn().mockResolvedValue({ newlyDisconnectedIds: ["tip"] }),
  };
  const server = createMcpServer(
    service as unknown as BrickMedicService,
    "private-session",
    allowApply,
  );
  const client = new Client({ name: "unit-test", version: "1" });
  type Transport = Parameters<Client["connect"]>[0];
  const a: Transport = {
    start: async () => {},
    close: async () => {},
    send: async (m) => {
      queueMicrotask(() => b.onmessage?.(m));
    },
  };
  const b: Transport = {
    start: async () => {},
    close: async () => {},
    send: async (m) => {
      queueMicrotask(() => a.onmessage?.(m));
    },
  };
  await server.connect(b);
  await client.connect(a);
  cleanup.push(async () => {
    await client.close();
    await server.close();
  });
  return { client, service };
}
describe("MCP tool boundaries", () => {
  it("publishes eight typed tools with one server-owned tenant scope", async () => {
    const { client, service } = await connect();
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(8);
    expect(
      tools.find((t) => t.name === "inspect_model")?.annotations?.readOnlyHint,
    ).toBe(true);
    expect(
      tools.find((t) => t.name === "apply_repair")?.annotations
        ?.destructiveHint,
    ).toBe(true);
    for (const tool of tools)
      expect(tool.inputSchema.properties).not.toHaveProperty("session");
    await client.callTool({ name: "inspect_model", arguments: {} });
    expect(service.get).toHaveBeenCalledWith("private-session");
  });
  it("disables applying by default and validates candidate arguments", async () => {
    const { client, service } = await connect();
    const result = await client.callTool({
      name: "apply_repair",
      arguments: { id: "819f7b68-1fbc-4774-aed2-8ba9a657135b", revision: 3 },
    });
    expect(result.isError).toBe(true);
    expect(service.apply).not.toHaveBeenCalled();
    const invalid = await client.callTool({
      name: "apply_repair",
      arguments: { id: "invented", revision: -1 },
    });
    expect(invalid.isError).toBe(true);
  });
  it("passes explicit opt-in through the service's revision checks and sanitizes backend errors", async () => {
    const { client, service } = await connect(true);
    const args = { id: "819f7b68-1fbc-4774-aed2-8ba9a657135b", revision: 3 };
    await client.callTool({ name: "apply_repair", arguments: args });
    expect(service.apply).toHaveBeenCalledWith("private-session", args.id, 3);
    service.get.mockRejectedValueOnce(new Error("secret connection details"));
    const failed = await client.callTool({
      name: "inspect_model",
      arguments: {},
    });
    expect(failed.isError).toBe(true);
    expect(JSON.stringify(failed)).not.toContain("secret");
    service.removalImpact.mockRejectedValueOnce(
      new AppError(409, "The model changed."),
    );
    const stale = await client.callTool({
      name: "simulate_removal",
      arguments: { brickId: "wing", revision: 1 },
    });
    expect(JSON.stringify(stale)).toContain("model changed");
  });
});
