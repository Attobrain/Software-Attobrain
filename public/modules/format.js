export const text = (id, value) => {
  const element = document.getElementById(id);
  if (element && element.textContent !== String(value))
    element.textContent = value;
};
export const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const number = (value, digits = 2) =>
  Number.isFinite(value) ? value.toFixed(digits) : "Indisponível";
export const time = (ms) =>
  Number.isFinite(ms)
    ? `${Math.floor(ms / 60000)
        .toString()
        .padStart(2, "0")}:${Math.floor((ms / 1000) % 60)
        .toString()
        .padStart(2, "0")}`
    : "—";
export const labels = {
  IDLE: "Aguardando preparação",
  READY: "Pronto para começar",
  RUNNING: "Em andamento",
  PAUSED: "Atividade pausada",
  COMPLETED: "Percurso concluído",
  TIMED_OUT: "Tempo da atividade encerrado",
  ABORTED: "Atividade encerrada",
};
