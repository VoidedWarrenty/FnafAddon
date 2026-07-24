import { system, world } from "@minecraft/server";

// Lightweight performance instrumentation for the renderer pipeline.
//
// Explicitly OUTSIDE the deterministic pipeline: measurements happen
// AROUND stages, never INSIDE them. Per ADR-007 (draft), no wall-clock
// or tick value flows back into the Render Model.
//
// Trigger a report from chat with:
//   /scriptevent fnaf:metrics
//
// Samples are ring-buffered per event kind so we always report the
// most recent runs even after many opens.

const BUFFER_SIZE = 32;

// event kind -> ring buffer of samples
const samples = new Map();

// event kind -> in-flight start snapshot
const inFlight = new Map();

function pushSample(kind, sample) {
  let ring = samples.get(kind);
  if (!ring) {
    ring = { items: new Array(BUFFER_SIZE), head: 0, count: 0 };
    samples.set(kind, ring);
  }
  ring.items[ring.head] = sample;
  ring.head = (ring.head + 1) % BUFFER_SIZE;
  if (ring.count < BUFFER_SIZE) ring.count++;
}

function statsFor(kind, key) {
  const ring = samples.get(kind);
  if (!ring || ring.count === 0) return null;
  let min = Infinity, max = -Infinity, sum = 0;
  for (let i = 0; i < ring.count; i++) {
    const v = ring.items[i]?.[key];
    if (typeof v !== "number") continue;
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  if (!Number.isFinite(min)) return null;
  return { min, max, avg: sum / ring.count, count: ring.count };
}

// Wall-clock in ms via performance.now if available, else system tick
// converted (1 tick = 50 ms). Bedrock scripts get a real performance
// timer via `system.currentTick` and JS Date is disallowed for
// determinism — but metrics is explicitly outside determinism.
function nowMs() {
  // Bedrock's script API exposes system.currentTick (integer 20 tps).
  // Multiply by 50 for ms; used to avoid `Date.now()` for portability.
  return system.currentTick * 50;
}

/**
 * Begin a timed sample. Call end(kind, extra?) later with the same kind.
 */
export function begin(kind) {
  inFlight.set(kind, { start: nowMs() });
}

/**
 * Complete a timed sample. `extras` is merged into the recorded row.
 */
export function end(kind, extras = {}) {
  const started = inFlight.get(kind);
  if (!started) return;
  inFlight.delete(kind);
  pushSample(kind, {
    durationMs: nowMs() - started.start,
    ...extras,
  });
}

/**
 * Fire-and-forget observation (no duration).
 */
export function observe(kind, extras = {}) {
  pushSample(kind, { ...extras });
}

// ---- Reporting -------------------------------------------------------

function formatKind(kind) {
  const ring = samples.get(kind);
  if (!ring || ring.count === 0) return `§8${kind}: no samples`;
  const dur = statsFor(kind, "durationMs");
  const parts = [];
  if (dur) {
    parts.push(
      `avg §f${Math.round(dur.avg)}ms§7 (min §f${dur.min}§7 / max §f${dur.max}§7) n=${dur.count}`
    );
  } else {
    parts.push(`n=${ring.count}`);
  }
  // Include the most recent sample's extras.
  const latestIdx = (ring.head - 1 + BUFFER_SIZE) % BUFFER_SIZE;
  const latest = ring.items[latestIdx];
  if (latest) {
    const extraPairs = Object.entries(latest)
      .filter(([k]) => k !== "durationMs")
      .map(([k, v]) => `${k}=§f${v}§7`)
      .join(" ");
    if (extraPairs) parts.push("latest: " + extraPairs);
  }
  return `§b${kind}§7 · ${parts.join(" · ")}`;
}

export function reportToPlayer(player) {
  const lines = [
    "§9§l=== FNAF Renderer Metrics ===",
    formatKind("ui.open"),
    formatKind("pipeline.buildSnapshot"),
    formatKind("pipeline.encodeForm"),
    formatKind("device.applyBlueprint"),
    "",
    "§8§oValues sample the last " + BUFFER_SIZE + " runs; unit: ms.",
    "§8§oExtras: cells (grid), rooms (detected), walls (raw), ",
    "§8§obuildingCells (bbox), interactiveControls.",
  ];
  player.sendMessage(lines.join("\n"));
}

// ---- Registration ---------------------------------------------------

export function registerMetrics() {
  system.afterEvents.scriptEventReceive.subscribe(ev => {
    if (ev.id !== "fnaf:metrics") return;
    const p = ev.sourceEntity;
    if (!p) return;
    system.run(() => reportToPlayer(p));
  });
}
