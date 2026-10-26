import { createStudentEffects } from "./public/modules/student-effects.js";
import { createPlatform } from "./public/modules/platform.js";
import { professionalLayout } from "./public/modules/layout.js";
import { text, number, time, labels } from "./public/modules/format.js";
import { drawBoard } from "./public/modules/board.js";
import {
  waveform,
  spectrum,
  comparison,
  activityTrend,
} from "./public/modules/charts.js";
import { metricDetails, renderReport } from "./public/modules/results.js";
import { bindControls } from "./public/modules/controls.js";
import { studentShell, renderStudent } from "./public/modules/student-view.js";
import { updateMonitor, updateBands } from "./public/modules/monitor-view.js";
const student = location.pathname === "/aluno",
  root = document.getElementById("root"),
  socket = io({ autoConnect: false });
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
document.body.classList.add(student ? "student-app" : "professional-app");
root.innerHTML = student ? studentShell() : professionalLayout();
const studentEffects = student ? createStudentEffects(document.getElementById("student-sound")) : null;
const message = (value) => {
  if (student) {
    const p = document.createElement("p");
    p.textContent = value;
    root.append(p);
  } else text("message", value);
};
let joinPromise = null, joinResolve, joinReject;
let platform;
function join() {
  socket.emit("join", credentials?.id && credentials?.key
    ? { id: credentials.id, key: credentials.key }
    : { create: !student, guided: true, creationToken: sessionStorage.getItem("atto-create") || undefined }, reply => {
      if (reply.error) {
        message(reply.error);
        if (!student) {
          const button = document.createElement("button");
          button.className = "secondary"; button.dataset.flow = "new";
          button.textContent = "Criar nova sessão";
          document.getElementById("message").append(button);
        }
        joinReject?.(Error(reply.error)); return;
      }
      credentials = reply;
      if (!student) {
        sessionStorage.setItem("atto-control", JSON.stringify(reply));
        sessionStorage.removeItem("atto-create");
        document.getElementById("student-link").href = `${location.origin}/aluno#id=${reply.id}&key=${reply.studentKey}`;
      }
      joinResolve?.(reply);
    });
}
socket.on("connect", join);
function connect(retry = false) {
  if (retry) { socket.disconnect(); joinPromise = null; }
  if (joinPromise) return joinPromise;
  if (!student && !credentials?.id && !sessionStorage.getItem("atto-create")) sessionStorage.setItem("atto-create", crypto.randomUUID());
  joinPromise = new Promise((resolve, reject) => { joinResolve = resolve; joinReject = reject; });
  socket.connect();
  return joinPromise;
}
socket.on("disconnect", () => {
  text("connection", "Sem conexão · atividade interrompida");
  if (student) {
    const previous = state;
    state = { ...state, disconnected: true };
    studentEffects?.update(state, previous);
    renderStudent(state, previous);
  }
});
function command(type, extra = {}) {
  return new Promise((resolve, reject) => {
    socket.timeout(5000).emit("command", {
      id: credentials?.id, commandId: crypto.randomUUID(), type,
      expectedRevision: state?.workflow?.controlRevision, ...extra,
    }, (error, reply) => {
      const problem = error ? "Sem confirmação. Confira o estado antes de tentar novamente." : reply?.error;
      if (problem) { message(problem); reject(Error(problem)); }
      else { message(""); resolve(reply); }
    });
  });
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
function newSession() { document.getElementById("new-session").click(); }
function showImported(data) {
  eegChannels = [];
  spectrumData = data.eeg.spectra?.at(-1) ?? null;
  for (const block of data.eeg.blocks.slice(-90)) acceptBlock(block);
  document.getElementById("channel").replaceChildren(...Array.from({ length: data.manifest.config.channels ?? 1 }, (_, i) => new Option(`V${i + 1}`, String(i))));
  text("technical", JSON.stringify({ manifest: data.manifest, quality: data.report.analysis?.quality, originalImportedReport: true }, null, 2));
  text("connection", "Arquivo importado · somente leitura");
  renderReport(data.report);
  comparison(document.getElementById("comparison-chart"), data.report.analysis);
  results = data.runs.map(r => ({ ...r, result: r.result }));
  document.getElementById("notes").value = data.notes ?? "";
  document.getElementById("notes").disabled = true;
  document.getElementById("export").disabled = true;
  document.getElementById("inspect").disabled = true;
  text("unsaved", "Arquivo original importado · inspeção local somente leitura.");
}
function restoreLive() {
  results = []; eegChannels = []; spectrumData = null; lastReport = "";
  document.getElementById("notes").disabled = false;
  document.getElementById("export").disabled = false;
  document.getElementById("inspect").disabled = false;
  if (socket.connected) socket.emit("resync", {}, () => {});
}
if (student) connect().catch(error => message(error.message));
else platform = createPlatform({ connect, command, state: () => state, credentials: () => credentials, socket, message, timeline, showImported, restoreLive, newSession });
socket.on("snapshot", (incoming) => {
  const previous = state;
  state = { ...state, ...incoming, disconnected: false };
  if (incoming.full) {
    trail = incoming.trajectory ?? [];
    events = incoming.events ?? [];
    if (!platform?.isImported()) results = incoming.results ?? [];
  } else {
    if (previous?.runId !== incoming.runId) trail = [];
    trail.push(...(incoming.trajectory ?? []));
    events.push(...(incoming.events ?? []));
  }
  text(
    "connection",
    platform?.isImported() ? "Arquivo importado · sessão ao vivo preservada" : `${state.connected.student ? "Aluno conectado" : "Aguardando aluno"} · ${state.connected.professional ? "Profissional conectado" : "Profissional desconectado"}`,
  );
  if (student) {
    studentEffects?.update(state, previous);
    renderStudent(state, previous);
    return;
  }
  platform?.update(previous);
  updateMonitor(state, events);
  if (platform?.isImported()) return;
  if (!previous && state.state !== "IDLE")
    document.getElementById("activity-setup").open = false;
  if (previous?.state === "IDLE" && state.state === "READY") {
    document.getElementById("activity-setup").open = false;
  }
  text("status", labels[state.state]);
  text(
    "interval",
    state.intervalRemaining > 0
      ? `Pausa mínima: ${Math.ceil(state.intervalRemaining / 1000)} s`
      : "",
  );
  text("active", `${time(state.active)} / ${time(state.limitMs)}`);
  text("progress", `${state.metrics?.progress ?? 0}%`);
  text("contacts", state.metrics?.collisionEpisodeCount ?? "—");
  text(
    "recovery",
    state.metrics?.recovery.median != null
      ? `${number(state.metrics.recovery.median / 1000)} s`
      : "—",
  );
  document.getElementById("progress-bar").value = state.metrics?.progress ?? 0;
  document.getElementById("empty").hidden = !!state.maze;
  const terminal = ["COMPLETED", "TIMED_OUT", "ABORTED"].includes(state.state),
    enabled = {
      start: state.workflow.actions.start,
      pause: state.state === "RUNNING",
      resume: state.workflow.actions.resume,
      abort: ["READY", "RUNNING", "PAUSED"].includes(state.state),
      next: state.workflow.actions.next,
      "repeat-training":
        state.workflow.actions.repeat,
      "end-session": !state.closed,
      "new-session": state.state !== "RUNNING",
    };
  for (const [id, value] of Object.entries(enabled))
    document.getElementById(id).disabled = !value;
  for (const [id, visible] of Object.entries({ start: state.state === "READY", pause: state.state === "RUNNING", resume: state.state === "PAUSED", next: terminal && !state.closed, "repeat-training": terminal && state.label === "Treinamento" && !state.closed })) document.getElementById(id).hidden = !visible;
  for (const input of document.getElementById("configuration").elements)
    input.disabled = state.state !== "IDLE";
  text(
    "guidance",
    state.phase === "INTERVAL"
      ? "Aguarde a pausa mínima. Depois, prepare a próxima atividade."
      : state.state === "READY" && !state.workflow.studentReady
        ? "Deixe a janela do aluno visível e conectada para liberar o início."
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
      state.report.analysis,
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
socket.on("eeg", block => { if (!platform?.isImported()) acceptBlock(block); });
socket.on("eeg-history", (blocks) => {
  if (platform?.isImported()) return;
  eegChannels = [];
  for (const b of blocks) acceptBlock(b);
});
socket.on("spectrum", (value) => {
  if (platform?.isImported()) return;
  spectrumData = value;
});
function render(now) {
  requestAnimationFrame(render);
  if (!state && !platform?.isImported()) return;
  if (document.getElementById("board")?.checkVisibility()) drawBoard(document.getElementById("board"), state, {
    trail: !student && document.getElementById("trail").checked ? trail : [],
    metrics: student ? null : state.metrics,
    studentTheme: student,
  });
  if (student || now - lastRender < 100) return;
  lastRender = now;
  const selected = Number(document.getElementById("channel").value) || 0;
  if (document.getElementById("eeg").checkVisibility()) waveform(document.getElementById("eeg"), [eegChannels[selected] ?? []]);
  const spectral = (platform?.isImported() ? spectrumData : spectrumData ?? state.eegStatus?.spectrum)?.channels[
    selected
  ];
  updateBands(spectral);
  document.getElementById("signal-empty").hidden =
    !!eegChannels[selected]?.length;
  if (document.getElementById("activity-trend").checkVisibility()) activityTrend(
    document.getElementById("activity-trend"),
    trail,
    state.metrics,
    state.config?.speed,
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
