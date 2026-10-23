"use strict";
const { features } = require("./features");
const { observations, POLICY } = require("./rules");
function interpretation(runs, config, setId) {
  const selected = runs.filter(r => r.label !== "Treinamento" && r.result && r.startedAt !== null);
  const fs = selected.map(features);
  const evaluations = selected.filter(r => ["A", "B", "C"].includes(r.label));
  const signature = r => {
    const value = r.executionConfig ?? config;
    return JSON.stringify(["mode", "level", "speed", "radius", "wallWidth", "lowSpeed", "lowSeconds", "activitySeconds"].map(key => value[key]));
  };
  const comparable = config.mode === "protocol" && !!setId && evaluations.length >= 2 && evaluations.every(r => r.setId === undefined || r.setId === setId) && evaluations.every(r => signature(r) === signature(evaluations[0]));
  const countRuns = config.mode === "single" ? selected : evaluations;
  const complete = countRuns.filter(r => r.state === "COMPLETED").length;
  const available = fs.filter(f => f.state === "COMPLETED" && f.quality.coverage !== null && f.quality.coverage >= .8 && f.seconds >= 30).length;
  const obs = observations(fs, selected, comparable);
  return {
    schemaVersion: "attobrain-interpretation-1.0", policy: POLICY,
    quality: { status: (comparable && complete === 3 && available === 3) || (config.mode === "single" && complete === 1 && available === 1) ? "sufficient" : fs.length ? "limited" : "insufficient", performed: countRuns.length, completed: complete, expected: config.mode === "single" ? 1 : 3, comparable, coverageKnown: fs.length > 0 && fs.every(f => f.quality.coverage !== null), clinicalInference: "not_available" },
    features: fs, observations: obs,
    summary: [...obs.filter(o => o.ruleId === "speed-control"), ...obs.filter(o => o.ruleId.startsWith("trend-")), ...obs.filter(o => o.ruleId === "observed-contacts")].slice(0, 3).map(o => o.id),
    limitations: ["Dados desta sessão; critérios de engenharia, sem validação clínica ou comparação normativa.", "Treinamento excluído da interpretação e das comparações.", "Mouse é um controle de entrada, não rastreamento ocular.", "EEG sintético não representa a fisiologia do participante e não participa desta análise.", ...(complete < 3 && config.mode === "protocol" ? ["Protocolo incompleto: tendência A/B/C indisponível para atividades ausentes ou não concluídas."] : []), ...(!comparable ? ["Comparação de geometrias indisponível."] : [])],
    provenance: { input: "mouse", eeg: { source: "synthetic", participantPhysiology: false, interpretationEligible: false } },
  };
}
module.exports = { interpretation };
