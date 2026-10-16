import { randomUUID } from "node:crypto";
import path from "node:path";
import { existsSync } from "node:fs";
import express, { type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { modelSchema } from "../shared/model";
import { DEMOS } from "./demos";
import { exportLdraw, parseLdraw } from "./ldraw";
import { QUERIES } from "./queries";
import { AppError, BrickMedicService } from "./service";

declare global {
  namespace Express {
    interface Request {
      sessionId: string;
    }
  }
}

export function createApp(
  service: BrickMedicService,
  options: {
    aiEnabled?: boolean;
    secureCookies?: boolean;
    origin?: string;
  } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'", "https://*.i.posthog.com"],
          workerSrc: ["'self'", "blob:"],
          upgradeInsecureRequests: options.secureCookies ? [] : null,
        },
      },
    }),
  );
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 180,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use("/api", (req, _res, next) => {
    if (
      req.method !== "GET" &&
      req.headers.origin &&
      ![
        options.origin ?? "http://localhost:4317",
        "http://127.0.0.1:4317",
        "http://localhost:4318",
        "http://127.0.0.1:4318",
      ].includes(req.headers.origin)
    ) {
      return next(new AppError(403, "This origin is not allowed."));
    }
    next();
  });
  app.use(express.json({ limit: "128kb" }));
  app.use(cookieParser());
  app.use("/api", (req, res, next) => {
    if (["/health", "/demos", "/queries"].includes(req.path)) {
      next();
      return;
    }
    const existing = req.cookies?.brickmedic_session;
    req.sessionId =
      typeof existing === "string" && /^[a-f0-9-]{36}$/.test(existing)
        ? existing
        : randomUUID();
    if (existing !== req.sessionId)
      res.cookie("brickmedic_session", req.sessionId, {
        httpOnly: true,
        sameSite: "strict",
        secure: options.secureCookies ?? false,
        maxAge: 7 * 86400_000,
        path: "/api",
      });
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.get("/api/health", async (_req, res) => {
    await service.store.ping();
    res.json({
      ok: true,
      database: "FalkorDB",
      mode: options.aiEnabled ? "anthropic" : "graph",
    });
  });
  app.get("/api/demos", (_req, res) =>
    res.json(
      Object.entries(DEMOS).map(([id, model]) => ({
        id,
        name: model.name,
        description: model.description,
        category: model.category,
        bricks: model.bricks.length,
      })),
    ),
  );
  app.get("/api/state", async (req, res) =>
    res.json(await service.get(req.sessionId)),
  );
  app.get("/api/queries", (_req, res) =>
    res.json({
      anchored: QUERIES.anchored,
      component: QUERIES.component,
      path: QUERIES.path,
    }),
  );
  app.post("/api/load", async (req, res) => {
    const body = z
      .object({ demo: z.enum(["space-cadet", "garden-house", "little-rover"]) })
      .parse(req.body);
    res.json(
      await service.load(req.sessionId, modelSchema.parse(DEMOS[body.demo])),
    );
  });
  app.post("/api/import", async (req, res) => {
    const body = z
      .object({
        format: z.enum(["json", "ldr"]),
        content: z.string().min(1).max(100_000),
        name: z.string().min(1).max(70),
      })
      .parse(req.body);
    let model;
    try {
      model =
        body.format === "ldr"
          ? parseLdraw(body.content, body.name)
          : modelSchema.parse(JSON.parse(body.content));
    } catch (error) {
      throw new AppError(
        400,
        error instanceof Error ? error.message : "Invalid model.",
      );
    }
    res.json(await service.load(req.sessionId, model));
  });
  app.post("/api/plan", async (req, res) =>
    res.json(await service.plan(req.sessionId)),
  );
  for (const action of ["apply", "reject"] as const) {
    app.post(`/api/${action}`, async (req, res) => {
      const body = z
        .object({
          id: z.string().uuid(),
          revision: z.number().int().positive(),
        })
        .parse(req.body);
      res.json(await service[action](req.sessionId, body.id, body.revision));
    });
  }
  app.get("/api/export/:format", async (req, res) => {
    const format = z.enum(["json", "ldr"]).parse(req.params.format);
    const state = await service.get(req.sessionId);
    res.attachment(`brickmedic-repaired.${format}`);
    res.type(format === "json" ? "application/json" : "text/plain");
    res.send(
      format === "json"
        ? JSON.stringify(state.model, null, 2)
        : exportLdraw(state.model),
    );
  });
  app.use("/api", (_req, _res, next) =>
    next(new AppError(404, "API route not found.")),
  );
  const dist = path.resolve("dist");
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(path.join(dist, "index.html")),
    );
  }
  const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof AppError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    if (error instanceof z.ZodError) {
      res
        .status(400)
        .json({ error: error.issues.map((i) => i.message).join(" ") });
      return;
    }
    if (error instanceof SyntaxError) {
      res.status(400).json({ error: "Invalid JSON request." });
      return;
    }
    if (error instanceof Error && error.message.startsWith("Bricks ")) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error(
      "Request failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    res
      .status(503)
      .json({
        error:
          "The graph or AI service is unavailable. Check the server and database, then try again.",
      });
  };
  app.use(errors);
  return app;
}
