"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
test("cronômetro exibe limites completos apesar da precisão de ponto flutuante", async () => {
  const { time } = await import("../../public/modules/format.js");
  assert.equal(time(74999.9999999), "01:15");
  assert.equal(time(74999), "01:14");
  assert.equal(time(null), "—");
  assert.equal(time(0), "00:00");
});
test("dashboard prioriza dados, preserva controles e mantém IDs únicos", async () => {
  const { professionalLayout } = await import("../../public/modules/layout.js");
  const html = professionalLayout();
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const id of [
    "configuration",
    "prepare",
    "open",
    "copy",
    "student-link",
    "start",
    "pause",
    "resume",
    "abort",
    "next",
    "repeat-training",
    "end-session",
    "new-session",
    "board",
    "notes",
    "export",
    "print",
    "event-select",
    "import",
    "inspect",
    "diagnostics",
    "channel",
  ])
    assert(ids.includes(id), id);
  assert(html.indexOf('id="metrics"') < html.indexOf('id="board"'));
  assert(html.indexOf('id="activity-trend"') < html.indexOf('id="board"'));
  assert(
    html.includes(
      "EEG SINTÉTICO — não representa a atividade cerebral do participante.",
    ),
  );
});
test("gráfico temporal usa distâncias reais e não conecta pausas ou lacunas", async () => {
  const { trendPoints } = await import("../../public/modules/charts.js");
  const points = trendPoints([
    { x: 0, y: 0, t: 0, segment: 0 },
    { x: 0.01, y: 0, t: 50, segment: 0 },
    { x: 0.5, y: 0, t: 100, segment: 1 },
    { x: 0.51, y: 0, t: 150, segment: 1 },
    { x: 0.52, y: 0, t: 1000, segment: 1 },
  ]);
  assert.equal(points.length, 2);
  for (const p of points) assert(Math.abs(p.speed - 0.2) < 1e-10);
  assert.deepEqual(trendPoints([]), []);
});
test("mensagens do aluno são neutras e não expõem dados profissionais", async () => {
  const { studentMessage, studentShell } = await import(
    "../../public/modules/student-view.js"
  );
  assert(studentMessage({ state: "PAUSED" }).title.includes("pausa"));
  assert(studentMessage({ disconnected: true }).title.includes("conexão"));
  assert(studentMessage({ state: "TIMED_OUT" }).title.includes("terminou"));
  assert(
    studentMessage({ state: "RUNNING", phase: "INTERVAL" }).title.includes(
      "descansar",
    ),
  );
  assert(studentMessage({ closed: true }).title.includes("terminamos"));
  const shell = studentShell();
  assert(shell.includes('id="fullscreen"'));
  assert(!/id="(metrics|eeg|results|notes)"/.test(shell));
});

 test("sons do aluno acompanham transições sem repetir snapshots ou reconexões", async () => {
  const { studentCue } = await import("../../public/modules/student-effects.js");
  const ready = { runId: "one", state: "READY" };
  const running = { ...ready, state: "RUNNING" };
  assert.equal(studentCue(running, ready), "start");
  assert.equal(studentCue(running, running), null);
  assert.equal(studentCue(running, null), null);
  assert.equal(studentCue(running, { ...ready, disconnected: true }), null);
  assert.equal(studentCue({ ...running, disconnected: true }, ready), null);
  assert.equal(studentCue({ ...running, runId: "two" }, ready), null);
  for (const [state, cue] of [["PAUSED","pause"],["COMPLETED","complete"],["TIMED_OUT","finish"],["ABORTED","finish"]]) {
    assert.equal(studentCue({ ...running, state }, running), cue);
  }
 });
