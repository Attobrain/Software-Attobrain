"use strict";
// Reproducible functional fixture. No real participant or physiological acquisition.
const { writeFileSync } = require("node:fs");
const { Session } = require("../src/domain/session");
const s = new Session(0);
s.guided = true; s.professional = "test-professional"; s.student = "test-student";
const command = (type, extra = {}) => s.execute({ type, expectedRevision: s.controlRevision, ...extra });
function advance(milliseconds, target) {
  const until = s.previous + milliseconds;
  while (s.previous < until - 1e-6) {
    const now = Math.min(until, s.previous + 1000 / 60);
    s.presence = { visible: true, at: s.time };
    const r = s.current;
    if (r?.state === "RUNNING" && now - r.lastAccepted >= 50) s.input({ runId: r.id, seq: r.lastSeq + 1, inside: !!target, hidden: false, clientTime: now, ...target });
    s.tick(now);
  }
}
command("select-participant", { participant: { id: "automated-functional-test", name: "Demonstração automatizada — sem participante real" } });
command("configure", { config: { channels: 1 } });
s.presence = { visible: true, at: s.time };
command("begin");
for (let i = 0; i < 4; i++) {
  s.presence = { visible: true, at: s.time };
  command("start");
  advance(35000, { ...s.current.position });
  const r = s.current;
  for (const cell of r.path.slice(1)) {
    const target = { x: ((cell % 7) + .5) / 7, y: (Math.floor(cell / 7) + .5) / 7 };
    let guard = 0;
    while (r.state === "RUNNING" && Math.hypot(r.position.x - target.x, r.position.y - target.y) > .001 && guard++ < 150) advance(50, target);
  }
  if (r.state !== "COMPLETED") throw Error(`Falha no percurso ${r.label}.`);
  if (i < 3) { advance(35000); command("next"); }
}
const data = s.exportData();
data.manifest.fixture = { purpose: "automated-functional-test", clock: "accelerated", realParticipant: false, syntheticInput: true };
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(data));
console.log(JSON.stringify({ completed: data.report.analysis.quality.completed, quality: data.report.analysis.quality.status, runs: data.runs.map(r => ({ label: r.label, state: r.state, activeMs: r.active })), observations: data.report.analysis.observations.length }));
