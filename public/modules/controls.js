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
    const ending = document.createElement("dialog");
    ending.className = "termination-dialog";
    ending.setAttribute("aria-labelledby", "termination-title");
    ending.innerHTML = '<form method="dialog"><h2 id="termination-title">Encerrar sessão?</h2><p>Os registros serão preservados. Uma sessão incompleta gera somente resultados parciais.</p><label>Motivo<select id="termination-reason"><option value="voluntary">Interrupção voluntária</option><option value="technical">Falha técnica</option></select></label><div class="controls"><button value="cancel" class="secondary">Continuar atividade</button><button type="button" class="danger" id="confirm-ending">Confirmar encerramento</button></div></form>';
    document.body.append(ending);
    let endingType = null;
    document.getElementById("confirm-ending").onclick = () => {
      command(endingType, { reason: document.getElementById("termination-reason").value }).catch(() => {});
      ending.close();
    };
    for (const type of [
      "start",
      "pause",
      "resume",
      "abort",
      "next",
      "repeat-training",
      "end-session",
    ])
      document.getElementById(type).onclick = () => {
        if (["abort", "end-session"].includes(type)) {
          endingType = type;
          document.getElementById("termination-title").textContent = type === "abort" ? "Encerrar esta atividade?" : "Encerrar a sessão antecipadamente?";
          ending.showModal();
          return;
        }
        command(type, type === "end-session" ? { reason: "voluntary" } : {}).catch(() => {});
      };
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
      command("configure", { config }).catch(() => {});
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
          ["localhost", "127.0.0.1"].includes(location.hostname) ? "Link copiado. Na rede local, use o IP do servidor no lugar de localhost." : "Link copiado. Envie para o participante abrir no computador dele.",
        );
      } catch {
        prompt(
          "Link temporário do aluno:",
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
        if (state()) state().unexported = false;
        sessionStorage.removeItem("atto-control");
        sessionStorage.removeItem("atto-create");
        location.hash = "session";
        location.reload();
      }
    };
    document.getElementById("notes").onchange = (event) =>
      command("notes", { value: event.target.value }).catch(() => {});
    document.getElementById("export").onclick = async () => {
      try { await command("notes", { value: document.getElementById("notes").value }); await exportData(true); }
      catch(error) { message(error.message); }
    };
    document.getElementById("print").onclick = () => {
      let printedNotes=document.getElementById("printed-notes");
      if(!printedNotes){printedNotes=document.createElement("p");printedNotes.id="printed-notes";document.getElementById("notes").closest("label").after(printedNotes);}
      printedNotes.textContent=document.getElementById("notes").value || "Nenhuma observação manual registrada.";
      document.body.classList.toggle("include-technical", !!document.getElementById("print-technical")?.checked);
      const prior = [...document.querySelectorAll("#result-panel details")].map(el => [el, el.open]);
      if (document.body.classList.contains("include-technical")) {
        for (const [el] of prior) el.open = true;
      }
      for(const el of document.querySelectorAll(".quality-reasons")) el.open=true;
      window.addEventListener("afterprint", () => { for (const [el, open] of prior) el.open = open; document.body.classList.remove("include-technical"); }, { once: true });
      window.print();
    };
    timeline = bindTimeline(exportData);
    window.addEventListener("beforeunload", (event) => {
      if (state()?.unexported && state()?.runId) {
        event.preventDefault();
        event.returnValue = "Resultados não exportados.";
      }
    });
    setInterval(() => {
      const start = performance.now();
      if (!socket.connected) return;
      socket.emit("ping-clock", { clientTime: start }, (reply) => {
        text("latency", number(performance.now() - start));
        if (state()) state().latency = performance.now() - start;
      });
    }, 3000);
  }
  return timeline;
}
