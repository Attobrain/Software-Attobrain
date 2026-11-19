import { text, number, time, escape } from "./format.js";
import { summarize, liveStatus, timelineHtml, recentItems, plural } from "./distraction.js";
export const eventNames = {
  configured: "Sessão configurada",
  "draft-updated": "Configuração ajustada",
  prepared: "Percurso preparado",
  started: "Atividade iniciada",
  resumed: "Atividade retomada",
  pause: "Atividade pausada",
  contact: "Encostou na parede",
  checkpoint: "Ponto do caminho alcançado",
  "run-ended": "Etapa finalizada",
  "interval-skipped": "Intervalo antecipado para apresentação",
  "session-ended": "Sessão encerrada",
  "eeg-modulation": "Ajuste do sinal simulado",
  "engine-gap": "Falha técnica momentânea",
  "session-limit": "Limite da sessão atingido",
};
export function updateMonitor(state, events, trail = []) {
  text(
    "movement-state",
    state.state === "RUNNING"
      ? "Ao vivo"
      : state.state === "PAUSED"
        ? "Pausado"
        : ["COMPLETED", "TIMED_OUT", "ABORTED"].includes(state.state)
          ? "Finalizado"
          : "Aguardando",
  );
  document.getElementById("movement-status").dataset.state = state.state;
  const m = state.metrics,
    hasSamples = m?.activeMs > 0,
    s = hasSamples ? summarize(m) : null;
  document.getElementById("trend-empty").hidden = hasSamples;
  document.getElementById("activity-trend").hidden = !hasSamples;
  document.getElementById("distraction-empty").hidden = hasSamples;
  const chart = document.getElementById("distraction-chart");
  chart.hidden = !hasSamples;
  const shown = (value, digits) => (Number.isFinite(value) ? number(value, digits) : "—");
  const seconds = (value) => `${Math.round(value)} s`;
  // Indicadores de distração
  text("contacts", s ? (s.distractions ?? "—") : "—");
  text("low", s ? String(s.stops) : "—");
  text("low-hint", `Parado por ${state.config?.lowSeconds ?? 2} s ou mais`);
  text("recovery", s && s.recovery !== null ? `${number(s.recovery, 1)} s` : "—");
  text("recovery-hint", s && s.recoveries ? `Mediana de ${s.recoveries} retomada(s)` : "Depois de cada distração");
  text("backtracks", s ? String(s.returns) : "—");
  text("variability", s ? shown(m.velocity?.cv, 2) : "—");
  text("low-total", s ? seconds(s.stopSeconds) : "—");
  const status = liveStatus(state, trail);
  text("attention-state", status.title);
  text("attention-state-hint", status.detail);
  document.getElementById("state-tile").dataset.tone = status.tone;
  // Linha do tempo: só redesenha quando algo muda (a cada segundo ou a cada novo registro)
  if (hasSamples) {
    const key = `${m.collisionEpisodeCount}:${(m.low ?? []).length}:${Math.floor(m.activeMs / 1000)}:${state.limitMs}`;
    if (chart.dataset.key !== key) {
      chart.dataset.key = key;
      chart.innerHTML = timelineHtml(m, m.activeMs, state.limitMs);
      chart.setAttribute("aria-label", `Linha do tempo: ${plural(s.distractions ?? 0, "distração", "distrações")} e ${plural(s.stops, "momento parado", "momentos parado")} até agora`);
    }
  }
  text(
    "distraction-caption",
    hasSamples
      ? `${plural(s.distractions ?? 0, "distração", "distrações")} · ${plural(s.stops, "momento parado", "momentos parado")} (${seconds(s.stopSeconds)}) até agora.`
      : "",
  );
  document.getElementById("distraction-caption").hidden = !hasSamples;
  // Dados da atividade (contexto do jogo)
  text("speed", hasSamples ? shown(m.speed, 3) : "—");
  text("distance", hasSamples && Number.isFinite(m.distance) ? `${number(m.distance, 1)} larguras` : "—");
  text(
    "trend-caption",
    hasSamples ? "Velocidade do percurso. Pontos: distrações." : "Usa só registros da atividade atual.",
  );
  const phase = state.closed
    ? "Sessão encerrada"
    : state.phase === "INTERVAL"
      ? `Intervalo após ${state.label}`
      : state.label === "Treinamento"
        ? "Treinamento"
        : state.label === "Exploração"
          ? "Atividade única"
          : state.label
            ? `Atividade ${state.label}`
            : "Preparação da sessão";
  text("phase", phase);
  document.getElementById("status").dataset.state = state.state;
  const stages = ["Treinamento", "A", "B", "C"],
    index = stages.indexOf(state.label);
  for (const element of document.querySelectorAll("[data-stage]")) {
    const stageIndex = stages.indexOf(element.dataset.stage),
      active = stageIndex === index;
    element.classList.toggle("is-current", active);
    element.classList.toggle(
      "is-complete",
      stageIndex < index || (state.closed && index >= stageIndex),
    );
    if (active) element.setAttribute("aria-current", "step");
    else element.removeAttribute("aria-current");
  }
  const list = document.getElementById("recent-events"),
    recent = recentItems(events, m, state.runId),
    signature = recent.map((e) => e.key).join(",");
  if (list.dataset.signature !== signature) {
    list.dataset.signature = signature;
    list.innerHTML = recent.length
      ? recent
          .map(
            (e) =>
              `<li><span class="event-marker" aria-hidden="true"></span><div><strong>${escape(e.title)}</strong>${e.detail ? `<span>${escape(e.detail)}</span>` : ""}</div><time>${time(e.time)}</time></li>`,
          )
          .join("")
      : '<li class="event-empty">As distrações aparecerão aqui durante a atividade.</li>';
  }
}
let bandSignature = "";
export function updateBands(spectral) {
  const container = document.getElementById("bands"),
    key = spectral?.valid ? JSON.stringify(spectral.relative) : "empty";
  if (key === bandSignature) return;
  bandSignature = key;
  if (!spectral?.valid) {
    container.classList.add("is-empty");
    container.textContent =
      "Os valores aparecem após 8 s contínuos de sinal.";
    return;
  }
  container.classList.remove("is-empty");
  container.innerHTML = Object.entries(spectral.absolute)
    .map(
      ([band, value]) =>
        `<div class="band-tile"><span>${escape({ delta: "Delta", theta: "Theta", alpha: "Alpha", beta: "Beta", gamma: "Gamma" }[band] ?? band)}</span><strong>${number(spectral.relative[band], 1)}<small>%</small></strong><span>${number(value)} µV²</span></div>`,
    )
    .join("");
}
