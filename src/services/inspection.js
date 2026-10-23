"use strict";
function inspection(session, instant) {
  if (!Number.isFinite(instant) || instant < 0 || instant > 1800000)
    throw Error("Instante inválido.");
  const rate = session.config.sampleRate;
  return {
    schemaVersion: 2,
    manifest: { sessionId: session.id, config: session.config },
    events: session.events,
    runs: session.runs.map((r) => ({
      id: r.id,
      label: r.label,
      maze: r.maze,
      walls: r.walls,
      trajectory: r.trajectory,
      result: r.result,
    })),
    eeg: {
      samples: session.eeg.samples,
      blocks: session.eeg.blocks
        .filter(
          (b) =>
            b.startIndex <= (instant * rate) / 1000 &&
            b.startIndex + b.count >= ((instant - 4000) * rate) / 1000,
        )
        .map((b) => ({ ...b, channels: b.channels.map((c) => Array.from(c)) })),
    },
  };
}
module.exports = { inspection };
