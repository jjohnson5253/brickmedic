import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Candidate } from "../src/shared/model";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
  },
}));
import { AnthropicChooser } from "../src/server/planner";

const candidate = {
  id: "verified-id",
  path: ["wing", "hull"],
  contacts: 4,
} as Candidate;
beforeEach(() => create.mockReset());

describe("Anthropic selection boundary", () => {
  it("sends verified evidence and accepts a valid candidate ID", async () => {
    create.mockResolvedValue({
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: '{"id":"verified-id","reason":"Four verified stud contacts reconnect the assembly."}',
        },
      ],
    });
    const result = await new AnthropicChooser(
      "test-only-key",
      "claude-haiku-5-5",
    ).choose([candidate], "Example");
    expect(result.id).toBe(candidate.id);
    const input = create.mock.calls[0][0];
    expect(input.thinking).toEqual({ type: "disabled" });
    expect(JSON.parse(input.messages[0].content).candidates[0].path).toEqual([
      "wing",
      "hull",
    ]);
  });
  it("rejects invented candidate IDs and non-JSON output", async () => {
    const chooser = new AnthropicChooser("test-only-key", "claude-haiku-5-5");
    create.mockResolvedValueOnce({
      stop_reason: "end_turn",
      content: [
        { type: "text", text: '{"id":"invented","reason":"No evidence."}' },
      ],
    });
    await expect(chooser.choose([candidate], "Example")).rejects.toThrow(
      "unverified",
    );
    create.mockResolvedValueOnce({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Try moving the wing." }],
    });
    await expect(chooser.choose([candidate], "Example")).rejects.toThrow();
  });
  it("surfaces truncation and provider errors", async () => {
    const chooser = new AnthropicChooser("test-only-key", "claude-haiku-5-5");
    create.mockResolvedValueOnce({ stop_reason: "max_tokens", content: [] });
    await expect(chooser.choose([candidate], "Example")).rejects.toThrow(
      "complete repair selection",
    );
    create.mockRejectedValueOnce(new Error("Provider unavailable"));
    await expect(chooser.choose([candidate], "Example")).rejects.toThrow(
      "Provider unavailable",
    );
  });
});
