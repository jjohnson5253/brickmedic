import "dotenv/config";
import { GraphStore } from "./store";
import { RepairPlanner, AnthropicChooser } from "./planner";
import { BrickMedicService } from "./service";
import { createApp } from "./app";

try {
  const store = await GraphStore.connect(
    process.env.FALKORDB_URL ?? "redis://127.0.0.1:6387",
  );
  const chooser = process.env.ANTHROPIC_API_KEY
    ? new AnthropicChooser(
        process.env.ANTHROPIC_API_KEY,
        process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5",
      )
    : undefined;
  const app = createApp(
    new BrickMedicService(store, new RepairPlanner(store, chooser)),
    {
      aiEnabled: !!chooser,
      secureCookies: process.env.SECURE_COOKIES === "true",
      origin: process.env.PUBLIC_ORIGIN,
    },
  );
  const port = Number(process.env.PORT ?? 4318);
  const server = app.listen(port, process.env.HOST ?? "127.0.0.1", () => {
    console.log(
      `BrickMedic API: http://localhost:${port} · ${chooser ? "AI + graph planner" : "Deterministic graph planner"}`,
    );
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      server.close(() => {
        void store.close().then(() => process.exit(0));
      });
    });
} catch {
  console.error(
    "Could not connect to FalkorDB. Run npm run db:up and check FALKORDB_URL.",
  );
  process.exitCode = 1;
}
