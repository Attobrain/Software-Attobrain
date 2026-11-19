"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Session } = require("../domain/session");
const { resumoSessao } = require("../services/resumo-sessao");

function sessaoComTreino() {
  const s = new Session(0);
  s.guided = true;
  s.professional = "p";
  const executar = (type, extra = {}) => s.execute({ type, expectedRevision: s.controlRevision, ...extra });
  executar("select-participant", { participant: { id: "1", name: "Aluno de teste" } });
  executar("configure", { config: {} });
  s.student = "s";
  s.presence = { visible: true, at: s.time };
  executar("begin");
  executar("abort", { reason: "voluntary" }); // treino encerrado
  return { s, executar };
}

test("simular resultados cria A, B e C concluídas e fecha a sessão", () => {
  const { s, executar } = sessaoComTreino();
  executar("simulate-results");
  assert.deepEqual(s.runs.map((r) => r.label), ["Treinamento", "A", "B", "C"]);
  assert.ok(s.runs.slice(1).every((r) => r.state === "COMPLETED" && r.result && r.active > 0));
  assert.equal(s.closed, true);
  assert.equal(s.simulated, true);
  assert.ok(s.report().evaluations.length > 0);
  const resumo = resumoSessao(s);
  assert.equal(resumo.fasesConcluidas, 3);
  assert.match(resumo.observacoes, /simulados/);
});

test("simular resultados só vale logo após o treino", () => {
  const { s, executar } = sessaoComTreino();
  executar("simulate-results");
  assert.throws(() => executar("simulate-results"));
  const novo = new Session(0);
  assert.throws(() => novo.execute({ type: "simulate-results", expectedRevision: 0 }));
});
