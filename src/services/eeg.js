"use strict";
const { Worker } = require("node:worker_threads");
const path = require("node:path");
function startEEG(session, onData) {
  const worker = new Worker(path.join(__dirname, "eeg-worker.js"), {
    workerData: { config: session.config, origin: session.origin },
  });
  let expected = 0,
    stopped = false,
    finishing = null;
  const done = new Promise((resolve) => worker.once("exit", resolve));
  worker.on("message", (message) => {
    if (stopped) return;
    if (message.type === "block") {
      const b = message.block;
      if (b.startIndex !== expected) {
        session.eeg.gaps.push({ start: expected, end: b.startIndex });
        session.event("eeg-gap", { expected, received: b.startIndex });
      }
      if (b.startIndex < expected) return;
      expected = b.startIndex + b.count;
      session.eeg.blocks.push(b);
      session.eeg.samples = expected;
      session.revision++;
      session.dirty = true;
      onData("eeg", b);
    } else if (message.type === "spectrum") {
      const s = message.spectrum;
      const rate = session.config.sampleRate;
      s.artifacts = session.eeg.artifacts.filter((a) => {
        const start = a.startIndex ?? (a.start * rate) / 1000,
          end =
            a.startIndex !== undefined
              ? a.startIndex + a.durationSamples
              : (a.end * rate) / 1000;
        return start < s.endIndex && end > s.startIndex;
      });
      s.quality = s.artifacts.length
        ? "known-synthetic-artifacts"
        : "synthetic-continuous";
      if (
        session.eeg.gaps.some(
          (g) => g.start < s.endIndex && g.end > s.startIndex,
        )
      ) {
        s.channels = s.channels.map(() => ({ valid: false, reason: "gap" }));
        s.quality = "gap";
      }
      session.eeg.spectra.push(s);
      onData("spectrum", s);
    } else if (message.type === "artifact") {
      session.eeg.artifacts.push(message.artifact);
      session.event("eeg-modulation", message.artifact);
    }
  });
  worker.on("error", (error) => {
    session.event("eeg-error", { message: error.message });
    session.eeg.gaps.push({
      start: expected,
      end: 1800 * session.config.sampleRate,
    });
    session.pause("eeg-error");
  });
  if (session.config.artifacts)
    session.eeg.artifacts.push(
      ...Array.from({ length: 90 }, (_, i) => [
        {
          type: "slow-pulse",
          start: i * 20000 + 10000,
          end: i * 20000 + 11000,
          amplitude: 25,
        },
        {
          type: "noise-burst",
          start: i * 20000 + 14000,
          end: i * 20000 + 15000,
          amplitude: 15,
        },
        {
          type: "mains-50Hz",
          start: i * 20000 + 17000,
          end: i * 20000 + 19000,
          amplitude: 5,
        },
      ])
        .flat()
        .map((a) => ({
          ...a,
          source: "programmed",
          channels: session.config.channels,
          version: 1,
        })),
    );
  return {
    modulate: (event) => worker.postMessage({ type: "modulate", event }),
    finish: (time) => {
      if (!finishing) {
        worker.postMessage({ type: "finish", time });
        finishing = done;
      }
      return finishing;
    },
    stop: () => {
      stopped = true;
      return worker.terminate();
    },
  };
}
module.exports = { startEEG };
