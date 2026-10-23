import { professionalLayout } from "./public/modules/layout.js";
import { text, number, time, labels } from "./public/modules/format.js";
import { drawBoard } from "./public/modules/board.js";
import { waveform, spectrum, comparison } from "./public/modules/charts.js";
import { metricDetails, renderReport } from "./public/modules/results.js";
import { bindControls } from "./public/modules/controls.js";
const student = location.pathname === "/aluno",
  root = document.getElementById("root"),
  socket = io();
// A reused student window must re-associate when a new session link changes its fragment.
if (student) window.addEventListener("hashchange", () => location.reload());
let credentials,
  state = null,
  trail = [],
  events = [],
  results = [],
  eegChannels = [],
  spectrumData = null,
  lastRender = 0,
  lastReport = "",
  timeline;
try {
  credentials = student
    ? Object.fromEntries(new URLSearchParams(location.hash.slice(1)))
    : JSON.parse(sessionStorage.getItem("atto-control") || "null");
} catch {
  credentials = null;
}
root.innerHTML = student
  ? '<button id="fullscreen">Tela cheia</button><section id="student-view"></section>'
  : professionalLayout();
const message = (value) => {
  if (student) {
    const p = document.createElement("p");
    p.textContent = value;
    root.append(p);
  } else text("message", value);
};
socket.on("connect", () =>
  socket.emit(
    "join",
    credentials?.id && credentials?.key
      ? { id: credentials.id, key: credentials.key }
      : { create: !student },
    (reply) => {
      if (reply.error) {
        message(reply.error);
        if (!student) {
          sessionStorage.removeItem("atto-control");
          const button = document.createElement("button");
          button.textContent = "Criar nova sessão";
          button.onclick = () => location.reload();
          root.prepend(button);
        }
        return;
      }
      credentials = reply;
      if (!student) {
        sessionStorage.setItem("atto-control", JSON.stringify(reply));
        document.getElementById("student-link").href =
          `${location.origin}/aluno#id=${reply.id}&key=${reply.studentKey}`;
      }
    },
  ),
);
socket.on("disconnect", () =>
  text("connection", "Sem conexão · atividade interrompida"),
);
function command(type, extra = {}) {
  socket
    .timeout(5000)
    .emit(
      "command",
      { id: credentials?.id, commandId: crypto.randomUUID(), type, ...extra },
      (error, reply) =>
        message(
          error
            ? "Sem confirmação. Confira a conexão antes de continuar."
            : (reply.error ?? ""),
        ),
    );
}
async function exportData(download, instant = 0) {
  if (!credentials) throw Error("Conecte a sessão.");
  const response = await fetch(
    `/api/sessions/${credentials.id}/${download ? "export" : `inspect?time=${Number(instant)}`}`,
    {
      headers: {
        Authorization: `Bearer ${credentials.key}`,
        ...(download ? { "X-Attobrain-Export": "true" } : {}),
      },
    },
  );
  if (!response.ok) throw Error("Não foi possível exportar a sessão.");
  if (download) {
    const url = URL.createObjectURL(await response.blob()),
      a = document.createElement("a");
    a.href = url;
    a.download = `attobrain-${credentials.id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message("JSON exportado. Novos registros exigem nova exportação.");
    return null;
  }
  return response.json();
}
timeline = bindControls({
  student,
  socket,
  command,
  credentials: () => credentials,
  state: () => state,
  exportData,
  message,
});
function studentView(previous) {
  if (
    previous?.state === state.state &&
    previous?.runId === state.runId &&
    previous?.phase === state.phase
  )
    return;
  const view = document.getElementById("student-view");
  if (["READY", "RUNNING"].includes(state.state)) {
    view.innerHTML =
      '<h2 id="student-instruction"></h2><canvas id="board" width="800" height="800" aria-label="Labirinto: mova o mouse pelos corredores do verde ao violeta"></canvas><p>Mova o mouse pelos corredores, do verde ao violeta.</p>';
    text("student-instruction", `${state.label} · ${labels[state.state]}`);
    if (state.state === "RUNNING") window.closeAttobrainMenu?.();
  } else {
    view.innerHTML =
      '<div class="waiting"><img src="/assets/logotipo.png" alt="Attobrain"><h1 id="student-waiting"></h1><p>Aguarde as orientações do profissional.</p></div>';
    text(
      "student-waiting",
      state.phase === "INTERVAL"
        ? "Intervalo"
        : state.state === "PAUSED"
          ? "Atividade pausada"
          : state.closed
            ? "Sessão encerrada"
            : labels[state.state],
    );
  }
}
socket.on("snapshot", (incoming) => {
  const previous = state;
  state = { ...state, ...incoming };
  if (incoming.full) {
    trail = incoming.trajectory ?? [];
    events = incoming.events ?? [];
    results = incoming.results ?? [];
  } else {
    if (previous?.runId !== incoming.runId) trail = [];
    trail.push(...(incoming.trajectory ?? []));
    events.push(...(incoming.events ?? []));
  }
  text(
    "connection",
    `${state.connected.student ? "Aluno conectado" : "Aguardando aluno"} · ${state.connected.professional ? "Profissional conectado" : "Profissional desconectado"}`,
  );
  if (student) {
    studentView(previous);
    return;
  }
  text("phase", `${state.label || "Preparação"} · ${state.phase}`);
  text("status", labels[state.state]);
  text(
    "interval",
    state.intervalRemaining > 0
      ? `Pausa mínima: ${Math.ceil(state.intervalRemaining / 1000)} s`
      : "",
  );
  text("active", `${time(state.active)} / ${time(state.limitMs)}`);
  text("progress", `${state.metrics?.progress ?? 0}%`);
  text("contacts", state.metrics?.contacts.length ?? 0);
  text(
    "recovery",
    state.metrics?.recovery.median != null
      ? `${number(state.metrics.recovery.median / 1000)} s`
      : "Indisponível",
  );
  document.getElementById("progress-bar").value = state.metrics?.progress ?? 0;
  document.getElementById("empty").hidden = !!state.maze;
  const terminal = ["COMPLETED", "TIMED_OUT", "ABORTED"].includes(state.state),
    enabled = {
      start: state.state === "READY" && state.connected.student,
      pause: state.state === "RUNNING",
      resume: state.state === "PAUSED" && state.connected.student,
      abort: ["READY", "RUNNING", "PAUSED"].includes(state.state),
      next: terminal && !state.closed && state.intervalRemaining === 0,
      "repeat-training":
        terminal && state.label === "Treinamento" && !state.closed,
      "end-session": !state.closed,
      "new-session": state.state !== "RUNNING",
    };
  for (const [id, value] of Object.entries(enabled))
    document.getElementById(id).disabled = !value;
  for (const input of document.getElementById("configuration").elements)
    input.disabled = state.state !== "IDLE";
  text(
    "guidance",
    state.phase === "INTERVAL"
      ? "Consulte o resultado e aguarde a pausa mínima. O avanço exige comando explícito."
      : state.state === "PAUSED"
        ? "Confira a conexão e a tela do aluno antes de retomar."
        : "Parâmetros experimentais. Movimento do mouse não mede atenção ou atividade cerebral.",
  );
  text(
    "set-info",
    state.set
      ? `${state.set.id} · equivalência geométrica operacional. Não garante dificuldade humana equivalente.`
      : state.state === "IDLE"
        ? "Parâmetros congelados após preparar. Sem sensores reais ou calibração."
        : "Exploração: sementes livres; sem tendência comparativa automática.",
  );
  if (incoming.config) {
    const channel = document.getElementById("channel");
    if (channel.options.length !== state.config.channels) {
      channel.replaceChildren(
        ...Array.from(
          { length: state.config.channels },
          (_, i) => new Option(`V${i + 1}`, String(i)),
        ),
      );
    }
    document.getElementById("modulation").hidden =
      state.config.eegMode !== "interactive";
  }
  if (incoming.metrics)
    document.getElementById("live-details").innerHTML = metricDetails(
      state.metrics,
    );
  const reportKey = JSON.stringify(state.report);
  if (reportKey !== lastReport) {
    lastReport = reportKey;
    renderReport(state.report);
    comparison(
      document.getElementById("comparison-chart"),
      state.report.evaluations,
    );
  }
  if (document.activeElement !== document.getElementById("notes"))
    document.getElementById("notes").value = state.notes ?? "";
  text(
    "unsaved",
    state.unexported
      ? "Resultados ainda não exportados. Podem ser perdidos ao reiniciar ou expirar a sessão."
      : "Resultados exportados ou sessão ainda sem registros.",
  );
  if (incoming.events) timeline.events(events);
  text(
    "technical",
    JSON.stringify(
      {
        sessionId: state.id,
        runId: state.runId,
        config: state.config,
        discarded: state.discarded,
        engineDelayMs: state.engineDelay,
        latencyMs: state.latency,
        eeg: state.eegStatus,
        connections: state.connected,
        versions: { engine: 2, metrics: 2, eeg: 1, welch: 1 },
      },
      null,
      2,
    ),
  );
});
function acceptBlock(block) {
  const channels = block.channels.map((a) =>
    Array.isArray(a) ? a : Object.values(a),
  );
  channels.forEach((values, i) => {
    eegChannels[i] ??= [];
    eegChannels[i].push(...values);
    const excess = eegChannels[i].length - block.sampleRate * 8;
    if (excess > 0) eegChannels[i].splice(0, excess);
  });
}
socket.on("eeg", acceptBlock);
socket.on("eeg-history", (blocks) => {
  eegChannels = [];
  for (const b of blocks) acceptBlock(b);
});
socket.on("spectrum", (value) => {
  spectrumData = value;
});
function render(now) {
  requestAnimationFrame(render);
  if (!state) return;
  drawBoard(document.getElementById("board"), state, {
    trail: !student && document.getElementById("trail").checked ? trail : [],
    metrics: student ? null : state.metrics,
  });
  if (student || now - lastRender < 100) return;
  lastRender = now;
  const selected = Number(document.getElementById("channel").value) || 0;
  waveform(document.getElementById("eeg"), [eegChannels[selected] ?? []]);
  const spectral = (spectrumData ?? state.eegStatus?.spectrum)?.channels[
    selected
  ];
  text(
    "bands",
    spectral?.valid
      ? Object.entries(spectral.absolute)
          .map(
            ([band, v]) =>
              `${band}: ${number(v)} µV² · ${number(spectral.relative[band], 1)}%`,
          )
          .join(" | ")
      : "Aguardando oito segundos contínuos para Welch.",
  );
  if (document.getElementById("diagnostics").open) {
    waveform(
      document.getElementById("all-channels"),
      eegChannels.length ? eegChannels : [[]],
    );
    spectrum(document.getElementById("psd"), spectral);
    text(
      "processing",
      JSON.stringify(
        spectral ?? { valid: false, reason: "insufficient-buffer" },
        null,
        2,
      ),
    );
  }
  for (const canvas of document.querySelectorAll(".result-trajectory")) {
    if (!canvas.checkVisibility()) continue;
    const run = results.find((r) => r.id === canvas.dataset.run);
    if (run)
      drawBoard(canvas, run, {
        trail: run.trajectory,
        metrics: run.result,
        marker: run.trajectory.at(-1),
      });
  }
}
requestAnimationFrame(render);
