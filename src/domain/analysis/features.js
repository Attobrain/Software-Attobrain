"use strict";
const { statistics } = require("../metrics");
/** @returns {{coverage: number|null, windows: number[], thirds: number[], thirdWindows: number[][], validMs: number, validDistance: number}} */
function movementSupport(run) {
  let validMs = 0, validDistance = 0, elapsed = 0, distance = 0, segment = null;
  const windows = [], thirds = [0, 0, 0], thirdWindows = [[], [], []];
  const measured = run.steps.some(s => typeof s.validInput === "boolean");
  for (const s of run.steps) {
    if (s.segment !== segment || s.validInput !== true) {
      elapsed = 0; distance = 0; segment = s.segment;
    }
    if (s.validInput !== true) continue;
    validMs += s.dt;
    for (let i = 0; i < 3; i++) {
      const start = run.active * i / 3, end = run.active * (i + 1) / 3;
      thirds[i] += Math.max(0, Math.min(s.t, end) - Math.max(s.t - s.dt, start));
    }
    elapsed += s.dt;
    const movement = Math.hypot(s.x - s.from.x, s.y - s.from.y);
    distance += movement;
    validDistance += movement;
    if (elapsed >= 500 - 1e-6) {
      const speed = distance / (elapsed / 1000), index = Math.min(2, Math.floor((s.t - 1e-6) / run.active * 3));
      windows.push(speed);
      if (s.t - elapsed >= run.active * index / 3 - 1e-6) thirdWindows[index].push(speed);
      elapsed = 0; distance = 0;
    }
  }
  return { coverage: measured && run.active > 0 ? Math.min(1, validMs / run.active) : null, validMs, validDistance, windows, thirds, thirdWindows };
}
function features(run) {
  const m = run.result, support = movementSupport(run), seconds = run.active / 1000;
  const adequate = seconds >= 30 && support.coverage !== null && support.coverage >= .8 - 1e-8;
  const f = (value, unit, eligible, reason, count = null, version = "1.0") => ({
    value: Number.isFinite(value) ? value : null, unit, eligibility: eligible && Number.isFinite(value) ? "eligible" : "limited", reason: eligible && Number.isFinite(value) ? null : reason, supportCount: count, definitionVersion: version,
  });
  const cv = statistics(support.windows).cv;
  const completed = run.state === "COMPLETED";
  return {
    runId: run.id, label: run.label, state: run.state, seconds,
    quality: { coverage: support.coverage, validMs: support.validMs, windows: support.windows.length, thirdsValidMs: support.thirds, thirdsCv: support.thirdWindows.map(v => statistics(v).cv), temporalEligible: seconds >= 45 && support.thirds.every(v => v >= 15000 - 1e-6) },
    metrics: {
      contacts: f(m.contacts.length, "episódios", true, null, m.contacts.length),
      efficiency: f(m.efficiency, "%", completed, "Exige conclusão do percurso."),
      speed: f(support.validMs > 0 ? support.validDistance / (support.validMs / 1000) : null, "larguras/s", adequate, "Exige 30 s e 80% de cobertura válida.", null, "valid-input-pace-v1"),
      cv: f(cv, "razão", adequate && support.windows.length >= 40, "Exige 30 s, 80% de cobertura, 40 janelas de 500 ms e média não nula.", support.windows.length, "smoothed-500ms-v1"),
      low: f(m.lowMs / 1000, "s", adequate, "Exige 30 s e cobertura válida."),
      contactsPerMinute: f(m.contactsPerMinute, "episódios/min", seconds >= 60 && adequate, "Exige 60 s e cobertura válida."),
      recovery: f(m.recovery.median === null ? null : m.recovery.median / 1000, "s", m.recovery.valid >= 3, "Exige três recuperações completas.", m.recovery.valid),
      contactDensity: f(m.reference > 0 ? 10 * m.contacts.length / (m.reference * run.maze.cols) : null, "contatos/10 larguras de corredor de referência", completed, "Exige percurso concluído e referência geométrica."),
    },
  };
}
module.exports = { features, movementSupport };
