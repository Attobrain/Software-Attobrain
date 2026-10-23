import { icon } from "./icons.js";
import { text } from "./format.js";
export function studentShell() {
  return `<div class="student-toolbar"><div class="student-brand"><img src="/assets/logotipo.png" alt=""><strong>Attobrain</strong><span>Seu espaço de atividade</span></div><button id="fullscreen" class="secondary">${icon("expand")}Tela cheia</button></div><section id="student-view" aria-label="Atividade do aluno"></section>`;
}
export function studentMessage(state) {
  if (state.closed)
    return {
      eyebrow: "ATIVIDADE FINALIZADA",
      title: "Por aqui, terminamos.",
      description: "Aguarde as orientações do profissional para continuar.",
      symbol: "check",
    };
  if (state.phase === "INTERVAL")
    return {
      eyebrow: "HORA DE UMA PAUSA",
      title: "Um momento para descansar.",
      description: "A próxima atividade começa quando o profissional orientar.",
      symbol: "pause",
    };
  if (state.state === "PAUSED")
    return {
      eyebrow: "PODE FICAR À VONTADE",
      title: "Vamos fazer uma pausa.",
      description:
        "Você pode descansar a mão. Aguarde a orientação para continuar.",
      symbol: "pause",
    };
  if (["COMPLETED", "TIMED_OUT", "ABORTED"].includes(state.state))
    return {
      eyebrow: "ETAPA FINALIZADA",
      title: "Esta etapa terminou.",
      description:
        "Aguarde as orientações do profissional para o próximo passo.",
      symbol: "check",
    };
  return {
    eyebrow: "BEM-VINDO À ATIVIDADE",
    title: "Tudo começa com um caminho.",
    description:
      "Em instantes, o profissional vai preparar sua atividade. Fique à vontade enquanto espera.",
    symbol: "arrow",
  };
}
export function renderStudent(state, previous) {
  if (
    previous?.state === state.state &&
    previous?.runId === state.runId &&
    previous?.phase === state.phase
  )
    return;
  const view = document.getElementById("student-view"),
    active = ["READY", "RUNNING"].includes(state.state);
  view.classList.toggle("is-playing", active);
  if (active) {
    view.innerHTML = `<div class="student-task-heading"><span class="task-stage" id="student-stage"></span><span class="student-state" id="student-state"></span></div><h1>Do verde ao violeta.</h1><p class="student-task-description" id="student-instruction"></p><div class="student-board-wrap"><canvas id="board" width="800" height="800" aria-label="Labirinto: mova o mouse pelos corredores do verde ao violeta"></canvas></div><div class="student-legend"><span><i class="dot start"></i>Comece aqui</span>${icon("arrow")}<span><i class="dot finish"></i>Chegue até aqui</span></div>`;
    text(
      "student-stage",
      state.label === "Treinamento"
        ? "Vamos praticar"
        : state.label === "Exploração"
          ? "Seu percurso"
          : `Atividade ${state.label}`,
    );
    text(
      "student-state",
      state.state === "RUNNING" ? "Pode começar" : "Aguarde para começar",
    );
    text(
      "student-instruction",
      state.state === "RUNNING"
        ? "Mova o mouse pelos corredores. O ponto amarelo acompanha seu movimento."
        : "Observe o caminho. O profissional vai avisar quando começar.",
    );
    if (state.state === "RUNNING") window.closeAttobrainMenu?.();
  } else {
    const message = studentMessage(state);
    view.innerHTML = `<div class="student-welcome"><div class="student-logo-halo"><img src="/assets/logotipo.png" alt="Logo oficial da Attobrain"></div><span class="eyebrow" id="student-eyebrow"></span><h1 id="student-waiting"></h1><p id="student-description"></p><div class="waiting-state">${icon(message.symbol)}<span>Aguarde as orientações do profissional</span></div><div class="student-guide"><span><b>01</b>Observe o caminho</span><span><b>02</b>Siga os corredores</span><span><b>03</b>Alcance o violeta</span></div></div>`;
    text("student-eyebrow", message.eyebrow);
    text("student-waiting", message.title);
    text("student-description", message.description);
  }
}
