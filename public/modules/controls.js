import { text, number } from "./format.js";
import { bindTimeline } from "./timeline.js";
import { mouseInput } from "./input.js";
export function bindControls({
  student,
  socket,
  command,
  credentials,
  state,
  exportData,
  message,
}) {
  let timeline;
  if (student) {
    document.getElementById("fullscreen").onclick = () =>
      document.documentElement.requestFullscreen().catch(() => {});
    mouseInput(socket, state);
  } else {
    for (const type of [
      "start",
      "pause",
      "resume",
      "abort",
      "next",
      "repeat-training",
      "end-session",
    ])
      document.getElementById(type).onclick = () => command(type);
    document.getElementById("configuration").onsubmit = (event) => {
      event.preventDefault();
      const config = Object.fromEntries(new FormData(event.target));
      for (const k of [
        "level",
        "seed",
        "trainingSeconds",
        "activitySeconds",
        "intervalSeconds",
        "channels",
        "sampleRate",
        "eegSeed",
        "speed",
        "radius",
        "wallWidth",
        "lowSpeed",
        "lowSeconds",
      ])
        config[k] = Number(config[k]);
      config.artifacts = config.artifacts === "true";
      command("prepare", { config });
    };
    const studentUrl = () =>
      `${location.origin}/aluno#id=${credentials().id}&key=${credentials().studentKey}`;
    document.getElementById("open").onclick = () =>
      window.open(
        studentUrl(),
        "attobrain-aluno",
        "popup,width=1000,height=850",
      );
    document.getElementById("copy").onclick = async () => {
      try {
        await navigator.clipboard.writeText(studentUrl());
        message(
          "Link copiado. Para outro dispositivo, use o IP do servidor no lugar de localhost.",
        );
      } catch {
        prompt(
          "Link do aluno (substitua localhost pelo IP do servidor em outro dispositivo):",
          studentUrl(),
        );
      }
    };
    document.getElementById("new-session").onclick = () => {
      if (
        confirm(
          "Os resultados são temporários. Exporte antes de criar outra sessão. Continuar?",
        )
      ) {
        sessionStorage.removeItem("atto-control");
        location.reload();
      }
    };
    document.getElementById("notes").onchange = (event) =>
      command("notes", { value: event.target.value });
    document.getElementById("export").onclick = () =>
      exportData(true).catch((error) => message(error.message));
    document.getElementById("print").onclick = () => window.print();
    timeline = bindTimeline(exportData);
    window.addEventListener("beforeunload", (event) => {
      if (state()?.unexported) {
        event.preventDefault();
        event.returnValue = "Resultados não exportados.";
      }
    });
    setInterval(() => {
      const start = performance.now();
      socket.emit("ping-clock", { clientTime: start }, (reply) => {
        text("latency", number(performance.now() - start));
        if (state()) state().latency = performance.now() - start;
      });
    }, 3000);
  }
  return timeline;
}
