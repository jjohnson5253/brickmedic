import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Box,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  CodeXml,
  Cross,
  ExternalLink,
  FileUp,
  GitBranch,
  House,
  Link2,
  LoaderCircle,
  Maximize2,
  MoveUpRight,
  Rocket,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Truck,
  X,
} from "lucide-react";
import {
  type Candidate,
  type DemoInfo,
  type SessionState,
} from "../shared/model";
import { api, track } from "./api";
import { BuildView, ConnectionGraph } from "./BuildView";

type EvidenceTab = "activity" | "graph" | "memory";
type Queries = { anchored: string; component: string; path: string };
const demoIcons = [Rocket, House, Truck];

function offsetLabel(candidate: Candidate) {
  const { x, y, z } = candidate.offset;
  return [
    x &&
      `${Math.abs(x)} stud${Math.abs(x) === 1 ? "" : "s"} ${x < 0 ? "left" : "right"}`,
    y &&
      `${Math.abs(y)} plate${Math.abs(y) === 1 ? "" : "s"} ${y < 0 ? "down" : "up"}`,
    z &&
      `${Math.abs(z)} stud${Math.abs(z) === 1 ? "" : "s"} ${z < 0 ? "back" : "forward"}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function App() {
  const [state, setState] = useState<SessionState | null>(null);
  const [demos, setDemos] = useState<DemoInfo[]>([]);
  const [queries, setQueries] = useState<Queries | null>(null);
  const [mode, setMode] = useState("graph");
  const [busy, setBusy] = useState("loading");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"build" | "graph">("build");
  const [evidence, setEvidence] = useState<EvidenceTab>("activity");
  const [selected, setSelected] = useState<string | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [preview, setPreview] = useState(true);
  const [connections, setConnections] = useState(false);
  const [viewKey, setViewKey] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const help = useRef<HTMLElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  async function initialize() {
    setBusy("loading");
    setError("");
    try {
      const health = await api<{ mode: string }>("health");
      setMode(health.mode);
      const info = await api<DemoInfo[]>("demos");
      setDemos(info);
      const queryData = await api<Queries>("queries");
      setQueries(queryData);
      setState(await api<SessionState>("state"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the graph.");
    } finally {
      setBusy("");
    }
  }
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      void initialize();
    }
  }, []);
  useEffect(() => {
    if (!showHelp) return;
    const previous = document.activeElement as HTMLElement | null;
    help.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowHelp(false);
        track("help_closed");
      }
      if (event.key === "Tab") {
        const items =
          help.current?.querySelectorAll<HTMLElement>("button, a[href]");
        const first = items?.[0],
          last = items?.[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [showHelp]);

  async function act(path: string, body: unknown, event: string) {
    setBusy(path);
    setError("");
    track(event);
    try {
      const next = await api<SessionState>(path, body);
      setState(next);
      setCandidateId(next.plan?.recommendedId ?? null);
      if (path === "load" || path === "import") {
        setSelected(null);
        setViewKey((n) => n + 1);
      }
      if (path === "apply") {
        setSelected(null);
        setEvidence("memory");
      }
      if (path === "plan") {
        setEvidence("activity");
        setPreview(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy("");
    }
  }

  function selectBrick(id: string) {
    setSelected(id);
    track("brick_selected", { view: tab });
  }
  const plan = state?.plan;
  const candidate =
    plan?.candidates.find(
      (c) => c.id === (candidateId ?? plan.recommendedId),
    ) ?? plan?.candidates[0];
  const disconnected = state?.analysis.disconnectedIds.length ?? 0;
  const total = state?.model.bricks.length ?? 0;
  const connected = total - disconnected;
  const healthy = !!state && disconnected === 0;
  const selectedBrick = state?.model.bricks.find((b) => b.id === selected);
  const demoId = demos.find((demo) => demo.name === state?.model.name)?.id;

  async function importFile(file?: File) {
    if (!file) return;
    if (file.size > 100_000) {
      setError("Choose a model smaller than 100 KB.");
      return;
    }
    const format = file.name.toLowerCase().endsWith(".ldr") ? "ldr" : "json";
    await act(
      "import",
      {
        content: await file.text(),
        format,
        name: file.name.replace(/\.[^.]+$/, "").slice(0, 70),
      },
      "model_imported",
    );
    if (upload.current) upload.current.value = "";
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a
            className="brand"
            href="/"
            aria-label="BrickMedic home"
            onClick={() => track("home_clicked")}
          >
            <span className="brand-mark">
              <Cross size={23} strokeWidth={3} />
            </span>
            <span>
              Brick<span className="brand-light">Medic</span>
              <span className="beta">LAB</span>
            </span>
          </a>
          <div className="topbar-description">
            A little care for every connection.
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button"
              aria-label="How BrickMedic works"
              onClick={() => {
                setShowHelp(true);
                track("help_opened");
              }}
            >
              <CircleHelp size={19} />
            </button>
            <a
              href="https://github.com/jjohnson5253/brickmedic/tree/feat/brickmedic-hackathon"
              target="_blank"
              rel="noreferrer"
              className="github-link"
              aria-label="View source on GitHub"
              onClick={() => track("github_clicked")}
            >
              <CodeXml size={18} />
              <span>View source</span>
              <MoveUpRight size={13} />
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="intro">
          <div>
            <div className="eyebrow">
              <span /> THE BRICK CONNECTION LAB
            </div>
            <h1>
              Find the missing <span>connection.</span>
            </h1>
            <p>
              Give loose bricks a way home. Inspect, repair, and see the proof.
            </p>
          </div>
          <a
            className="event-card"
            href="https://www.wemakedevs.org/hackathons/falkordb"
            target="_blank"
            rel="noreferrer"
            onClick={() => track("hackathon_clicked")}
          >
            <span className="event-icon">
              <GitBranch size={23} />
            </span>
            <div>
              <strong>Built for Graph Hacks</strong>
              <span>
                Powered by FalkorDB <ArrowRight size={12} />
              </span>
            </div>
          </a>
        </section>

        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button
              onClick={() => {
                track("retry_clicked");
                void initialize();
              }}
              disabled={!!busy}
            >
              Reconnect
            </button>
            <button
              className="icon-button"
              aria-label="Dismiss error"
              onClick={() => {
                setError("");
                track("error_dismissed");
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {!state ? (
          <div className="loading-shell">
            <LoaderCircle className="spin" size={28} />
            <h2>
              {busy
                ? "Connecting to the lab…"
                : "The lab is waiting for a connection."}
            </h2>
            <p>Start FalkorDB and the API, then reconnect.</p>
          </div>
        ) : (
          <>
            <section
              className="workbench"
              aria-label="Brick inspection workspace"
            >
              <div className="workbench-toolbar">
                <div className="model-title">
                  <span className="model-icon">
                    <Box size={19} />
                  </span>
                  <div>
                    <strong>{state.model.name}</strong>
                    <span>
                      {total} bricks <i /> revision {state.revision}
                    </span>
                  </div>
                </div>
                <div className="toolbar-actions">
                  <input
                    ref={upload}
                    className="visually-hidden"
                    type="file"
                    accept=".json,.ldr"
                    aria-label="Import brick model"
                    onChange={(e) => {
                      void importFile(e.target.files?.[0]);
                    }}
                  />
                  <button
                    className="subtle-button"
                    aria-label="Import model"
                    disabled={!!busy}
                    onClick={() => {
                      track("import_picker_opened");
                      upload.current?.click();
                    }}
                  >
                    <FileUp size={15} />
                    <span>Import model</span>
                  </button>
                  <a
                    className="download-button"
                    href="/api/export/ldr"
                    onClick={() => track("model_downloaded", { format: "ldr" })}
                  >
                    <ArrowDownToLine size={15} />
                    <span>Download .ldr</span>
                  </a>
                </div>
              </div>
              <div className="workbench-body">
                <div className="viewport-column">
                  <div className="viewport">
                    <div className="viewport-top">
                      <div className="segmented">
                        <button
                          className={tab === "build" ? "active" : ""}
                          aria-pressed={tab === "build"}
                          onClick={() => {
                            setTab("build");
                            track("view_selected", { view: "build" });
                          }}
                        >
                          <Box size={14} />
                          3D build
                        </button>
                        <button
                          className={tab === "graph" ? "active" : ""}
                          aria-pressed={tab === "graph"}
                          onClick={() => {
                            setTab("graph");
                            track("view_selected", { view: "graph" });
                          }}
                        >
                          <GitBranch size={14} />
                          Connection graph
                        </button>
                      </div>
                      <span className={`status-pill ${healthy ? "good" : ""}`}>
                        <span />
                        {healthy
                          ? "All connected"
                          : `${disconnected} disconnected`}
                      </span>
                    </div>
                    {tab === "build" ? (
                      <BuildView
                        state={state}
                        candidate={candidate}
                        preview={preview}
                        selected={selected}
                        showConnections={connections}
                        viewKey={viewKey}
                        onSelect={selectBrick}
                      />
                    ) : (
                      <ConnectionGraph
                        state={state}
                        selected={selected}
                        onSelect={selectBrick}
                      />
                    )}
                    {candidate && preview && tab === "build" && (
                      <div className="preview-label">
                        <span /> Green ghost = proposed placement
                      </div>
                    )}
                    <div className="viewport-bottom">
                      <span className="orbit-hint">
                        {tab === "build"
                          ? "Drag to orbit · Scroll to zoom · Click a brick"
                          : "Click a node to trace its connection to the base"}
                      </span>
                      <div className="viewport-controls">
                        {tab === "build" && (
                          <>
                            <button
                              title="Toggle connection lines"
                              aria-label="Toggle connection lines"
                              aria-pressed={connections}
                              className={connections ? "active" : ""}
                              onClick={() => {
                                setConnections(!connections);
                                track("connections_toggled", {
                                  enabled: !connections,
                                });
                              }}
                            >
                              <Link2 size={17} />
                            </button>
                            <button
                              title="Reset camera"
                              aria-label="Reset camera"
                              onClick={() => {
                                setViewKey((n) => n + 1);
                                track("camera_reset");
                              }}
                            >
                              <Maximize2 size={17} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {selectedBrick && (
                      <div className="brick-tooltip">
                        <div>
                          <strong>{selectedBrick.label}</strong>
                          <button
                            aria-label="Deselect brick"
                            onClick={() => {
                              setSelected(null);
                              track("brick_deselected");
                            }}
                          >
                            <X size={13} />
                          </button>
                        </div>
                        <span>
                          {state.analysis.disconnectedIds.includes(
                            selectedBrick.id,
                          )
                            ? "No connection path to the base"
                            : `${state.analysis.paths[selectedBrick.id]?.length ?? 1} nodes in path to base`}
                        </span>
                        <code>
                          {state.analysis.paths[selectedBrick.id]?.join(
                            " → ",
                          ) || selectedBrick.id}
                        </code>
                      </div>
                    )}
                  </div>
                  <div className="demo-strip">
                    <div className="demo-label">
                      TRY A BUILD <span>Small models. Real connections.</span>
                    </div>
                    <div className="demo-cards">
                      {demos.map((demo, i) => {
                        const Icon = demoIcons[i] ?? Box;
                        return (
                          <button
                            key={demo.id}
                            disabled={!!busy}
                            className={`demo-card ${demoId === demo.id ? "selected" : ""}`}
                            onClick={() => {
                              void act(
                                "load",
                                { demo: demo.id },
                                "demo_selected",
                              );
                            }}
                          >
                            <span className={`demo-illustration demo-${i}`}>
                              <Icon size={25} strokeWidth={1.6} />
                            </span>
                            <span>
                              <strong>{demo.name}</strong>
                              <small>{demo.bricks} bricks</small>
                            </span>
                            {demoId === demo.id ? (
                              <span className="demo-check">
                                <Check size={12} />
                              </span>
                            ) : (
                              <ArrowRight size={13} className="demo-arrow" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <aside className="inspector">
                  <div className="inspector-heading">
                    <span className="eyebrow">BUILD DIAGNOSIS</span>
                    <span className="live-badge">
                      <i /> LIVE GRAPH
                    </span>
                  </div>
                  <div className={`health-summary ${healthy ? "healthy" : ""}`}>
                    <div
                      className="health-ring"
                      style={
                        {
                          "--progress": `${(connected / total) * 100}%`,
                        } as React.CSSProperties
                      }
                    >
                      <span>
                        {Math.round((connected / total) * 100)}
                        <small>%</small>
                      </span>
                    </div>
                    <div>
                      <h2>
                        {healthy ? "Looking connected." : "A few loose ends."}
                      </h2>
                      <p>
                        {healthy
                          ? "Every brick has a path home."
                          : "Let’s bring your build together."}
                      </p>
                    </div>
                  </div>
                  <div className="stat-row">
                    <div>
                      <strong>
                        {connected}
                        <span>/{total}</span>
                      </strong>
                      <small>Connected bricks</small>
                    </div>
                    <div>
                      <strong>{state.analysis.edges.length}</strong>
                      <small>Connections</small>
                    </div>
                    <div>
                      <strong>{state.analysis.groups.length}</strong>
                      <small>Loose groups</small>
                    </div>
                  </div>
                  <div className="inspector-divider" />
                  {healthy ? (
                    <div className="healthy-card">
                      <span className="healthy-icon">
                        <CheckCheck size={27} />
                      </span>
                      <h3>Every brick belongs.</h3>
                      <p>
                        FalkorDB verified a path from every brick to the
                        original base.
                      </p>
                      <span className="verification-note">
                        <ShieldCheck size={14} /> Connectivity verified
                      </span>
                    </div>
                  ) : (
                    <div className="issue-summary">
                      <span className="issue-icon">
                        <Link2 size={18} />
                      </span>
                      <div>
                        <h3>{disconnected} bricks need a hand</h3>
                        <p>
                          {state.analysis.groups.length} disconnected assembl
                          {state.analysis.groups.length === 1 ? "y" : "ies"}. No
                          path to the original base.
                        </p>
                      </div>
                    </div>
                  )}

                  {candidate ? (
                    <div className="repair-card">
                      <div className="repair-label">
                        <Sparkles size={13} />
                        <span>VERIFIED REPAIR</span>
                        <span>
                          {plan?.mode === "anthropic"
                            ? "AI selected"
                            : "Graph ranked"}
                        </span>
                      </div>
                      <h3>{candidate.title}</h3>
                      <p className="offset-label">{offsetLabel(candidate)}</p>
                      <div className="repair-facts">
                        <span>
                          <Check size={13} />
                          {candidate.newlyConnected} bricks reconnected
                        </span>
                        <span>
                          <Check size={13} />
                          {candidate.contacts} stud contacts
                        </span>
                        <span>
                          <Check size={13} />
                          No intersecting bricks
                        </span>
                      </div>
                      <label className="preview-toggle">
                        <input
                          type="checkbox"
                          checked={preview}
                          onChange={(e) => {
                            setPreview(e.target.checked);
                            track("repair_preview_toggled", {
                              enabled: e.target.checked,
                            });
                          }}
                        />
                        <span>Preview placement</span>
                        <span className="toggle-track" />
                      </label>
                      {(plan?.candidates.length ?? 0) > 1 && (
                        <div
                          className="candidate-options"
                          aria-label="Repair alternatives"
                        >
                          {plan?.candidates.map((option, i) => (
                            <button
                              key={option.id}
                              className={
                                candidate.id === option.id ? "active" : ""
                              }
                              onClick={() => {
                                setCandidateId(option.id);
                                track("repair_alternative_selected", {
                                  index: i,
                                });
                              }}
                            >
                              Option {i + 1}
                              {plan.recommendedId === option.id
                                ? " · best"
                                : ""}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : plan && !healthy ? (
                    <p className="no-repair">{plan.summary}</p>
                  ) : null}

                  <div className="inspector-actions">
                    {candidate ? (
                      <>
                        <button
                          className="primary-button"
                          disabled={!!busy}
                          onClick={() => {
                            void act(
                              "apply",
                              { id: candidate.id, revision: state.revision },
                              "repair_applied",
                            );
                          }}
                        >
                          {busy === "apply" ? (
                            <LoaderCircle className="spin" size={17} />
                          ) : (
                            <ShieldCheck size={17} />
                          )}
                          Apply verified repair
                          <ArrowRight size={16} />
                        </button>
                        <button
                          className="text-button"
                          disabled={!!busy}
                          onClick={() => {
                            void act(
                              "reject",
                              { id: candidate.id, revision: state.revision },
                              "repair_rejected",
                            );
                          }}
                        >
                          {busy === "reject" ? (
                            <LoaderCircle className="spin" size={14} />
                          ) : (
                            <RotateCcw size={14} />
                          )}
                          Skip & remember this placement
                        </button>
                      </>
                    ) : (
                      <button
                        className={`primary-button ${healthy ? "secondary" : ""}`}
                        disabled={!!busy}
                        onClick={() => {
                          void act("plan", {}, "inspection_started");
                        }}
                      >
                        {busy === "plan" ? (
                          <LoaderCircle className="spin" size={17} />
                        ) : (
                          <ScanLine size={17} />
                        )}
                        {healthy
                          ? "Run another inspection"
                          : "Inspect & find repairs"}
                        <ArrowRight size={16} />
                      </button>
                    )}
                    <p className="planner-caption">
                      <span className="planner-dot" />
                      {mode === "anthropic"
                        ? "AI selection · graph verification"
                        : "Deterministic graph planner"}
                      <button
                        aria-label="About planner modes"
                        onClick={() => {
                          setShowHelp(true);
                          track("planner_help_opened");
                        }}
                      >
                        <CircleHelp size={12} />
                      </button>
                    </p>
                  </div>
                </aside>
              </div>
            </section>

            <section className="evidence-panel">
              <div className="evidence-header">
                <div className="evidence-title">
                  <span>
                    <Activity size={17} />
                  </span>
                  <div>
                    <h2>Follow the evidence.</h2>
                    <p>Every repair comes with a reason.</p>
                  </div>
                </div>
                <div className="evidence-tabs">
                  {(["activity", "graph", "memory"] as const).map((value) => (
                    <button
                      key={value}
                      className={evidence === value ? "active" : ""}
                      onClick={() => {
                        setEvidence(value);
                        track("evidence_tab_selected", { tab: value });
                      }}
                    >
                      {value === "activity"
                        ? "Agent activity"
                        : value === "graph"
                          ? "Graph evidence"
                          : "Repair memory"}
                      {value === "memory" && (
                        <span>{state.history.length}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div className="evidence-content" aria-live="polite">
                {evidence === "activity" ? (
                  <>
                    {plan ? (
                      <div className="tool-steps">
                        {plan.steps.map((step, index) => (
                          <div className="tool-step" key={step.tool}>
                            <span className="step-number">0{index + 1}</span>
                            <div>
                              <code>{step.tool}</code>
                              <p>{step.detail}</p>
                            </div>
                            <Check size={15} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-evidence">
                        <span className="empty-icon">
                          <ScanLine size={22} />
                        </span>
                        <div>
                          <strong>
                            {healthy
                              ? "Inspection complete. Connections verified."
                              : "Ready when you are."}
                          </strong>
                          <p>
                            {healthy
                              ? "Open Graph evidence to trace the connections, or load another build."
                              : "Run an inspection to watch the planner query, test, and verify repairs."}
                          </p>
                        </div>
                        <span className="tiny-label">FALKORDB CONNECTED</span>
                      </div>
                    )}
                    {plan && <p className="agent-summary">{plan.summary}</p>}
                  </>
                ) : evidence === "graph" ? (
                  <div className="graph-evidence">
                    <div>
                      <span className="tiny-label">
                        REACHABILITY TO THE ORIGINAL BASE
                      </span>
                      <pre>
                        <code>{queries?.anchored}</code>
                      </pre>
                    </div>
                    <div className="path-evidence">
                      <span className="tiny-label">
                        {candidate
                          ? "PROPOSED REPAIR PATH"
                          : "A VERIFIED CONNECTION PATH"}
                      </span>
                      <div className="path-pills">
                        {(
                          candidate?.path ??
                          Object.values(state.analysis.paths).find(
                            (p) => p.length > 1,
                          ) ?? [state.rootIds[0]]
                        ).map((id, index) => (
                          <span key={`${id}-${index}`}>
                            {index > 0 && <ArrowRight size={12} />}
                            <code>{id}</code>
                          </span>
                        ))}
                      </div>
                      <p>
                        Queried in FalkorDB. Each hop is a validated stud
                        connection.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="history-list">
                    {state.history.map((entry) => (
                      <div key={entry.id} className="history-row">
                        <span className={`history-icon ${entry.kind}`}>
                          {entry.kind === "applied" ? (
                            <Check size={14} />
                          ) : entry.kind === "rejected" ? (
                            <RotateCcw size={14} />
                          ) : (
                            <Box size={14} />
                          )}
                        </span>
                        <div>
                          <strong>
                            {entry.kind === "applied"
                              ? "Repair verified"
                              : entry.kind === "rejected"
                                ? "Placement remembered"
                                : "Model loaded"}
                          </strong>
                          <p>{entry.detail}</p>
                        </div>
                        <time dateTime={entry.time}>
                          {new Date(entry.time).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
            <div className="workspace-note">
              <span>
                <ShieldCheck size={14} /> Stud connectivity for upright bricks
                and plates. Physical strength is not simulated.
              </span>
              <a href="/blog.html" onClick={() => track("blog_opened")}>
                The story behind BrickMedic <ArrowRight size={13} />
              </a>
            </div>
          </>
        )}
      </main>
      <footer>
        <span className="footer-brand">
          <Cross size={13} /> BrickMedic
        </span>
        <span>Built by Jake Johnson · Graph Hacks 2026</span>
        <a
          href="https://github.com/jjohnson5253/brickmedic/blob/feat/brickmedic-hackathon/LICENSE"
          onClick={() => track("license_opened")}
        >
          Open source. Made to connect. <ExternalLink size={12} />
        </a>
      </footer>

      {showHelp && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setShowHelp(false);
            track("help_closed");
          }}
        >
          <section
            ref={help}
            className="help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close help"
              onClick={() => {
                setShowHelp(false);
                track("help_closed");
              }}
            >
              <X size={20} />
            </button>
            <span className="brand-mark">
              <Cross size={23} />
            </span>
            <h2 id="help-title">A path home for every brick.</h2>
            <p>
              BrickMedic stores your model in FalkorDB. Bricks become nodes,
              stud connections become edges, and the original base bricks become
              anchors.
            </p>
            <ol>
              <li>
                <strong>Inspect.</strong> Find bricks without a path to an
                anchor.
              </li>
              <li>
                <strong>Preview.</strong> Try a translation of an entire loose
                assembly. Every option is collision-checked and verified in a
                temporary graph.
              </li>
              <li>
                <strong>Repair.</strong> Apply one option, then query the
                updated graph again.
              </li>
            </ol>
            <p>
              The deterministic planner works without an API key. Set{" "}
              <code>ANTHROPIC_API_KEY</code> on the server to enable AI
              selection among verified candidates. API failures are shown
              explicitly.
            </p>
            <p>
              Import flat .ldr files or BrickMedic JSON, up to 100 bricks. The
              catalog supports 12 upright rectangular brick and plate parts,
              with quarter turns around the vertical axis. Other parts and
              transforms are rejected.
            </p>
            <a
              href="https://github.com/jjohnson5253/brickmedic/tree/feat/brickmedic-hackathon#readme"
              target="_blank"
              rel="noreferrer"
              onClick={() => track("documentation_opened")}
            >
              Read the setup and graph model <ArrowRight size={14} />
            </a>
          </section>
        </div>
      )}
    </>
  );
}
