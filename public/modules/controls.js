import { text, number } from "./format.js";
import { bindTimeline } from "./timeline.js";
import { mouseInput } from "./input.js";
import { printReport } from "./print-report.js";
import { readStudents } from "./students.js";
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
    ending.innerHTML = '<form method="dialog"><h2 id="termination-title">Encerrar sessão?</h2><p>Tudo o que já foi feito fica registrado. Se encerrar agora, o relatório terá apenas os resultados parciais.</p><label>Motivo<select id="termination-reason"><option value="voluntary">Decisão do profissional</option><option value="technical">Problema técnico</option></select></label><div class="controls"><button value="cancel" class="secondary">Continuar atividade</button><button type="button" class="danger" id="confirm-ending">Confirmar encerramento</button></div></form>';
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
      "skip-interval",
      "simulate-results",
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
          ["localhost", "127.0.0.1"].includes(location.hostname) ? "Link copiado. Se o aluno estiver em outro computador, troque \"localhost\" pelo endereço deste computador na rede." : "Link copiado. Envie ao aluno para abrir no computador dele.",
        );
      } catch {
        prompt(
          "Link da tela do aluno (vale só para esta sessão):",
          studentUrl(),
        );
      }
    };
    document.getElementById("new-session").onclick = () => {
      if (
        confirm(
          "A sessão atual sairá da tela. O resumo de uma sessão encerrada já fica no histórico do aluno; para guardar a cópia completa, baixe o relatório antes. Deseja continuar?",
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
    // A impressão usa uma folha própria (print-report.js), não a tela do sistema.
    document.getElementById("print").onclick = () => {
      const s = state();
      if (!s?.report) return;
      const aluno = readStudents().find(v => String(v.id) === String(s.participant?.id));
      printReport(s, aluno, document.getElementById("notes").value).catch(error => message(error.message));
    };
    timeline = bindTimeline(exportData);
    window.addEventListener("beforeunload", (event) => {
      if (state()?.unexported && state()?.runId) {
        event.preventDefault();
        event.returnValue = "Você ainda não baixou o relatório desta sessão. Deseja sair mesmo assim?";
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
