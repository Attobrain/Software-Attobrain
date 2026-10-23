"use strict";
const FFT = require("fft.js");
const BANDS = {
  delta: [1, 4],
  theta: [4, 8],
  alpha: [8, 13],
  beta: [13, 30],
  gamma: [30, 45],
};
function welch(samples, sampleRate, { gap = false } = {}) {
  if (gap || samples.length < sampleRate * 8)
    return { valid: false, reason: gap ? "gap" : "insufficient-buffer" };
  const n = 2 ** Math.round(Math.log2(sampleRate * 2)),
    fft = new FFT(n),
    psd = Array(n / 2 + 1).fill(0);
  const hann = Array.from(
    { length: n },
    (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n),
  );
  const energy = hann.reduce((v, w) => v + w * w, 0);
  let segments = 0;
  for (let start = 0; start + n <= samples.length; start += n / 2) {
    const input = Array.from(samples.slice(start, start + n));
    const mean = input.reduce((v, x) => v + x, 0) / n;
    for (let i = 0; i < n; i++) input[i] = (input[i] - mean) * hann[i];
    const output = fft.createComplexArray();
    fft.realTransform(output, input);
    for (let k = 0; k <= n / 2; k++) {
      const power =
        (output[2 * k] ** 2 + output[2 * k + 1] ** 2) / (sampleRate * energy);
      psd[k] += power * (k === 0 || k === n / 2 ? 1 : 2);
    }
    segments++;
  }
  for (let k = 0; k < psd.length; k++) psd[k] /= segments;
  const df = sampleRate / n,
    absolute = {};
  for (const [name, [lo, hi]] of Object.entries(BANDS))
    absolute[name] = psd.reduce(
      (v, p, k) =>
        v +
        (k * df >= lo && (k * df < hi || (hi === 45 && k * df === 45))
          ? p * df
          : 0),
      0,
    );
  const total = Object.values(absolute).reduce((v, p) => v + p, 0),
    relative = {};
  for (const name of Object.keys(BANDS))
    relative[name] = total > 1e-12 ? (100 * absolute[name]) / total : null;
  return {
    valid: true,
    version: 1,
    n,
    segments,
    window: "periodic-Hann",
    overlap: 0.5,
    detrend: "mean",
    sampleRate,
    df,
    frequencies: psd.map((_, k) => k * df),
    psd,
    absolute,
    relative,
    total,
    units: "synthetic-uV^2/Hz",
  };
}
module.exports = { welch, BANDS };
