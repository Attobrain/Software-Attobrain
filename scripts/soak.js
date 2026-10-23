"use strict";
// Accelerated duration test: generates actual samples for 30 minutes, no timer shortcuts in DSP.
const { performance } = require("node:perf_hooks");
const { SyntheticEEG } = require("../src/services/synthetic");
const { welch } = require("../src/services/spectrum");
const { configuration } = require("../src/validators/config");
const assert = require("node:assert/strict");
for (const sampleRate of [250, 500]) {
  const start = performance.now(),
    config = configuration({ channels: 8, sampleRate }),
    provider = new SyntheticEEG(config);
  const buffers = Array.from(
    { length: 8 },
    () => new Float32Array(sampleRate * 1800),
  );
  let expected = 0;
  for (let seconds = 0; seconds < 1800; seconds++) {
    const block = provider.generate(seconds * sampleRate, sampleRate);
    assert.equal(block.startIndex, expected);
    expected += block.count;
    block.channels.forEach((values, c) =>
      buffers[c].set(values, block.startIndex),
    );
    if (seconds >= 7)
      for (const values of buffers)
        assert.equal(
          welch(
            values.subarray(
              (seconds - 7) * sampleRate,
              (seconds + 1) * sampleRate,
            ),
            sampleRate,
          ).valid,
          true,
        );
  }
  assert.equal(expected, sampleRate * 1800);
  console.log(
    JSON.stringify({
      sampleRate,
      channels: 8,
      durationSeconds: 1800,
      samplesPerChannel: expected,
      sampleBytes: buffers.reduce((v, a) => v + a.byteLength, 0),
      executionMs: Math.round(performance.now() - start),
      rss: process.memoryUsage().rss,
      lostSamples: 0,
    }),
  );
}
