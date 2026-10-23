"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Session } = require("../domain/session");
const { configuration } = require("../validators/config");
const { setFor, describe } = require("../domain/mazes");
const { analyze } = require("../domain/metrics");
const { consolidate } = require("../domain/report");
function fixture(config = {}) {
  const s = new Session(0);
  s.professional = "p";
  s.student = "s";
  s.prepare(config);
  return s;
}
function advance(s, milliseconds, target = null) {
  const until = s.previous + milliseconds;
  while (s.previous < until - 1e-6) {
    const now = Math.min(until, s.previous + 1000 / 60);
    if (s.current?.state === "RUNNING" && now - s.current.lastAccepted >= 50)
      s.input({
        runId: s.current.id,
        seq: s.current.lastSeq + 1,
        inside: !!target,
        hidden: false,
        clientTime: now,
        ...target,
      });
    s.tick(now);
  }
}
test("configuração rejeita valores fora de faixa, tipos e modos inexistentes", () => {
  for (const c of [
    { sampleRate: 100 },
    { channels: 9 },
    { trainingSeconds: 1 },
    { eegSeed: NaN },
    { artifacts: "true" },
    { speed: 0.8 },
    { mode: "clinical" },
  ])
    assert.throws(() => configuration(c));
  assert.equal(configuration().eegMode, "independent");
});
test("conjuntos versionados obedecem tolerâncias entre todos os pares", () => {
  for (const n of [7, 10]) {
    const set = setFor(n);
    for (const a of set.candidates) {
      assert.deepEqual(describe(n, a.seed).metadata, {
        length: a.length,
        turns: a.turns,
        deadEnds: a.deadEnds,
        cells: Math.round(a.length * n) + 1,
      });
      for (const b of set.candidates)
        for (const key of ["length", "turns", "deadEnds"])
          assert(
            Math.abs(a[key] - b[key]) / Math.min(a[key], b[key]) <=
              set.criteria[key],
          );
    }
  }
});
test("máquina de estados: treino repetível, pausas mínimas e parcial sem avaliações inventadas", () => {
  const s = fixture();
  assert.throws(() => s.execute({ type: "next" }));
  s.execute({ type: "abort" });
  s.execute({ type: "repeat-training" });
  assert.equal(s.runs.length, 2);
  s.execute({ type: "abort" });
  s.execute({ type: "next" });
  assert.equal(s.current.label, "A");
  s.execute({ type: "abort" });
  assert.throws(() => s.execute({ type: "next" }));
  s.tick(s.previous + 35000);
  s.execute({ type: "next" });
  assert.equal(s.current.label, "B");
  s.execute({ type: "end-session" });
  const report = s.report();
  assert.equal(report.training.length, 2);
  assert.equal(report.evaluations[2].state, "NOT_PERFORMED");
  assert.equal(report.comparable, false);
  assert.equal(report.aggregates.efficiency.count, 0);
});
test("relógio monotônico exclui pausas e fecha pausa aberta ao encerrar", () => {
  const s = fixture();
  s.execute({ type: "start" });
  advance(s, 1000);
  const active = s.current.active;
  s.execute({ type: "pause" });
  advance(s, 5000);
  assert.equal(s.current.active, active);
  s.execute({ type: "abort" });
  assert(Math.abs(s.current.result.pausedMs - 5000) < 1e-6);
  assert.equal(s.current.pauses[0].end, s.time);
});
test("atraso do motor pausa e gera evento técnico sem contabilizar tempo perdido", () => {
  const s = fixture();
  s.execute({ type: "start" });
  advance(s, 100);
  const active = s.current.active;
  s.tick(2000);
  assert.equal(s.current.state, "PAUSED");
  assert.equal(s.current.active, active);
  assert(s.events.some((e) => e.type === "engine-gap"));
});
test("limite encerra uma única vez e permite próxima atividade", () => {
  const s = fixture();
  s.execute({ type: "start" });
  advance(s, 76000);
  assert.equal(s.current.state, "TIMED_OUT");
  assert.equal(s.events.filter((e) => e.type === "run-ended").length, 1);
  assert(Math.abs(s.current.active - 75000) < 1e-5);
  s.execute({ type: "next" });
  assert.equal(s.current.label, "A");
});
test("entrada antiga, inválida e excessiva é descartada por execução", () => {
  const s = fixture();
  s.execute({ type: "start" });
  const data = {
    runId: s.current.id,
    seq: 1,
    inside: true,
    hidden: false,
    clientTime: 0,
    x: 0.1,
    y: 0.1,
  };
  s.input({ ...data, x: NaN });
  assert.equal(s.discarded.invalid, 1);
  s.input(data);
  s.input({ ...data, seq: 2 });
  assert.equal(s.discarded.rate, 1);
  s.execute({ type: "abort" });
  s.execute({ type: "next" });
  s.execute({ type: "start" });
  s.input({ ...data, seq: 3 });
  assert.equal(s.discarded.stale, 1);
});
test("caminho completo no motor resulta em conclusão e eficiência de grafo 100%", () => {
  const s = fixture();
  s.execute({ type: "start" });
  const r = s.current;
  for (const cell of r.path.slice(1)) {
    const target = {
      x: ((cell % r.maze.cols) + 0.5) / r.maze.cols,
      y: (Math.floor(cell / r.maze.cols) + 0.5) / r.maze.rows,
    };
    let guard = 0;
    while (
      r.state === "RUNNING" &&
      Math.hypot(r.position.x - target.x, r.position.y - target.y) > 0.001 &&
      guard++ < 100
    )
      advance(s, 50, target);
  }
  assert.equal(r.state, "COMPLETED");
  assert.equal(r.progress, 100);
  assert(Math.abs(r.result.efficiency - 100) < 1e-8);
  assert.deepEqual(r.result, analyze(r, s.config));
});
function metricRun(rows, state = "ABORTED") {
  const description = describe(7, 42);
  return {
    ...description,
    state,
    active: rows.at(-1)?.t ?? 0,
    steps: rows,
    events: [],
    pauses: [],
    sessionNow: rows.at(-1)?.t ?? 0,
    progress: 0,
    endedAt: 100,
  };
}
function stationary(duration, hits = () => []) {
  return Array.from({ length: duration / 50 }, (_, i) => ({
    x: 0.5 / 7,
    y: 0.5 / 7,
    from: { x: 0.5 / 7, y: 0.5 / 7 },
    dt: 50,
    t: (i + 1) * 50,
    sessionTime: (i + 1) * 50,
    segment: 0,
    cells: [],
    hits: hits(i),
  }));
}
test("contato contínuo conta uma vez; separação ≥200ms cria outro; recuperação censurada", () => {
  const result = analyze(
    metricRun(stationary(1500, (i) => (i < 10 || i >= 15 ? [1] : []))),
    configuration(),
  );
  assert.equal(result.contacts.length, 2);
  assert.equal(result.recovery.censored, 1);
  assert.equal(result.recovery.median, null);
});
test("baixa movimentação curta é excluída; episódio longo tem localização e duração", () => {
  assert.equal(
    analyze(metricRun(stationary(1500)), configuration()).low.length,
    0,
  );
  const m = analyze(metricRun(stationary(3000)), configuration());
  assert.equal(m.low.length, 1);
  assert.equal(m.low[0].duration, 3000);
  assert(m.low[0].dispersion < 1e-12);
});
test("sem amostras: nenhum NaN, CV e eficiência indisponíveis", () => {
  const m = analyze(metricRun([]), configuration());
  assert.equal(m.velocity.cv, null);
  assert.equal(m.efficiency, null);
  assert.equal(m.contactsPerMinute, null);
  assert(!JSON.stringify(m).includes("NaN"));
});
test("retorno conhecido no grafo calcula eficiência e excesso sem clamp", () => {
  const r = metricRun([], "COMPLETED");
  let previous = { x: 0.5 / 7, y: 0.5 / 7 };
  const cells = [...r.path.slice(1, 3), r.path[1], ...r.path.slice(2)];
  r.steps = cells.map((cell, i) => {
    const p = {
        x: ((cell % 7) + 0.5) / 7,
        y: (Math.floor(cell / 7) + 0.5) / 7,
      },
      step = {
        ...p,
        from: previous,
        dt: 1000,
        t: (i + 1) * 1000,
        sessionTime: (i + 1) * 1000,
        segment: 0,
        cells: [cell],
        hits: [],
      };
    previous = p;
    return step;
  });
  r.active = r.steps.length * 1000;
  const m = analyze(r, configuration());
  assert(Math.abs(m.excess - 2 / 7) < 1e-9);
  assert(
    Math.abs(
      m.efficiency - (100 * r.metadata.length) / (r.metadata.length + 2 / 7),
    ) < 1e-9,
  );
  assert.equal(m.backtracks.length, 1);
});
test("velocidade constante: CV zero; recuperação exige redução de distância e 500ms sem contato", () => {
  const r = metricRun(stationary(2000));
  r.steps.forEach((s, i) => {
    s.x = 0.07 + i * 0.001;
    s.from.x = s.x - 0.001;
  });
  const m = analyze(r, configuration());
  assert(m.velocity.cv < 1e-10);
  const recovery = metricRun(stationary(1000, (i) => (i === 0 ? [1] : [])));
  const cell = recovery.path[1];
  recovery.steps.at(-1).cells = [cell];
  const result = analyze(recovery, configuration());
  assert.equal(result.recovery.valid, 1);
  assert.equal(result.recovery.median, 950);
});
test("pausa interrompe episódios e não conecta trajetória nem recuperação", () => {
  const rows = stationary(5000, (i) => (i === 0 ? [1] : []));
  for (let i = 50; i < rows.length; i++) rows[i].segment = 1;
  const result = analyze(metricRun(rows), configuration());
  assert.equal(result.low.length, 2);
  assert.equal(result.recoveries[0].reason, "interruption");
});
test("resumos auditáveis exigem três conclusões e excluem treino", () => {
  const make = (label, contacts, efficiency) => ({
    id: label,
    label,
    state: "COMPLETED",
    result: {
      contactsPerMinute: contacts,
      efficiency,
      speed: 0.1,
      activeMs: 20000,
      low: [],
      lowMs: 0,
      thirds: [{ eligible: false }, {}, { eligible: false }],
    },
  });
  const runs = [
    make("Treinamento", 100, 1),
    make("A", 10, 70),
    make("B", 8, 80),
    make("C", 5, 90),
  ];
  const report = consolidate(runs, configuration(), "set");
  assert.equal(report.aggregates.efficiency.median, 80);
  assert(report.rules.find((r) => r.ruleId === "contacts-down"));
  assert(report.rules.find((r) => r.ruleId === "efficiency-up"));
  assert.equal(
    consolidate(runs.slice(0, 3), configuration(), "set").rules.length,
    0,
  );
});
test("separação de papéis: aluno nunca recebe notas, EEG, eventos ou resultados", () => {
  const s = fixture();
  s.notes = "privado";
  const view = s.view("student", true);
  for (const key of [
    "notes",
    "events",
    "config",
    "eeg",
    "metrics",
    "report",
    "studentKey",
    "professionalKey",
  ])
    assert.equal(view[key], undefined);
  const json = JSON.stringify(s.exportData());
  assert(!json.includes(s.professionalKey));
  assert(!json.includes(s.studentKey));
});
test("limite total 30 minutos fecha sessão parcial", () => {
  const s = fixture();
  s.tick(1800001);
  assert.equal(s.closed, true);
  assert.equal(s.current.state, "ABORTED");
});
test("protocolo completo treino/A/B/C congela resultados; exportação permite recálculo exato", () => {
  const s = fixture();
  for (let round = 0; round < 4; round++) {
    s.execute({ type: "start" });
    const r = s.current;
    for (const cell of r.path.slice(1)) {
      const target = {
        x: ((cell % 7) + 0.5) / 7,
        y: (Math.floor(cell / 7) + 0.5) / 7,
      };
      let guard = 0;
      while (
        r.state === "RUNNING" &&
        Math.hypot(r.position.x - target.x, r.position.y - target.y) > 0.001 &&
        guard++ < 150
      )
        advance(s, 50, target);
    }
    assert.equal(r.state, "COMPLETED");
    const frozen = JSON.stringify(r.result);
    advance(s, 35000);
    assert.equal(JSON.stringify(r.result), frozen);
    if (round < 3) s.execute({ type: "next" });
  }
  assert.equal(s.phase, "FINISHED");
  assert.equal(s.report().comparable, true);
  assert.equal(s.report().aggregates.efficiency.count, 3);
  const data = JSON.parse(JSON.stringify(s.exportData()));
  for (const run of data.runs) {
    run.distances = describe(run.maze.cols, run.seed).distances;
    assert.deepEqual(analyze(run, data.manifest.config), run.result);
  }
});
module.exports = { fixture, advance };
