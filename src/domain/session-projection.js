"use strict";
const { analyze } = require("./metrics");
function sessionView(session, role, full = false) {
  const r = session.current,
    base = {
      id: session.id,
      phase: session.phase,
      state: r?.state ?? "IDLE",
      runId: r?.id ?? null,
      label: r?.label ?? "",
      position: r?.position,
      active: r?.active ?? 0,
      limitMs: r?.limitMs ?? 0,
      time: session.time,
      intervalRemaining: Math.max(0, session.intervalUntil - session.time),
      connected: {
        student: !!session.student,
        professional: !!session.professional,
      },
      closed: session.closed,
    };
  if (full)
    Object.assign(base, { maze: r?.maze, walls: r?.walls, seed: r?.seed });
  if (role === "student") return base;
  return {
    ...base,
    config: session.config,
    set: session.set,
    metrics: session.result(),
    report: session.report(),
    notes: session.notes,
    unexported: session.dirty && session.exportedRevision !== session.revision,
    revision: session.revision,
    retention:
      "Dados em memória. Limite de 30 minutos; liberação após 30 minutos sem conexão. Exporte os resultados.",
    discarded: session.discarded,
    engineDelay: session.engineDelay,
    eegStatus: {
      samples: session.eeg.samples,
      blocks: session.eeg.blocks.length,
      bytes: session.eeg.samples * session.config.channels * 4,
      gaps: session.eeg.gaps,
      artifacts: session.eeg.artifacts
        .filter((a) => {
          const start =
            a.start ?? (a.startIndex / session.config.sampleRate) * 1000;
          const end =
            a.end ??
            ((a.startIndex + a.durationSamples) / session.config.sampleRate) *
              1000;
          return start <= session.time + 10000 && end >= session.time - 10000;
        })
        .slice(-30),
      bufferSamples: Math.min(
        session.eeg.samples,
        session.config.sampleRate * 8,
      ),
      deliveryLagMs: Math.max(
        0,
        session.time - (session.eeg.samples / session.config.sampleRate) * 1000,
      ),
      spectrum: session.eeg.spectra.at(-1) ?? null,
    },
    ...(full
      ? {
          trajectory: r?.trajectory ?? [],
          events: session.events,
          results: session.runs
            .filter((x) => x.result)
            .map((x) => ({
              id: x.id,
              label: x.label,
              result: x.result,
              maze: x.maze,
              walls: x.walls,
              trajectory: x.trajectory,
            })),
        }
      : {}),
  };
}
function sessionExport(session, includeEEG = true) {
  return {
    schemaVersion: 2,
    manifest: {
      sessionId: session.id,
      createdAt: session.createdAt,
      source: "mouse",
      eegSource: "synthetic",
      units: {
        position: "board-width",
        time: "ms",
        eeg: "synthetic-uV",
        psd: "synthetic-uV^2/Hz",
      },
      versions: { engine: 2, metrics: 2, eeg: 1, spectrum: 1 },
      config: session.config,
      set: session.set,
    },
    report: session.report(),
    notes: session.notes,
    events: session.events,
    runs: session.runs.map((run) => {
      const {
        id,
        label,
        state,
        seed,
        maze,
        walls,
        metadata,
        steps,
        inputs,
        trajectory,
        pauses,
        active,
        progress,
        sessionNow,
        startedAt,
        endedAt,
        limitMs,
        events,
      } = run;
      return {
        id,
        label,
        state,
        seed,
        maze,
        walls,
        metadata,
        steps,
        inputs,
        trajectory,
        pauses,
        active,
        progress,
        sessionNow,
        startedAt,
        endedAt,
        limitMs,
        events,
        result: run.result ?? analyze(run, session.config),
      };
    }),
    ...(includeEEG
      ? {
          eeg: {
            ...session.eeg,
            blocks: session.eeg.blocks.map((b) => ({
              ...b,
              channels: b.channels.map((a) => Array.from(a)),
            })),
          },
        }
      : {}),
  };
}
module.exports = { sessionView, sessionExport };
