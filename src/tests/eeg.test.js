"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { SyntheticEEG } = require("../services/synthetic");
const { welch } = require("../services/spectrum");
const { configuration } = require("../validators/config");
test("semente reproduzível e continuidade por índice em blocos irregulares", () => {
  const config = configuration({ channels: 4 }),
    a = new SyntheticEEG(config),
    b = new SyntheticEEG(config),
    all = a.generate(0, 500);
  const first = b.generate(0, 183),
    last = b.generate(183, 317);
  for (let c = 0; c < 4; c++)
    assert.deepEqual(Array.from(all.channels[c]), [
      ...first.channels[c],
      ...last.channels[c],
    ]);
});
test("modo independente ignora eventos; interativo altera somente intervalo programado", () => {
  const independent = new SyntheticEEG(configuration({ channels: 1 })),
    baseline = independent.generate(0, 1000);
  assert.equal(independent.modulate({ seq: 1 }, 250), null);
  assert.deepEqual(independent.generate(0, 1000), baseline);
  const interactive = new SyntheticEEG(
    configuration({ channels: 1, eegMode: "interactive" }),
  );
  const artifact = interactive.modulate({ seq: 7 }, 250);
  assert.equal(artifact.eventSeq, 7);
  const mod = interactive.generate(0, 1000).channels[0];
  assert.deepEqual(mod.slice(0, 250), baseline.channels[0].slice(0, 250));
  assert.deepEqual(mod.slice(500), baseline.channels[0].slice(500));
  assert.notDeepEqual(
    mod.slice(250, 500),
    baseline.channels[0].slice(250, 500),
  );
});
for (const sampleRate of [250, 500])
  test(`Welch ${sampleRate} Hz: pico alpha, potência A²/2 e bandas relativas 100%`, () => {
    const amplitude = 10,
      signal = Float32Array.from(
        { length: sampleRate * 8 },
        (_, i) => amplitude * Math.sin((2 * Math.PI * 10 * i) / sampleRate),
      );
    const result = welch(signal, sampleRate);
    assert.equal(result.valid, true);
    const peak = result.psd.indexOf(Math.max(...result.psd));
    assert(Math.abs(result.frequencies[peak] - 10) < 0.5);
    const integrated = result.psd.reduce((v, p) => v + p * result.df, 0);
    assert(Math.abs(integrated - amplitude ** 2 / 2) < 0.05);
    assert(
      Math.abs(
        Object.values(result.relative).reduce((v, p) => v + p, 0) - 100,
      ) < 1e-8,
    );
    assert(result.relative.alpha > 99);
    assert.equal(welch(signal, sampleRate, { gap: true }).valid, false);
    assert.equal(welch(signal.slice(0, 100), sampleRate).valid, false);
  });
test("sinal nulo tem potência relativa indisponível", () => {
  const r = welch(new Float32Array(2000), 250);
  assert.equal(r.relative.alpha, null);
});
