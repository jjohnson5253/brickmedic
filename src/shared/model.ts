import { z } from "zod";

export const PARTS = {
  "3001": { name: "Brick 2 × 4", w: 2, d: 4, h: 3 },
  "3002": { name: "Brick 2 × 3", w: 2, d: 3, h: 3 },
  "3003": { name: "Brick 2 × 2", w: 2, d: 2, h: 3 },
  "3004": { name: "Brick 1 × 2", w: 1, d: 2, h: 3 },
  "3005": { name: "Brick 1 × 1", w: 1, d: 1, h: 3 },
  "3010": { name: "Brick 1 × 4", w: 1, d: 4, h: 3 },
  "3020": { name: "Plate 2 × 4", w: 2, d: 4, h: 1 },
  "3021": { name: "Plate 2 × 3", w: 2, d: 3, h: 1 },
  "3022": { name: "Plate 2 × 2", w: 2, d: 2, h: 1 },
  "3023": { name: "Plate 1 × 2", w: 1, d: 2, h: 1 },
  "3024": { name: "Plate 1 × 1", w: 1, d: 1, h: 1 },
  "3710": { name: "Plate 1 × 4", w: 1, d: 4, h: 1 },
} as const;

export const COLORS: Record<number, string> = {
  0: "#273344",
  1: "#3d65b5",
  2: "#4b8b68",
  4: "#e54d43",
  7: "#a8b3bf",
  14: "#f7c744",
  15: "#f2eee3",
  19: "#d5c5a0",
  25: "#ef8d42",
  71: "#a8b3bf",
  72: "#566374",
  320: "#a63240",
  484: "#b45a35",
};
export const brickSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),
  part: z.enum(
    Object.keys(PARTS) as [keyof typeof PARTS, ...(keyof typeof PARTS)[]],
  ),
  color: z
    .number()
    .int()
    .refine((value) => value in COLORS, "Unsupported color"),
  x: z.number().int().min(-40).max(40),
  y: z.number().int().min(0).max(60),
  z: z.number().int().min(-40).max(40),
  rotated: z.boolean().default(false),
  label: z.string().min(1).max(60),
});
export type Brick = z.infer<typeof brickSchema>;
export const modelSchema = z
  .object({
    name: z.string().min(1).max(70),
    description: z.string().max(240).default("An imported brick model."),
    bricks: z.array(brickSchema).min(1).max(100),
  })
  .superRefine((model, ctx) => {
    if (new Set(model.bricks.map((b) => b.id)).size !== model.bricks.length) {
      ctx.addIssue({ code: "custom", message: "Brick IDs must be unique." });
    }
    if (!model.bricks.some((b) => b.y === 0)) {
      ctx.addIssue({
        code: "custom",
        message: "At least one brick must start on the base plane (y = 0).",
      });
    }
  });
export type BrickModel = z.infer<typeof modelSchema>;
export type Edge = { from: string; to: string; studs: number };
export type Offset = { x: number; y: number; z: number };
export type Candidate = {
  id: string;
  revision: number;
  movedIds: string[];
  offset: Offset;
  distance: number;
  newlyConnected: number;
  contacts: number;
  fingerprint: string;
  title: string;
  explanation: string;
  path: string[];
};
export type GraphAnalysis = {
  anchoredIds: string[];
  disconnectedIds: string[];
  groups: string[][];
  edges: Edge[];
  paths: Record<string, string[]>;
};
export type AgentMode = "graph" | "anthropic";
export type Plan = {
  candidates: Candidate[];
  recommendedId: string | null;
  mode: AgentMode;
  summary: string;
  steps: { tool: string; detail: string }[];
};
export type HistoryEntry = {
  id: string;
  kind: "loaded" | "applied" | "rejected";
  detail: string;
  time: string;
};
export type SessionState = {
  model: BrickModel;
  rootIds: string[];
  revision: number;
  analysis: GraphAnalysis;
  history: HistoryEntry[];
  plan: Plan | null;
};
export type DemoInfo = {
  id: string;
  name: string;
  description: string;
  category: string;
  bricks: number;
};
