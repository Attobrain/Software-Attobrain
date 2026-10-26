"use strict";
const { cellAt } = require("./mazes");
const { lowMovement } = require("./low-movement");
const { contactAnalysis } = require("./contacts");
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
function statistics(a) {
  const average = mean(a);
  if (average === null) return { mean: null, sd: null, cv: null };
  const sd = Math.sqrt(mean(a.map((v) => (v - average) ** 2)));
  return { mean: average, sd, cv: average > 1e-9 ? sd / average : null };
}
function quantile(a, q) {
  if (!a.length) return null;
  const s = [...a].sort((a, b) => a - b),
    i = (s.length - 1) * q;
  return s[Math.floor(i)] + (s[Math.ceil(i)] - s[Math.floor(i)]) * (i % 1);
}
function analyze(run, config) {
  const steps = run.steps,
    maze = run.maze,
    contactData = contactAnalysis(run),
    contacts = contactData.contacts,
    recoveries = contactData.recoveries,
    low = lowMovement(validSegments(steps), config),
    backtracks = [],
    directions = [];
  let distance = 0,
    graphDistance = 0,
    prior = { x: 0.5 / maze.cols, y: 0.5 / maze.rows },
    cell = 0,
    segment = -1;
  let backtrack = null,
    anchor = null,
    lastDirection = null;
  const speeds = [];
  for (const s of steps) {
    if (s.segment !== segment) {
      anchor = null;
      lastDirection = null;
      backtrack = null;
      prior = s.from;
      cell = cellAt(prior, maze);
      segment = s.segment;
    }
    const d = Math.hypot(s.x - prior.x, s.y - prior.y),
      speed = d / (s.dt / 1000);
    distance += d;
    speeds.push(speed);
    for (const next of s.cells) {
      if (next === cell) continue;
      const length =
        Math.floor(next / maze.cols) === Math.floor(cell / maze.cols)
          ? 1 / maze.cols
          : 1 / maze.rows;
      graphDistance += length;
      if (run.distances[next] > run.distances[cell]) {
        if (!backtrack) {
          backtrack = { start: s.t, end: s.t, distance: 0 };
          backtracks.push(backtrack);
        }
        backtrack.end = s.t;
        backtrack.distance += length;
      } else backtrack = null;
      cell = next;
    }
    if (!anchor) anchor = { ...s };
    if (Math.hypot(s.x - anchor.x, s.y - anchor.y) >= 0.01) {
      const vector = { x: s.x - anchor.x, y: s.y - anchor.y };
      if (lastDirection) {
        const cosine =
          (vector.x * lastDirection.x + vector.y * lastDirection.y) /
          (Math.hypot(vector.x, vector.y) *
            Math.hypot(lastDirection.x, lastDirection.y));
        if (Math.acos(Math.max(-1, Math.min(1, cosine))) >= Math.PI / 3)
          directions.push({ t: s.t, position: { x: s.x, y: s.y } });
      }
      lastDirection = vector;
      anchor = { ...s };
    }
    prior = s;
  }
  const active = run.active,
    reference = run.metadata.length,
    completed = run.state === "COMPLETED";
  const velocity = statistics(speeds),
    validRecoveries = recoveries
      .filter((r) => !r.censored)
      .map((r) => r.duration);
  const thirds = Array.from({ length: 3 }, (_, i) => {
    const start = (active * i) / 3,
      end = (active * (i + 1)) / 3,
      ss = steps.filter((s) => s.t > start && s.t <= end),
      seconds = ss.reduce((v, s) => v + s.dt, 0) / 1000;
    const v = statistics(
      ss.map((s) => Math.hypot(s.x - s.from.x, s.y - s.from.y) / (s.dt / 1000)),
    );
    return {
      start,
      end,
      validSeconds: seconds,
      eligible: seconds >= 5,
      contactsPerMinute: seconds
        ? contacts.filter((c) => c.t > start && c.t <= end).length /
          (seconds / 60)
        : null,
      speed: v.mean,
      cv: v.cv,
      lowMs: low.reduce(
        (v, e) =>
          v + Math.max(0, Math.min(end, e.end) - Math.max(start, e.start)),
        0,
      ),
      checkpoints: run.events.filter(
        (e) =>
          e.type === "checkpoint" &&
          e.activeTime > start &&
          e.activeTime <= end,
      ).length,
    };
  });
  const spatial = new Map();
  for (const contact of contacts) {
    const key = contact.cell + ":" + contact.wall;
    const item = spatial.get(key) ?? {
      cell: contact.cell,
      wall: contact.wall,
      count: 0,
      position: contact.position,
    };
    item.count++;
    spatial.set(key, item);
  }
  return {
    formulaVersion: 3,
    ...contactData,
    episodeRate: active ? contactData.collisionEpisodeCount / (active / 60000) : null,
    legacyFields: { contacts: "Registros por superfície de parede; não são episódios.", contactsPerMinute: "Taxa de registros por parede, preservada para auditoria.", velocity: "Velocidades por passo do motor; CV distinto do suavizado de 500 ms." },
    activeMs: active,
    pausedMs: run.pauses.reduce(
      (v, p) => v + ((p.end ?? run.sessionNow) - p.start),
      0,
    ),
    state: run.state,
    progress: run.progress,
    distance,
    reference,
    graphDistance,
    efficiency:
      completed && graphDistance > 0 ? (100 * reference) / graphDistance : null,
    excess: completed ? graphDistance - reference : null,
    excessPercent: completed
      ? (100 * (graphDistance - reference)) / reference
      : null,
    speed: active ? distance / (active / 1000) : null,
    velocity,
    contacts,
    spatialContacts: [...spatial.values()],
    contactsPerMinute: active ? contacts.length / (active / 60000) : null,
    contactsPerDistance: distance ? contacts.length / distance : null,
    recoveries,
    recovery: {
      median: quantile(validRecoveries, 0.5),
      q1: quantile(validRecoveries, 0.25),
      q3: quantile(validRecoveries, 0.75),
      valid: validRecoveries.length,
      censored: recoveries.length - validRecoveries.length,
    },
    low,
    lowMs: low.reduce((v, e) => v + e.duration, 0),
    backtracks,
    directionChanges: directions,
    thirds,
    unavailable: {
      efficiency: completed ? null : "requires-completion",
      cv: velocity.cv === null ? "zero-mean-or-no-data" : null,
    },
  };
}
module.exports = { analyze, statistics, quantile };
// Missing input is not stationary behavior. Split gaps without connecting episodes.
function validSegments(steps) {
  if (steps.every(s => s.validInput !== false)) return steps;
  let segment = 0, previous = null;
  return steps.flatMap(s => {
    if (s.validInput === false) { segment++; previous = null; return []; }
    if (previous !== s.segment) { segment++; previous = s.segment; }
    return [{ ...s, segment }];
  });
}
