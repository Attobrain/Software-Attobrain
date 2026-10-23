"use strict";
const DEFAULTS = Object.freeze({
  mode: "protocol",
  level: 7,
  seed: 42,
  trainingSeconds: 75,
  activitySeconds: 210,
  intervalSeconds: 35,
  speed: 0.25,
  radius: 0.01,
  wallWidth: 0.005,
  lowSpeed: 0.005,
  lowSeconds: 2,
  eegMode: "independent",
  channels: 8,
  sampleRate: 250,
  eegSeed: 90210,
  artifacts: true,
});
function configuration(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Configuração inválida.");
  const c = { ...DEFAULTS };
  for (const key of Object.keys(c))
    if (input[key] !== undefined) c[key] = input[key];
  for (const [key, choices] of Object.entries({
    mode: ["protocol", "single"],
    level: [7, 10],
    eegMode: ["independent", "interactive"],
    channels: [1, 4, 8],
    sampleRate: [250, 500],
  })) {
    if (!choices.includes(c[key])) throw Error(`Valor inválido: ${key}.`);
  }
  for (const [key, min, max] of [
    ["trainingSeconds", 60, 90],
    ["activitySeconds", 180, 240],
    ["intervalSeconds", 30, 45],
    ["speed", 0.1, 0.4],
    ["radius", 0.005, 0.015],
    ["wallWidth", 0.002, 0.008],
    ["lowSpeed", 0.001, 0.02],
    ["lowSeconds", 1, 5],
    ["seed", 0, 4294967295],
    ["eegSeed", 0, 4294967295],
  ]) {
    if (!Number.isFinite(c[key]) || c[key] < min || c[key] > max)
      throw Error(`Faixa inválida: ${key}.`);
  }
  if (
    !Number.isInteger(c.seed) ||
    !Number.isInteger(c.eegSeed) ||
    typeof c.artifacts !== "boolean"
  )
    throw Error("Semente/artefatos inválidos.");
  return Object.freeze(c);
}
module.exports = { configuration, DEFAULTS };
