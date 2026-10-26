"use strict";
const { statistics } = require("../metrics");
const { POLICY } = require("./policy");
/** @returns {{coverage: number|null, windows: number[], thirds: number[], thirdWindows: number[][], validMs: number, validDistance: number}} */
function movementSupport(run) {
  let validMs = 0, validDistance = 0, elapsed = 0, distance = 0, segment = null;
  const windows = [], thirds = [0, 0, 0], thirdWindows = [[], [], []];
  const measured = run.steps.some(s => typeof s.validInput === "boolean");
  for (const s of run.steps) {
    if (s.segment !== segment || s.validInput !== true) {
      elapsed = 0; distance = 0; segment = s.segment;
    }
    if (s.validInput !== true) continue;
    validMs += s.dt;
    for (let i = 0; i < 3; i++) {
      const start = run.active * i / 3, end = run.active * (i + 1) / 3;
      thirds[i] += Math.max(0, Math.min(s.t, end) - Math.max(s.t - s.dt, start));
    }
    elapsed += s.dt;
    const movement = Math.hypot(s.x - s.from.x, s.y - s.from.y);
    distance += movement;
    validDistance += movement;
    if (elapsed >= 500 - 1e-6) {
      const speed = distance / (elapsed / 1000), index = Math.min(2, Math.floor((s.t - 1e-6) / run.active * 3));
      windows.push(speed);
      if (s.t - elapsed >= run.active * index / 3 - 1e-6) thirdWindows[index].push(speed);
      elapsed = 0; distance = 0;
    }
  }
  return { coverage: measured && run.active > 0 ? Math.min(1, validMs / run.active) : null, validMs, validDistance, windows, thirds, thirdWindows };
}
function features(run) {
  const m = run.result, support = movementSupport(run), seconds = run.active / 1000;
  const known = support.coverage !== null, covered = known && support.coverage >= POLICY.coverage - 1e-8;
  const enough = run.active >= POLICY.minActiveMs - 1e-6;
  const episodes = m.collisionEpisodes;
  const contactValue = run.steps.length && Number.isInteger(m.collisionEpisodeCount) ? m.collisionEpisodeCount : null;
  function f(id, name, value, unit, definition, minimum = true, reason = null, count = null, version = "3.0") {
    const finite = Number.isFinite(value);
    const eligibility = !finite ? "unavailable" : !minimum ? "insufficient" : !covered ? "limited" : "eligible";
    return { id, name, value: finite ? value : null, unit, definition, definitionVersion: version, source: "mouse/accepted-indicator", supportCount: count, eligibility,
      reason: !finite ? reason ?? "Fonte ausente ou cálculo indefinido." : !minimum ? reason : !known ? "Cobertura de entrada desconhecida." : !covered ? "Menos de 80% de cobertura válida." : null,
      limitations: ["Critério operacional de engenharia, sem validação clínica."] };
  }
  const cv = statistics(support.windows).cv;
  const completed = run.state === "COMPLETED";
  const cells = new Map();
  for (const episode of episodes ?? []) {
    const item = cells.get(episode.cell) ?? { cell: episode.cell, count: 0, position: episode.position, episodeIds: [] };
    item.count++; item.episodeIds.push(episode.id); cells.set(episode.cell, item);
  }
  return {
    runId: run.id, label: run.label, state: run.state, seconds,
    spatialEpisodes: [...cells.values()].sort((a,b) => b.count - a.count || a.cell - b.cell),
    quality: { coverage: support.coverage, validMs: support.validMs, windows: support.windows.length, thirdsValidMs: support.thirds, thirdsCv: support.thirdWindows.map(v => statistics(v).cv), temporalEligible: covered && run.active >= POLICY.thirdsMs - 1e-6 && support.thirds.every(v => v >= POLICY.thirdValidMs - 1e-6) },
    metrics: {
      contacts: f("collisionEpisodeCount", "Episódios de contato", contactValue, "episódios", "Contato agrupado até recuperação, interrupção ou fim; inclui episódios censurados.", true, "Episódios não disponíveis nesta definição.", contactValue),
      wallContacts: f("wallContactCount", "Registros por parede", m.wallContactCount, "registros", "Contatos por superfície com separação mínima de 200 ms.", true, null, m.wallContactCount),
      collisionEvents: f("collisionEventCount", "Eventos de colisão", m.collisionEventCount, "eventos", "Eventos únicos por execução e sequência; podem envolver várias paredes.", true, null, m.collisionEventCount),
      duration: f("activeDuration", "Tempo ativo", seconds, "s", "Tempo de motor em execução, excluindo pausas."),
      efficiency: f("graphEfficiency", "Eficiência da rota no grafo", m.efficiency, "%", "100 × distância de referência / distância percorrida no grafo. Não mede ausência de contatos nem precisão lateral.", completed, "Exige percurso concluído e distância válida no grafo."),
      excess: f("graphExcess", "Distância excedente no grafo", m.excess, "larguras", "Distância percorrida no grafo menos referência.", completed, "Exige conclusão."),
      backtracks: f("backtrackCount", "Retrocessos", m.backtracks?.length, "intervalos", "Intervalos de transições de células no sentido de maior distância ao objetivo."),
      speed: f("validInputSpeed", "Velocidade média válida", support.validMs > 0 ? support.validDistance / (support.validMs / 1000) : null, "larguras/s", "Distância aceita em passos válidos / duração válida.", enough, "Exige 30 s ativos, 80% de cobertura e entrada válida.", support.windows.length),
      cv: f("smoothedSpeedCv", "CV suavizado de 500 ms", cv, "razão", "Desvio padrão / média das velocidades em janelas válidas de 500 ms.", enough && support.windows.length >= POLICY.minWindows, "Exige 30 s ativos, 80% de cobertura, 40 janelas de 500 ms e média não nula.", support.windows.length, "smoothed-500ms-v2"),
      low: f("lowMovementSeconds", "Baixa movimentação", m.lowMs / 1000, "s", "Soma dos intervalos de baixa movimentação em segmentos válidos.", enough, "Exige 30 s ativos e 80% de cobertura válida."),
      contactsPerMinute: f("episodeRate", "Taxa de episódios", m.episodeRate, "episódios/min", "Episódios / minutos ativos.", run.active >= POLICY.rateMs - 1e-6, "Exige 60 s ativos e 80% de cobertura válida.", contactValue),
      recovery: f("recoveryMedian", "Recuperação mediana", m.recovery.median == null ? null : m.recovery.median / 1000, "s", "Mediana de episódios completos; censurados excluídos.", m.recovery.valid >= POLICY.recoveries, "Exige três recuperações completas.", m.recovery.valid),
      contactDensity: f("episodeDensity", "Densidade de episódios", contactValue !== null && m.reference > 0 ? 10 * contactValue / (m.reference * run.maze.cols) : null, "episódios/10 larguras de corredor", "10 × episódios / (referência em larguras do quadro × colunas).", completed, "Exige conclusão e referência geométrica.", contactValue),
    },
  };
}
module.exports = { features, movementSupport };
