"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { Session } = require("../domain/session");
const { workflow, preview } = require("../domain/workflow");
const { SessionRepository } = require("../repositories/sessions");
const { interpretation } = require("../domain/analysis/report");
const { features } = require("../domain/analysis/features");
const { describe, setFor } = require("../domain/mazes");
const { configuration } = require("../validators/config");

function guided() {
  const s = new Session(0); s.guided = true; s.professional = "p";
  return s;
}
const execute = (s, type, extra = {}) => s.execute({ type, expectedRevision: s.controlRevision, ...extra });
function configure(s, config = {}) {
  execute(s, "select-participant", { participant: { id: "demo", name: "Participante demonstrativo", unwanted: "discard" } });
  execute(s, "configure", { config });
}
function ready(s) { s.student = "s"; s.presence = { visible: true, at: s.time }; }
function advance(s, duration, target) {
  const end = s.previous + duration;
  while (s.previous < end - 1e-6) {
    const now = Math.min(end, s.previous + 1000 / 60);
    ready(s);
    if (s.current?.state === "RUNNING" && now - s.current.lastAccepted >= 50) s.input({ runId: s.current.id, seq: s.current.lastSeq + 1, inside: !!target, hidden: false, clientTime: now, ...target });
    s.tick(now);
  }
}
function sample(label, seconds = 60, count = 5, efficiency = 80, speed = .1, coverage = 1) {
  const maze = describe(7, setFor(7).candidates[["A", "B", "C"].indexOf(label) < 0 ? 0 : ["A", "B", "C"].indexOf(label)].seed);
  const steps = Array.from({ length: seconds * 20 }, (_, i) => ({ x: .05 + speed * .05, y: .05, from: { x: .05, y: .05 }, dt: 50, t: (i + 1) * 50, segment: 0, validInput: i < Math.round(seconds * 20 * coverage) }));
  return { ...maze, id: label, label, state: "COMPLETED", active: seconds * 1000, startedAt: 0, endedAt: seconds * 1000, steps, events: [], executionConfig: configuration(), setId: setFor(7).id, result: { contacts: Array.from({ length: count }, () => ({})), efficiency, reference: maze.metadata.length, speed, lowMs: 0, low: [], recovery: { median: 1000, valid: 3, censored: 0 }, contactsPerMinute: count / (seconds / 60) } };
}

test("preparação guiada exige aluno e revisão, não cria tentativas nem coleta", () => {
  const s = guided();
  assert.throws(() => execute(s, "configure", { config: {} }));
  assert.throws(() => execute(s, "select-participant", { participant: { id: "bad", name: "" } }));
  assert.throws(() => execute(s, "prepare", { config: {} }));
  configure(s);
  assert.deepEqual(s.participant, { id: "demo", name: "Participante demonstrativo", demonstration: true });
  assert.equal(s.draftStep, "review"); assert.equal(s.runs.length, 0); assert.equal(s.eeg.samples, 0);
  assert.equal(s.preview.length, 4);
  assert.deepEqual(s.preview[0], preview(s.config)[0]);
  assert.throws(() => execute(s, "begin"));
  ready(s); execute(s, "begin");
  assert.equal(s.current.state, "READY");
  assert.deepEqual(s.preview[0].maze, s.current.maze);
  assert.throws(() => execute(s, "configure", { config: {} }));
  assert.throws(() => execute(s, "back", { step: "participant" }));
});
test("revisão de controle rejeita comandos antigos independentemente das amostras", () => {
  const s = guided(); configure(s); ready(s); execute(s, "begin");
  const revision = s.controlRevision;
  execute(s, "start"); advance(s, 1000, { x: .05, y: .05 });
  assert.throws(() => s.execute({ type: "pause", expectedRevision: revision }));
  const current = s.controlRevision;
  advance(s, 500, { x: .05, y: .05 });
  assert.equal(current, s.controlRevision);
  execute(s, "pause"); assert.equal(s.current.state, "PAUSED");
});
test("visibilidade recente é necessária antes de iniciar ou retomar", () => {
  const s = guided(); configure(s); ready(s); s.presence.visible = false;
  assert.equal(workflow(s).actions.begin, false); assert.throws(() => execute(s, "begin"));
  ready(s); execute(s, "begin"); s.time = 6000;
  assert.throws(() => execute(s, "start"));
  ready(s); execute(s, "start"); s.pause("student-hidden"); s.presence.visible = false;
  assert.throws(() => execute(s, "resume"));
  ready(s); execute(s, "resume"); assert.equal(s.current.state, "RUNNING");
});
test("criação idempotente mantém a mesma sessão e remove índice ao expirar", () => {
  const repo = new SessionRepository(), token = randomUUID();
  const a = repo.create(0, token, true), b = repo.create(1, token, true);
  assert.equal(a, b); assert.equal(repo.sessions.size, 1);
  assert.throws(() => repo.create(1, "invalid", true));
  repo.sweep(1800001); assert.equal(repo.creations.size, 0);
});
test("retorno antes do início, resultado parcial e limite total preservam o estado", () => {
  const s = guided(); configure(s); execute(s, "back", { step: "configuration" });
  assert.equal(s.draftStep, "configuration");
  execute(s, "configure", { config: {} }); ready(s); execute(s, "begin");
  execute(s, "end-session", { reason: "technical" });
  assert.equal(s.endReason, "technical"); assert.equal(workflow(s).step, "results");
  assert.equal(s.current.endReason, "technical");
  assert.equal(s.exportData().runs[0].endReason, "technical");
  assert.equal(s.report().analysis.quality.completed, 0);
  assert.throws(() => execute(s, "repeat-training"));
  const limited = guided(); limited.tick(1800001);
  assert.equal(limited.closed, true); assert.equal(limited.endReason, "session-limit");
});
test("protocolo guiado completo preserva tentativas e reproduz interpretação da exportação v3", () => {
  const s = guided(); configure(s); ready(s); execute(s, "begin");
  for (let round = 0; round < 4; round++) {
    ready(s); execute(s, "start");
    const r = s.current;
    for (const cell of r.path.slice(1)) {
      const target = { x: ((cell % 7) + .5) / 7, y: (Math.floor(cell / 7) + .5) / 7 };
      let guard = 0;
      while (r.state === "RUNNING" && Math.hypot(r.position.x - target.x, r.position.y - target.y) > .001 && guard++ < 150) advance(s, 50, target);
    }
    assert.equal(r.state, "COMPLETED");
    if (round < 3) { advance(s, 35000); execute(s, "next"); }
  }
  assert.equal(workflow(s).step, "results");
  const data = JSON.parse(JSON.stringify(s.exportData()));
  assert.equal(data.schemaVersion, 3);
  assert.deepEqual(interpretation(data.runs, data.manifest.config, data.manifest.set.id), data.report.analysis);
  assert.equal(s.report(), s.report());
  for (const key of ["workflow", "participant", "presence", "report", "notes"]) assert.equal(s.view("student", true)[key], undefined);
});
for (const seconds of [12, 29, 30, 44, 45, 59, 60]) test(`elegibilidade respeita limite de ${seconds} s`, () => {
  const f = features(sample("A", seconds));
  assert.equal(f.metrics.speed.eligibility, seconds >= 30 ? "eligible" : "limited");
  assert.equal(f.metrics.contactsPerMinute.eligibility, seconds >= 60 ? "eligible" : "limited");
  assert.equal(f.quality.temporalEligible, seconds >= 45);
});
test("cobertura: parada dentro é válida, fora não é dado de baixa movimentação", () => {
  assert.equal(features(sample("A", 30, 0, 80, 0, .8)).metrics.speed.eligibility, "eligible");
  assert.equal(features(sample("A", 30, 0, 80, .1, .79)).metrics.speed.eligibility, "limited");
  const old = sample("A"); old.steps.forEach(s => delete s.validInput);
  assert.equal(features(old).quality.coverage, null);
  assert.equal(features(old).metrics.cv.eligibility, "limited");
});
test("recuperações insuficientes e velocidade zero não produzem zeros artificiais", () => {
  const r = sample("A", 60, 0, 80, 0); r.result.recovery.valid = 1; r.result.recovery.median = null;
  assert.equal(features(r).metrics.recovery.value, null);
  assert.equal(features(r).metrics.cv.value, null);
  assert.equal(features(r).metrics.contactDensity.value, 0);
});
test("regras detectam direção, estabilidade, oscilação e conflitos sem linguagem clínica", () => {
  const report = runs => interpretation(runs, configuration(), setFor(7).id);
  const down = report([sample("A",60,9,70,.1),sample("B",60,6,80,.12),sample("C",60,4,90,.15)]);
  assert(down.observations.some(o => o.ruleId === "trend-contacts" && o.statement.includes("diminuiu")));
  assert.equal(down.observations.find(o => o.ruleId === "trend-contacts").statement, "O número de contatos diminuiu progressivamente entre A, B e C.");
  const oscillation = report([sample("A",60,4),sample("B",60,10),sample("C",60,3)]);
  assert(oscillation.observations.some(o => o.ruleId === "trend-contacts" && o.statement.includes("oscilou")));
  const stable = report([sample("A"),sample("B"),sample("C")]);
  assert(stable.observations.some(o => o.statement.includes("semelhante")));
  const conflict = report([sample("A",60,4,86,.1),sample("B",60,8,77,.15),sample("C",60,13,68,.2)]);
  assert(conflict.observations.some(o => o.ruleId === "speed-control"));
  for (const o of [...down.observations, ...conflict.observations]) {
    assert(o.ruleId && o.ruleVersion && o.evidence.length && o.criteria);
    assert(!/TDAH|diagnóstico|impulsiv|desatent|atenção melhorou/i.test(o.statement));
  }
  const short = report([sample("A",12),sample("B",12),sample("C",12)]);
  assert(!short.observations.some(o => o.ruleId.startsWith("trend-")));
  const mismatch = [sample("A"),sample("B"),sample("C")]; mismatch[2].executionConfig = configuration({ speed: .3 });
  assert(!report(mismatch).observations.some(o => o.ruleId.startsWith("pair-") || o.ruleId.startsWith("trend-")));
});
test("EEG é excluído das conclusões e densidade usa percurso de referência", () => {
  const runs = [sample("A"),sample("B"),sample("C")];
  const original = interpretation(runs, configuration(), setFor(7).id);
  runs[0].eeg = { alpha: 999 };
  runs[0].executionConfig = configuration({ eegMode: "interactive", eegSeed: 20, sampleRate: 500 });
  assert.deepEqual(interpretation(runs, configuration(), setFor(7).id), original);
  assert.equal(original.features[0].metrics.contactDensity.value, 50 / (runs[0].metadata.length * 7));
  assert.equal(original.provenance.eeg.interpretationEligible, false);
});
