"use strict";
const { randomUUID } = require("node:crypto");
const { sessionView, sessionExport } = require("./session-projection");
const { configuration } = require("../validators/config");
const { describe, setFor, cellAt } = require("./mazes");
const { move } = require("../../engine");
const { analyze } = require("./metrics");
const { consolidate } = require("./report");
const TERMINAL = new Set(["COMPLETED", "TIMED_OUT", "ABORTED"]);
const STEP = 1000 / 60;
class Session {
  constructor(now) {
    this.id = randomUUID();
    this.professionalKey = randomUUID();
    this.studentKey = randomUUID();
    this.createdAt = new Date().toISOString();
    this.origin = now;
    this.time = 0;
    this.previous = now;
    this.accumulator = 0;
    this.config = configuration();
    this.phase = "PREPARATION";
    this.runs = [];
    this.events = [];
    this.current = null;
    this.professional = null;
    this.student = null;
    this.notes = "";
    this.dirty = false;
    this.revision = 0;
    this.exportedRevision = -1;
    this.commands = new Map();
    this.discarded = { invalid: 0, stale: 0, rate: 0 };
    this.lastConnected = now;
    this.intervalUntil = 0;
    this.engineDelay = 0;
    this.closed = false;
    this.lastMetrics = 0;
    this.eeg = { blocks: [], spectra: [], artifacts: [], gaps: [], samples: 0 };
  }
  event(type, data = {}, source = "server") {
    const e = {
      schemaVersion: 2,
      sessionId: this.id,
      runId: this.current?.id ?? null,
      seq: this.events.length + 1,
      source,
      type,
      data,
      sessionTime: this.time,
      activeTime: this.current?.active ?? null,
    };
    this.events.push(e);
    if (this.current && !TERMINAL.has(this.current.state))
      this.current.events.push(e);
    this.revision++;
    this.dirty = true;
    return e;
  }
  prepare(config) {
    if (this.current || this.closed)
      throw Error(
        "A sessão já foi preparada. Crie outra para mudar parâmetros.",
      );
    this.config = configuration(config);
    this.set =
      this.config.mode === "protocol" ? setFor(this.config.level) : null;
    if (this.config.mode === "protocol" && !this.set)
      throw Error("Sem conjunto aprovado. Use exploração.");
    this.event("configured", { config: this.config, set: this.set });
    this.newRun(this.config.mode === "protocol" ? "Treinamento" : "Exploração");
  }
  newRun(label) {
    this.liveResult = null;
    this.lastMetrics = 0;
    const index = ["A", "B", "C"].indexOf(label),
      seed =
        index >= 0
          ? this.set.candidates[index].seed
          : label === "Treinamento"
            ? 123
            : this.config.seed;
    const description = describe(this.config.level, seed);
    this.current = {
      id: randomUUID(),
      label,
      ...description,
      state: "READY",
      active: 0,
      progress: 0,
      checkpoint: 0,
      position: {
        x: 0.5 / description.maze.cols,
        y: 0.5 / description.maze.rows,
      },
      steps: [],
      trajectory: [],
      inputs: [],
      events: [],
      pauses: [],
      segment: 0,
      target: null,
      lastInput: -Infinity,
      startedAt: null,
      endedAt: null,
      sessionNow: this.time,
      lastSeq: -1,
      lastAccepted: -Infinity,
      inputTimes: [],
      hitLast: new Map(),
      limitMs:
        (label === "Treinamento"
          ? this.config.trainingSeconds
          : this.config.activitySeconds) * 1000,
    };
    this.runs.push(this.current);
    this.phase = label === "Treinamento" ? "TRAINING" : "EVALUATION";
    this.event("prepared", { label, seed });
  }
  pause(reason) {
    const r = this.current;
    if (!r || r.state !== "RUNNING") return;
    r.state = "PAUSED";
    r.target = null;
    r.pauses.push({ start: this.time, end: null, reason });
    r.segment++;
    r.hitLast.clear();
    this.accumulator = 0;
    this.event("pause", { reason });
  }
  closePause() {
    const p = this.current?.pauses.at(-1);
    if (p && p.end === null) p.end = this.time;
  }
  finish(state) {
    const r = this.current;
    if (!r || TERMINAL.has(r.state)) return;
    this.closePause();
    r.state = state;
    r.endedAt = this.time;
    r.sessionNow = this.time;
    r.target = null;
    this.event("run-ended", { state, label: r.label });
    r.result = analyze(r, this.config);
    Object.freeze(r.result);
    if (["A", "B"].includes(r.label)) {
      this.phase = "INTERVAL";
      this.intervalUntil = this.time + this.config.intervalSeconds * 1000;
    } else if (r.label === "Treinamento") this.phase = "TRAINING";
    else {
      this.phase = "FINISHED";
      this.closed = true;
    }
  }
  execute(command) {
    const r = this.current;
    switch (command.type) {
      case "prepare":
        this.prepare(
          command.config ?? {
            level: command.level,
            seed: command.seed,
            mode: "single",
          },
        );
        break;
      case "start":
      case "resume":
        if (
          !r ||
          r.state !== (command.type === "start" ? "READY" : "PAUSED") ||
          !this.professional ||
          !this.student
        )
          throw Error("Conecte as duas telas e confira o estado.");
        this.closePause();
        r.state = "RUNNING";
        r.startedAt ??= this.time;
        r.lastInput = this.time;
        r.target = null;
        this.accumulator = 0;
        this.event(command.type === "start" ? "started" : "resumed");
        break;
      case "pause":
        if (r?.state !== "RUNNING")
          throw Error("Atividade não está em execução.");
        this.pause("manual");
        break;
      case "abort":
        if (!r || !["RUNNING", "PAUSED", "READY"].includes(r.state))
          throw Error("Nenhuma atividade para encerrar.");
        this.finish("ABORTED");
        break;
      case "next":
        if (!r || !TERMINAL.has(r.state) || this.closed)
          throw Error("Finalize a execução atual antes de avançar.");
        if (this.time < this.intervalUntil)
          throw Error("Aguarde a pausa mínima entre atividades.");
        this.newRun(
          r.label === "Treinamento" ? "A" : r.label === "A" ? "B" : "C",
        );
        break;
      case "repeat-training":
        if (
          r?.label !== "Treinamento" ||
          !TERMINAL.has(r.state) ||
          this.runs.filter((run) => run.label === "Treinamento").length >= 7
        )
          throw Error("Treinamento indisponível (máximo 7 tentativas).");
        this.newRun("Treinamento");
        break;
      case "end-session":
        if (this.closed) throw Error("Sessão já encerrada.");
        if (r && !TERMINAL.has(r.state)) this.finish("ABORTED");
        this.phase = "FINISHED";
        this.closed = true;
        this.event("session-ended");
        break;
      case "notes":
        if (typeof command.value !== "string" || command.value.length > 4000)
          throw Error("Observação inválida.");
        this.notes = command.value;
        this.revision++;
        this.dirty = true;
        break;
      default:
        throw Error("Comando indisponível.");
    }
    return { ok: true };
  }
  input(data) {
    const r = this.current;
    if (
      !r ||
      r.state !== "RUNNING" ||
      !data ||
      data.runId !== r.id ||
      !Number.isSafeInteger(data.seq) ||
      data.seq <= r.lastSeq
    ) {
      this.discarded.stale++;
      return;
    }
    if (
      typeof data.inside !== "boolean" ||
      typeof data.hidden !== "boolean" ||
      !Number.isFinite(data.clientTime) ||
      (data.inside &&
        (!Number.isFinite(data.x) ||
          !Number.isFinite(data.y) ||
          data.x < 0 ||
          data.x > 1 ||
          data.y < 0 ||
          data.y > 1))
    ) {
      this.discarded.invalid++;
      return;
    }
    r.lastSeq = data.seq;
    if (data.hidden) {
      this.pause("student-hidden");
      return;
    }
    r.inputTimes = r.inputTimes.filter((t) => this.time - t < 1000);
    if (this.time - r.lastAccepted < 45 || r.inputTimes.length >= 20) {
      this.discarded.rate++;
      return;
    }
    r.lastAccepted = this.time;
    r.inputTimes.push(this.time);
    r.lastInput = this.time;
    r.target = data.inside ? { x: data.x, y: data.y } : null;
    r.inputs.push({
      schemaVersion: 2,
      sessionId: this.id,
      runId: r.id,
      source: "mouse",
      seq: data.seq,
      sessionTime: this.time,
      activeTime: r.active,
      clientTime: data.clientTime,
      receivedAt: this.time,
      inside: data.inside,
      x: data.inside ? data.x : null,
      y: data.inside ? data.y : null,
    });
  }
  tick(now) {
    const elapsed = Math.max(0, now - this.previous);
    this.previous = now;
    this.time = Math.min(1800000, Math.max(0, now - this.origin));
    const r = this.current;
    if (r) r.sessionNow = this.time;
    if (now - this.origin >= 1800000 && !this.closed) {
      this.execute({ type: "end-session" });
      this.event("session-limit");
    }
    if (!r || r.state !== "RUNNING") return;
    if (elapsed > 250) {
      this.engineDelay = elapsed;
      this.event("engine-gap", { duration: elapsed });
      this.pause("engine-delay");
      return;
    }
    if (this.time - r.lastInput > 2000) {
      this.pause("input-unavailable");
      return;
    }
    this.accumulator += elapsed;
    while (this.accumulator + 1e-8 >= STEP && r.state === "RUNNING") {
      this.accumulator -= STEP;
      if (this.time - r.lastInput > 500) {
        this.pause("stale-input");
        break;
      }
      const dt = Math.min(STEP, r.limitMs - r.active),
        from = { ...r.position };
      r.active += dt;
      const moved = r.target
        ? move(from, r.target, dt / 1000, r.walls, this.config)
        : { position: from, hits: [], points: [] };
      r.position = moved.position;
      const cells = [];
      let previousCell = cellAt(from, r.maze);
      for (const point of moved.points) {
        const next = cellAt(point, r.maze);
        if (next !== previousCell) {
          cells.push(next);
          previousCell = next;
          if (next === r.checkpoints[r.checkpoint]) {
            r.checkpoint++;
            this.event("checkpoint", { cell: next });
          }
        }
      }
      r.progress = Math.min(99, Math.round((r.checkpoint / 6) * 100));
      r.steps.push({
        ...r.position,
        from,
        dt,
        t: r.active,
        sessionTime: this.time,
        segment: r.segment,
        hits: moved.hits,
        cells,
      });
      this.revision++;
      this.dirty = true;
      if (!r.trajectory.length || r.active - r.trajectory.at(-1).t >= 49)
        r.trajectory.push({
          ...r.position,
          t: r.active,
          sessionTime: this.time,
          segment: r.segment,
        });
      const newHits = moved.hits.filter(
        (h) => !r.hitLast.has(h) || r.active - r.hitLast.get(h) >= 200,
      );
      for (const h of moved.hits) r.hitLast.set(h, r.active);
      if (newHits.length)
        this.event("contact", { walls: newHits, position: r.position });
      if (
        r.checkpoint === 5 &&
        Math.hypot(
          r.position.x - (1 - 0.5 / r.maze.cols),
          r.position.y - (1 - 0.5 / r.maze.rows),
        ) < 0.02
      ) {
        r.progress = 100;
        this.finish("COMPLETED");
      } else if (r.active >= r.limitMs - 1e-6) this.finish("TIMED_OUT");
    }
  }
  result() {
    const r = this.current;
    if (!r) return null;
    if (
      !r.result &&
      (this.time - this.lastMetrics >= 250 || !this.liveResult)
    ) {
      this.liveResult = analyze(r, this.config);
      this.lastMetrics = this.time;
    }
    return r.result ?? this.liveResult;
  }
  report() {
    return consolidate(this.runs, this.config, this.set?.id);
  }
  view(role, full = false) {
    return sessionView(this, role, full);
  }
  exportData(includeEEG = true) {
    return sessionExport(this, includeEEG);
  }
}
module.exports = { Session, STEP, TERMINAL };
