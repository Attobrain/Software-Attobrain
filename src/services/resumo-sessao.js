"use strict";
// Resume uma sessão encerrada em poucos números simples para salvar no banco.
function resumoSessao(session) {
  const fases = (session.runs ?? []).filter((run) => run.label !== "Treinamento");
  let faseConcluidas = 0;
  let tempoMs = 0;
  let colisoes = 0;
  for (const fase of fases) {
    if (fase.state === "COMPLETED") faseConcluidas++;
    tempoMs += fase.result?.activeMs ?? 0;
    colisoes += fase.result?.collisionEpisodeCount ?? 0;
  }
  return {
    nivel: session.config?.level ? String(session.config.level) : null,
    fasesConcluidas: faseConcluidas,
    tempoAtivoSeg: Math.round(tempoMs / 1000),
    totalColisoes: colisoes,
    motivoFim: session.endReason ?? null,
    observacoes: session.notes ? String(session.notes).slice(0, 4000) : null,
  };
}
module.exports = { resumoSessao };
