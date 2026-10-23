"use strict";
function noise(seed, index, channel) {
  let n =
    (seed ^
      Math.imul(index + 1, 374761393) ^
      Math.imul(channel + 1, 668265263)) >>>
    0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 2147483648 - 1;
}
function colored(seed, index, channel) {
  let sum = 0;
  for (let octave = 0; octave < 6; octave++) {
    const scale = 2 ** (octave + 2),
      q = index / scale,
      base = Math.floor(q),
      fraction = q - base;
    sum +=
      (noise(seed + octave, base, channel) * (1 - fraction) +
        noise(seed + octave, base + 1, channel) * fraction) /
      Math.sqrt(6);
  }
  return sum;
}
class SyntheticEEG {
  constructor(config) {
    this.config = config;
    this.modulations = [];
  }
  modulate(event, startIndex) {
    if (this.config.eegMode !== "interactive") return null;
    const artifact = {
      type: "noise-burst",
      eventSeq: event.seq,
      startIndex,
      durationSamples: this.config.sampleRate,
      channels: Array.from(
        { length: this.config.channels },
        (_, i) => `V${i + 1}`,
      ),
      amplitude: 20,
      source: "didactic",
      version: 1,
    };
    this.modulations.push(artifact);
    return artifact;
  }
  generate(startIndex, count) {
    const c = this.config;
    const channels = Array.from({ length: c.channels }, (_, channel) => {
      const values = new Float32Array(count);
      for (let j = 0; j < count; j++) {
        const index = startIndex + j,
          t = index / c.sampleRate;
        let value = 0;
        [2, 6, 10, 20, 38].forEach((f, k) => {
          const amplitude =
            [5, 8, 12, 5, 3][k] * (1 + 0.12 * Math.sin(t * 0.13 + channel));
          value +=
            amplitude *
            Math.sin(
              2 * Math.PI * f * t + noise(c.eegSeed, k, channel) * Math.PI,
            );
        });
        value +=
          1.5 * noise(c.eegSeed, index, channel) +
          3 * colored(c.eegSeed, index, channel);
        if (c.artifacts) {
          const phase = t % 20;
          if (phase >= 10 && phase < 11)
            value += 25 * Math.sin(Math.PI * (phase - 10));
          if (phase >= 14 && phase < 15)
            value += 15 * noise(c.eegSeed + 1, index, channel);
          if (phase >= 17 && phase < 19)
            value += 5 * Math.sin(2 * Math.PI * 50 * t);
        }
        for (const a of this.modulations)
          if (index >= a.startIndex && index < a.startIndex + a.durationSamples)
            value += a.amplitude * noise(c.eegSeed + 2, index, channel);
        values[j] = value;
      }
      return values;
    });
    this.modulations = this.modulations.filter(
      (a) => a.startIndex + a.durationSamples > startIndex + count,
    );
    return {
      startIndex,
      count,
      sampleRate: c.sampleRate,
      channels,
      unit: "synthetic-uV",
      version: 1,
    };
  }
}
module.exports = { SyntheticEEG, noise };
