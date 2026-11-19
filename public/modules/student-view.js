import { icon } from "./icons.js";
import { text } from "./format.js";
export function studentShell() {
  return `<div class="student-toolbar"><div class="student-brand"><img src="/assets/logotipo.png" alt=""><strong>Attobrain</strong><span>Seu espaço de atividade</span></div><div class="student-actions"><button id="student-sound" class="secondary" aria-pressed="false" title="Ativar ou silenciar os efeitos sonoros">${icon("sound")}<span>Ativar sons</span></button><button id="fullscreen" class="secondary">${icon("expand")}Tela cheia</button></div></div><section id="student-view" aria-label="Atividade do aluno"></section>`;
}
// Cada situação tem uma única mensagem: o título diz o que está acontecendo e a descrição diz o que fazer.
export function studentMessage(state) {
  if (state.disconnected) return {
    eyebrow: "CONEXÃO INTERROMPIDA", title: "Vamos aguardar a conexão.",
    description: "A atividade foi pausada. Avise o profissional e aguarde as orientações para continuar.", mood: "offline",
  };
  if (state.closed)
    return {
      eyebrow: "ATIVIDADE FINALIZADA",
      title: "Por aqui, terminamos.",
      description: "Você foi muito bem! Agora é só conversar com o profissional.",
      mood: "complete",
    };
  if (state.phase === "INTERVAL")
    return {
      eyebrow: "PRÓXIMA ETAPA",
      title: "A próxima atividade está chegando.",
      description: "Respire fundo e descanse os olhos. O profissional vai avisar a hora.",
      mood: "rest",
    };
  if (state.state === "PAUSED")
    return {
      eyebrow: "ATIVIDADE PAUSADA",
      title: "A atividade está pausada.",
      description: "Fique tranquilo. Quando for a hora, o profissional vai avisar.",
      mood: "rest",
    };
  if (["COMPLETED", "TIMED_OUT", "ABORTED"].includes(state.state))
    return {
      eyebrow: state.state === "COMPLETED" ? "CHEGOU AO VIOLETA" : "ETAPA FINALIZADA",
      title: "Esta etapa terminou.",
      description: state.state === "COMPLETED" ? "Muito bem! Você chegou ao final do caminho." : "Obrigado pelo esforço! Vamos ver o que vem agora.",
      mood: state.state === "COMPLETED" ? "complete" : "rest",
    };
  return {
    eyebrow: "BEM-VINDO À ATIVIDADE",
    title: "Tudo começa com um caminho.",
    description:
      "Em instantes, o profissional vai preparar sua atividade. Fique à vontade enquanto espera.",
    mood: "welcome",
  };
}
// Mascote simples feito com SVG: o rosto muda conforme o momento.
function mascot(mood) {
  const eyes = mood === "rest" ? '<path d="M38 52q6 6 12 0M70 52q6 6 12 0" fill="none" stroke="#3b2468" stroke-width="4" stroke-linecap="round"/>'
    : mood === "offline" ? '<circle cx="44" cy="52" r="5" fill="#3b2468"/><circle cx="76" cy="52" r="5" fill="#3b2468"/>'
    : '<ellipse class="mascot-eye" cx="44" cy="50" rx="6" ry="8" fill="#3b2468"/><ellipse class="mascot-eye" cx="76" cy="50" rx="6" ry="8" fill="#3b2468"/><circle cx="46" cy="47" r="2" fill="#fff"/><circle cx="78" cy="47" r="2" fill="#fff"/>';
  const mouth = mood === "complete" ? '<path d="M44 68q16 18 32 0z" fill="#3b2468"/>'
    : mood === "offline" ? '<path d="M48 76q12-8 24 0" fill="none" stroke="#3b2468" stroke-width="4" stroke-linecap="round"/>'
    : '<path d="M46 68q14 12 28 0" fill="none" stroke="#3b2468" stroke-width="4" stroke-linecap="round"/>';
  return `<svg class="mascot" viewBox="0 0 120 120" role="img" aria-label="Atto, o amigo da atividade"><ellipse cx="60" cy="108" rx="30" ry="6" fill="#6941c61f"/><path d="M60 8c30 0 52 22 52 52 0 28-20 48-52 48S8 88 8 60C8 30 30 8 60 8z" fill="#8d6cda"/><ellipse cx="38" cy="30" rx="16" ry="9" fill="#fff" opacity=".28"/><circle cx="30" cy="66" r="7" fill="#ff9fb8" opacity=".6"/><circle cx="90" cy="66" r="7" fill="#ff9fb8" opacity=".6"/>${eyes}${mouth}${mood === "rest" ? '<text class="mascot-z" x="92" y="24" font-size="18" font-weight="800" fill="#6941c6">z</text>' : ""}</svg>`;
}
// Confete só em momentos de conquista; é decoração e some sozinho.
function confetti() {
  const cores = ["#28a98c", "#f6b24a", "#8d6cda", "#ff7a9c", "#4cc3f0"];
  return `<div class="confetti" aria-hidden="true">${Array.from({ length: 28 }, (_, i) => `<i style="left:${(i * 37) % 100}%;background:${cores[i % cores.length]};animation-delay:${(i % 9) * 90}ms;--drift:${((i * 53) % 90) - 45}px"></i>`).join("")}</div>`;
}
const moods = { welcome: "welcome", rest: "rest", offline: "offline", complete: "complete" };
export function updateStudentProgress(state) {
  const fill = document.getElementById("student-progress-fill");
  if (!fill || !state.position) return;
  // O fim fica no canto inferior direito; a média de x e y mostra o quanto o ponto já avançou.
  const pct = state.state === "COMPLETED" ? 100 : Math.max(0, Math.min(98, Math.round(((state.position.x + state.position.y) / 2) * 100)));
  fill.style.width = `${pct}%`;
  document.getElementById("student-progress")?.setAttribute("aria-valuenow", String(pct));
}
export function renderStudent(state, previous) {
  updateStudentProgress(state);
  if (
    previous?.state === state.state &&
    previous?.runId === state.runId &&
    previous?.phase === state.phase && previous?.closed === state.closed && previous?.disconnected === state.disconnected
  )
    return;
  const view = document.getElementById("student-view"),
    active = !state.disconnected && ["READY", "RUNNING"].includes(state.state);
  view.classList.toggle("is-playing", active);
  const message = studentMessage(state);
  view.dataset.mood = active ? "play" : moods[message.mood] ?? "welcome";
  if (active) {
    view.innerHTML = `<div class="student-task-heading"><span class="task-stage" id="student-stage"></span><span class="student-state" id="student-state"></span></div><div class="student-title-row">${mascot("welcome")}<div><h1>Do verde ao violeta.</h1><p class="student-task-description" id="student-instruction"></p></div></div><div class="student-board-wrap"><canvas id="board" width="800" height="800" aria-label="Labirinto: guie o ponto luminoso pelos corredores do verde ao violeta"></canvas></div><div class="student-progress" id="student-progress" role="progressbar" aria-label="Seu caminho até o violeta" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="progress-start"><i class="dot start"></i>Início</span><div class="progress-track"><div id="student-progress-fill"></div></div><span class="progress-end"><i class="dot finish"></i>Chegada</span></div>`;
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
      state.state === "RUNNING" ? "Pode começar!" : "Quase na hora…",
    );
    text(
      "student-instruction",
      state.state === "RUNNING"
        ? "Guie o ponto luminoso pelos corredores até a chegada."
        : "Observe o caminho. O profissional vai avisar quando começar.",
    );
    updateStudentProgress(state);
    if (state.state === "RUNNING") window.closeAttobrainMenu?.();
  } else {
    // O passo a passo só aparece na recepção; nas demais telas uma frase basta.
    const guide = message.mood === "welcome" ? '<div class="student-guide"><span><b>01</b>Observe o caminho</span><span><b>02</b>Siga os corredores</span><span><b>03</b>Alcance o violeta</span></div>' : "";
    view.innerHTML = `<div class="student-welcome"><div class="student-orbit" aria-hidden="true"><i></i><i></i><i></i></div>${message.mood === "complete" ? confetti() : ""}<div class="student-hero">${mascot(message.mood)}${message.mood === "welcome" ? '<img class="student-maze-art" src="/assets/gaze-maze-vision.png" alt="" width="1000" height="667" fetchpriority="high">' : ""}</div><span class="eyebrow" id="student-eyebrow"></span><h1 id="student-waiting" aria-live="polite"></h1><p id="student-description"></p>${guide}</div>`;
    text("student-eyebrow", message.eyebrow);
    text("student-waiting", message.title);
    text("student-description", message.description);
  }
}
