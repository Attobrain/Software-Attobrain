"use strict";
const { parentPort, workerData } = require("node:worker_threads");
const { performance } = require("node:perf_hooks");
const { SyntheticEEG } = require("./synthetic");
const { welch } = require("./spectrum");
const config = workerData.config,
  provider = new SyntheticEEG(config),
  origin = workerData.origin;
const startIndex = workerData.startIndex ?? 0;
let index = startIndex,
  lastSpectrum = startIndex,
  finishIndex = null;
const buffer = Array.from({ length: config.channels }, () => []);
parentPort.on("message", (message) => {
  if (message.type === "finish")
    finishIndex = Math.ceil((message.time * config.sampleRate) / 1000);
  if (message.type === "modulate") {
    const startIndex = Math.max(
      index,
      Math.ceil((message.event.sessionTime * config.sampleRate) / 1000),
    );
    const artifact = provider.modulate(message.event, startIndex);
    if (artifact) parentPort.postMessage({ type: "artifact", artifact });
  }
});
const timer = setInterval(() => {
  const target =
    finishIndex ??
    Math.min(
      1800 * config.sampleRate,
      Math.floor(((performance.now() - origin) * config.sampleRate) / 1000),
    );
  const count = Math.min(config.sampleRate, Math.max(0, target - index));
  if (!count) {
    if (finishIndex !== null) {
      clearInterval(timer);
      parentPort.close();
    }
    return;
  }
  const block = provider.generate(index, count);
  index += count;
  block.channels.forEach((values, c) => {
    buffer[c].push(...values);
    if (buffer[c].length > config.sampleRate * 8)
      buffer[c].splice(0, buffer[c].length - config.sampleRate * 8);
  });
  parentPort.postMessage(
    { type: "block", block },
    block.channels.map((a) => a.buffer),
  );
  if (index - lastSpectrum >= config.sampleRate) {
    lastSpectrum = index;
    const spectrum = {
      startIndex: Math.max(startIndex, index - config.sampleRate * 8),
      endIndex: index,
      channels: buffer.map((values) => welch(values, config.sampleRate)),
      quality: "synthetic-known-artifacts",
      version: 1,
    };
    parentPort.postMessage({ type: "spectrum", spectrum });
  }
  if (
    index >= 1800 * config.sampleRate ||
    (finishIndex !== null && index >= finishIndex)
  ) {
    clearInterval(timer);
    parentPort.close();
  }
}, 100);
