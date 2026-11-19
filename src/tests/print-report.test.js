"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");

const run = (label, count) => ({
  label, state: "COMPLETED", runId: label,
  result: { activeMs: 90000, collisionEpisodeCount: count, collisionEpisodes: [], low: [], lowMs: 0, recovery: { median: 2000, valid: 3 }, backtracks: [] },
});
const session = {
  participant: { id: "1", name: "Aluno de Teste <b>" },
  config: { mode: "protocol", level: 7 },
  endReason: "completed",
  report: { evaluations: [run("A", 6), run("B", 4), run("C", 2)], analysis: { features: [] } },
};

test("relatório impresso tem as seções e escapa o texto do aluno", async () => {
  const { reportHtml } = await import("../../public/modules/print-report.js");
  const html = reportHtml(session, { escola: "EE Teste", turma: "4º ano", dataNascimento: "2015-03-10" }, "Profissional Teste", "Boa atenção.", new Date(2026, 10, 19, 14, 30));
  for (const parte of ["Relatório de sessão", "Identificação", "1. Síntese", "2. Indicadores por atividade", "3. Momentos de maior distração", "4. Observações do profissional", "Boa atenção.", "10/03/2015", "EE Teste", "Profissional Teste"])
    assert(html.includes(parte), parte);
  assert(!html.includes("<b>"), "nome do aluno deve ser escapado");
  assert(html.includes("4 distrações a menos em C do que em A"));
});

test("impressão não compara atividades quando os labirintos não são equivalentes ou há atividade não concluída", async () => {
  const { reportHtml } = await import("../../public/modules/print-report.js");
  const naoComparavel = { ...session, report: { ...session.report, analysis: { features: [], quality: { comparable: false } } } };
  const html = reportHtml(naoComparavel, null, "", "");
  assert(html.includes("não são equivalentes"));
  assert(!html.includes("a menos em C"));
  const abortada = { ...session, report: { ...session.report, evaluations: [run("A", 6), { ...run("B", 4), state: "ABORTED" }, { ...run("C", 2), state: "ABORTED" }] } };
  assert(reportHtml(abortada, null, "", "").includes("duas ou mais atividades concluídas"));
});

test("sem observações o relatório deixa linhas para escrever à mão", async () => {
  const { reportHtml } = await import("../../public/modules/print-report.js");
  assert(reportHtml(session, null, "", "  ").includes("pr-lines"));
});
