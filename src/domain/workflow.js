"use strict";
const { configuration } = require("../validators/config");
const { describe, setFor } = require("./mazes");
const terminal = new Set(["COMPLETED", "TIMED_OUT", "ABORTED"]);
function participant(value) {
  if (!value || typeof value !== "object") throw Error("Selecione um aluno válido.");
  const result = {};
  for (const [key, max] of [["id", 120], ["name", 100]]) {
    if (typeof value[key] !== "string" || !value[key].trim() || value[key].length > max)
      throw Error("Identificação demonstrativa inválida.");
    result[key] = value[key].trim();
  }
  return Object.freeze({ ...result, demonstration: true });
}
function preview(config) {
  const c = configuration(config), set = c.mode === "protocol" ? setFor(c.level) : null;
  const seeds = set ? [["Treinamento", 123], ...set.candidates.map((v, i) => [["A", "B", "C"][i], v.seed])] : [["Exploração", c.seed]];
  return seeds.map(([label, seed]) => {
    const { maze, walls, metadata } = describe(c.level, seed);
    return { label, seed, maze, walls, metadata };
  });
}
function studentReady(s) {
  return !!s.student && (!s.guided || (s.presence.visible && s.time - s.presence.at <= 5000));
}
function workflow(s) {
  const r = s.current, ended = terminal.has(r?.state), ready = studentReady(s);
  const step = s.closed ? "results" : !r ? s.draftStep : r.label === "Treinamento" ? "training" : r.label === "Exploração" ? "activity" : r.label;
  return {
    step, controlRevision: s.controlRevision,
    runStates: Object.fromEntries(s.runs.map(run => [run.label === "Treinamento" ? "training" : run.label === "Exploração" ? "activity" : run.label, run.state])),
    participant: s.participant, preview: !r ? s.preview : null,
    studentReady: ready,
    actions: {
      select: !r && !s.closed,
      configure: !r && !!s.participant && !s.closed,
      begin: !r && s.draftStep === "review" && !!s.professional && ready && !s.closed,
      start: r?.state === "READY" && ready && !!s.professional,
      resume: r?.state === "PAUSED" && ready && !!s.professional,
      pause: r?.state === "RUNNING", abort: !!r && !ended && !s.closed,
      next: ended && !s.closed && s.time >= s.intervalUntil,
      repeat: ended && r.label === "Treinamento" && !s.closed && s.runs.filter(v => v.label === "Treinamento").length < 7,
      end: !s.closed,
    },
  };
}
function draftCommand(s, command) {
  if (s.current || s.closed) throw Error("A configuração está congelada.");
  switch (command.type) {
    case "select-participant":
      s.participant = participant(command.participant);
      s.preview = null;
      s.draftStep = "configuration";
      break;
    case "configure":
      if (!s.participant) throw Error("Selecione o aluno primeiro.");
      s.config = configuration(command.config);
      s.preview = preview(s.config);
      s.draftStep = "review";
      break;
    case "back":
      if (!["participant", "configuration"].includes(command.step) || (command.step === "configuration" && !s.participant)) throw Error("Retorno indisponível.");
      s.draftStep = command.step;
      break;
    default: return false;
  }
  s.controlRevision++;
  s.event("draft-updated", { step: s.draftStep });
  return true;
}
module.exports = { participant, preview, studentReady, workflow, draftCommand };
