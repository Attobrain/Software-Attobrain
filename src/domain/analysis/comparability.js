"use strict";
const { describe, setFor } = require("../mazes");
function comparability(runs, config, setId) {
  const set = setFor(config.level), reasons = [];
  const evaluations = runs.filter(r => ["A", "B", "C"].includes(r.label));
  if (config.mode !== "protocol") reasons.push("Atividade única: comparação A/B/C indisponível.");
  if (!set || set.id !== setId || !set.version) reasons.push("Conjunto e versão geométrica não confirmados.");
  const signature = r => JSON.stringify(["mode", "level", "speed", "radius", "wallWidth", "lowSpeed", "lowSeconds", "activitySeconds"].map(k => r.executionConfig?.[k]));
  if (evaluations.length < 2) reasons.push("São necessárias duas atividades para comparação.");
  if (evaluations.filter(r=>r.state==="COMPLETED").length<2) reasons.push("São necessárias duas atividades concluídas para comparação de desempenho.");
  for (const r of evaluations) {
    const candidate = set?.candidates[["A", "B", "C"].indexOf(r.label)];
    if (!r.executionConfig || r.setId !== setId || !candidate || r.seed !== candidate.seed) { reasons.push(`${r.label}: identificação ou semente do conjunto incompatível.`); continue; }
    const expected = describe(config.level, candidate.seed);
    if (JSON.stringify(r.maze) !== JSON.stringify(expected.maze) || JSON.stringify(r.walls) !== JSON.stringify(expected.walls) || JSON.stringify(r.metadata)!==JSON.stringify(expected.metadata)) reasons.push(`${r.label}: geometria não confere com o conjunto versionado.`);
    if (signature(r) !== signature(evaluations[0]) || signature(r)!==signature({executionConfig:config})) reasons.push(`${r.label}: parâmetros de execução incompatíveis.`);
  }
  return { eligible: reasons.length === 0, setId, setVersion: set?.version ?? null, reasons, regional: { eligibility: "unavailable", reason: "Não há mapeamento validado entre regiões dos labirintos A/B/C." } };
}
module.exports = { comparability };
