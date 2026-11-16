"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { resumoSessao } = require("../services/resumo-sessao");

test("resumo ignora o treino e soma só as fases A, B e C", () => {
  const session = {
    config: { level: 8 },
    endReason: "voluntary",
    notes: "Aluno estava calmo.",
    runs: [
      { label: "Treinamento", state: "COMPLETED", result: { activeMs: 99000, collisionEpisodeCount: 9 } },
      { label: "A", state: "COMPLETED", result: { activeMs: 30000, collisionEpisodeCount: 2 } },
      { label: "B", state: "ABORTED", result: { activeMs: 10400, collisionEpisodeCount: 1 } },
    ],
  };
  assert.deepEqual(resumoSessao(session), {
    nivel: "8",
    fasesConcluidas: 1,
    tempoAtivoSeg: 40,
    totalColisoes: 3,
    motivoFim: "voluntary",
    observacoes: "Aluno estava calmo.",
  });
});

test("resumo funciona com sessão vazia", () => {
  const r = resumoSessao({ runs: [] });
  assert.equal(r.fasesConcluidas, 0);
  assert.equal(r.tempoAtivoSeg, 0);
  assert.equal(r.nivel, null);
});
