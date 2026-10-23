import { text, number, time, escape } from "./format.js";
const eventNames = {
  configured: "Sessão configurada",
  prepared: "Percurso preparado",
  started: "Atividade iniciada",
  resumed: "Atividade retomada",
  pause: "Atividade pausada",
  contact: "Contato com parede",
  checkpoint: "Checkpoint alcançado",
  "run-ended": "Etapa finalizada",
  "session-ended": "Sessão encerrada",
  "eeg-modulation": "Modulação sintética",
  "engine-gap": "Interrupção técnica",
  "session-limit": "Limite da sessão atingido",
};
export function updateMonitor(state, events) {
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
    hasSamples = m?.activeMs > 0;
  text("speed", hasSamples ? number(m.speed, 3) : "—");
  text("low", hasSamples ? `${number(m.lowMs / 1000, 1)} s` : "—");
  text("distance", hasSamples ? `${number(m.distance, 2)} larguras` : "—");
  text("variability", hasSamples ? `CV ${number(m.velocity.cv, 2)}` : "—");
  text("backtracks", hasSamples ? String(m.backtracks.length) : "—");
  text(
    "trend-caption",
    hasSamples
      ? `Tempo ativo · velocidade em larguras/s. ${m.contacts.length} contatos registrados nesta atividade.`
      : "O gráfico aparecerá quando a atividade começar.",
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
    recent = events.slice(-5).reverse(),
    signature = recent.map((e) => e.seq).join(",");
  if (list.dataset.signature !== signature) {
    list.dataset.signature = signature;
    list.innerHTML = recent.length
      ? recent
          .map(
            (e) =>
              `<li><span class="event-marker" aria-hidden="true"></span><div><strong>${escape(eventNames[e.type] ?? "Evento da sessão")}</strong><span>${escape(e.type === "pause" ? ({ manual: "Pausa solicitada", disconnected: "Conexão interrompida", "student-hidden": "Tela do aluno oculta" }[e.data?.reason] ?? "Pausa técnica") : e.runId === state.runId ? state.label : "Sessão")}</span></div><time>${time(e.sessionTime)}</time></li>`,
          )
          .join("")
      : '<li class="event-empty">Os eventos aparecerão durante a sessão.</li>';
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
      "As bandas estarão disponíveis após oito segundos contínuos de sinal.";
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
