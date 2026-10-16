import { Component, Suspense, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Bounds,
  ContactShadows,
  Line,
  OrbitControls,
  RoundedBox,
} from "@react-three/drei";
import * as THREE from "three";
import {
  COLORS,
  PARTS,
  type Brick,
  type Candidate,
  type SessionState,
} from "../shared/model";

function shape(brick: Brick) {
  const p = PARTS[brick.part];
  return {
    w: brick.rotated ? p.d : p.w,
    d: brick.rotated ? p.w : p.d,
    h: p.h * 0.4,
  };
}

function ToyBrick({
  brick,
  disconnected,
  selected,
  onSelect,
  ghost = false,
}: {
  brick: Brick;
  disconnected: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  ghost?: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const d = shape(brick);
  const target = useMemo(
    () =>
      new THREE.Vector3(
        brick.x + d.w / 2,
        brick.y * 0.4 + d.h / 2,
        brick.z + d.d / 2,
      ),
    [brick.x, brick.y, brick.z, d.w, d.h, d.d],
  );
  useFrame((_, delta) => {
    group.current?.position.lerp(target, 1 - Math.exp(-delta * 10));
  });
  const color = ghost ? "#51ad90" : COLORS[brick.color];
  return (
    <group
      ref={group}
      position={target}
      onClick={(event) => {
        event.stopPropagation();
        if (!ghost) onSelect(brick.id);
      }}
    >
      <RoundedBox
        args={[d.w - 0.045, d.h - 0.025, d.d - 0.045]}
        radius={0.065}
        smoothness={3}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={color}
          roughness={0.3}
          metalness={0.03}
          transparent={ghost}
          opacity={ghost ? 0.38 : 1}
          emissive={
            ghost
              ? "#29a77c"
              : selected
                ? "#f59d45"
                : disconnected
                  ? "#cf3329"
                  : "#000000"
          }
          emissiveIntensity={
            ghost ? 0.22 : selected ? 0.24 : disconnected ? 0.16 : 0
          }
          depthWrite={!ghost}
        />
      </RoundedBox>
      {Array.from({ length: d.w }, (_, x) =>
        Array.from({ length: d.d }, (_, z) => (
          <mesh
            key={`${x}-${z}`}
            position={[x - d.w / 2 + 0.5, d.h / 2 + 0.07, z - d.d / 2 + 0.5]}
            castShadow
          >
            <cylinderGeometry args={[0.29, 0.29, 0.17, 20]} />
            <meshStandardMaterial
              color={color}
              roughness={0.3}
              transparent={ghost}
              opacity={ghost ? 0.4 : 1}
              depthWrite={!ghost}
            />
          </mesh>
        )),
      )}
      {selected && !ghost && (
        <RoundedBox
          args={[d.w + 0.025, d.h + 0.04, d.d + 0.025]}
          radius={0.08}
          smoothness={2}
        >
          <meshBasicMaterial
            color="#ff704d"
            wireframe
            transparent
            opacity={0.55}
          />
        </RoundedBox>
      )}
    </group>
  );
}

class WebGLBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="canvas-fallback">
        3D rendering is unavailable in this browser. Use the connection graph to
        inspect and repair the model.
      </div>
    ) : (
      this.props.children
    );
  }
}

export function BuildView({
  state,
  candidate,
  preview,
  selected,
  showConnections,
  viewKey,
  onSelect,
}: {
  state: SessionState;
  candidate?: Candidate;
  preview: boolean;
  selected: string | null;
  showConnections: boolean;
  viewKey: number;
  onSelect: (id: string) => void;
}) {
  const bricks = state.model.bricks;
  const positions = useMemo(
    () =>
      new Map(
        bricks.map((brick) => {
          const d = shape(brick);
          return [
            brick.id,
            [brick.x + d.w / 2, brick.y * 0.4 + d.h / 2, brick.z + d.d / 2] as [
              number,
              number,
              number,
            ],
          ];
        }),
      ),
    [bricks],
  );
  const minX = Math.min(...bricks.map((b) => b.x)),
    maxX = Math.max(...bricks.map((b) => b.x + shape(b).w));
  const minZ = Math.min(...bricks.map((b) => b.z)),
    maxZ = Math.max(...bricks.map((b) => b.z + shape(b).d));
  const centerX = (minX + maxX) / 2,
    centerZ = (minZ + maxZ) / 2;
  return (
    <WebGLBoundary>
      <Canvas
        key={viewKey}
        shadows={{ type: THREE.PCFShadowMap }}
        camera={{ position: [16, 14, 20], fov: 34 }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        aria-label="Interactive 3D brick model"
      >
        <color attach="background" args={["#f1f3f6"]} />
        <ambientLight intensity={1.7} />
        <directionalLight
          position={[8, 16, 8]}
          intensity={3}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0003}
        />
        <directionalLight
          position={[-10, 8, -6]}
          intensity={1.2}
          color="#d6e2ff"
        />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.2}>
            <group position={[-centerX, 0, -centerZ]}>
              {bricks.map((brick) => (
                <ToyBrick
                  key={brick.id}
                  brick={brick}
                  disconnected={state.analysis.disconnectedIds.includes(
                    brick.id,
                  )}
                  selected={selected === brick.id}
                  onSelect={onSelect}
                />
              ))}
              {preview &&
                candidate &&
                bricks
                  .filter((b) => candidate.movedIds.includes(b.id))
                  .map((brick) => (
                    <ToyBrick
                      key={`ghost-${brick.id}`}
                      brick={{
                        ...brick,
                        x: brick.x + candidate.offset.x,
                        y: brick.y + candidate.offset.y,
                        z: brick.z + candidate.offset.z,
                      }}
                      disconnected={false}
                      selected={false}
                      ghost
                      onSelect={() => {}}
                    />
                  ))}
              {showConnections &&
                state.analysis.edges.map((edge) => (
                  <Line
                    key={`${edge.from}-${edge.to}`}
                    points={[
                      positions.get(edge.from)!,
                      positions.get(edge.to)!,
                    ]}
                    color="#2c997e"
                    lineWidth={2.5}
                    transparent
                    opacity={0.75}
                  />
                ))}
            </group>
          </Bounds>
          <ContactShadows
            position={[0, -0.03, 0]}
            opacity={0.28}
            scale={40}
            blur={2.7}
            far={15}
            resolution={512}
          />
          <gridHelper
            args={[60, 60, "#d8dfe7", "#e3e8ef"]}
            position={[0, -0.06, 0]}
          />
          <OrbitControls
            makeDefault
            minPolarAngle={0.15}
            maxPolarAngle={Math.PI / 2.05}
            enableDamping
          />
        </Suspense>
      </Canvas>
    </WebGLBoundary>
  );
}

export function ConnectionGraph({
  state,
  selected,
  onSelect,
}: {
  state: SessionState;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const anchored = state.model.bricks.filter((b) =>
    state.analysis.anchoredIds.includes(b.id),
  );
  const loose = state.model.bricks.filter((b) =>
    state.analysis.disconnectedIds.includes(b.id),
  );
  const ordered = [...anchored, ...loose];
  const height = Math.max(360, Math.ceil(ordered.length / 5) * 100 + 100);
  const position = new Map(
    ordered.map((brick, i) => [
      brick.id,
      { x: 80 + (i % 5) * 120, y: 100 + Math.floor(i / 5) * 100 },
    ]),
  );
  const path = new Set(selected ? (state.analysis.paths[selected] ?? []) : []);
  return (
    <div className="graph-view">
      <svg
        viewBox={`0 0 650 ${height}`}
        role="img"
        aria-label="Brick connection graph"
      >
        <text x="32" y="35" className="graph-caption">
          {state.model.bricks.length} BRICKS · {state.analysis.edges.length}{" "}
          PHYSICAL CONNECTIONS
        </text>
        {state.analysis.edges.map((edge) => {
          const a = position.get(edge.from)!,
            b = position.get(edge.to)!;
          return (
            <line
              key={`${edge.from}-${edge.to}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={
                path.has(edge.from) && path.has(edge.to) ? "#2a9879" : "#d1d9e2"
              }
              strokeWidth={path.has(edge.from) && path.has(edge.to) ? 4 : 2}
            />
          );
        })}
        {ordered.map((brick) => {
          const p = position.get(brick.id)!,
            disconnected = state.analysis.disconnectedIds.includes(brick.id);
          return (
            <g
              key={brick.id}
              role="button"
              tabIndex={0}
              aria-label={`Inspect ${brick.label}`}
              onClick={() => onSelect(brick.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(brick.id);
                }
              }}
              className="graph-node"
            >
              <title>
                {brick.label} ·{" "}
                {disconnected ? "Disconnected from base" : "Connected to base"}
              </title>
              <circle
                cx={p.x}
                cy={p.y}
                r={selected === brick.id ? 25 : 22}
                fill={disconnected ? "#fff0e9" : "#ffffff"}
                stroke={
                  selected === brick.id
                    ? "#ff6542"
                    : disconnected
                      ? "#ed795e"
                      : "#8ea4b9"
                }
                strokeWidth={2}
              />
              <rect
                x={p.x - 10}
                y={p.y - 8}
                width={20}
                height={16}
                rx={3}
                fill={COLORS[brick.color]}
              />
              <circle
                cx={p.x - 4}
                cy={p.y - 3}
                r={2}
                fill="white"
                opacity={0.5}
              />
              <circle
                cx={p.x + 4}
                cy={p.y - 3}
                r={2}
                fill="white"
                opacity={0.5}
              />
              {state.rootIds.includes(brick.id) && (
                <text
                  x={p.x}
                  y={p.y + 44}
                  textAnchor="middle"
                  className="root-caption"
                >
                  BASE
                </text>
              )}
              <text
                x={p.x}
                y={p.y + 34}
                textAnchor="middle"
                className="node-label"
              >
                {brick.id.length > 15 ? `${brick.id.slice(0, 12)}…` : brick.id}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
