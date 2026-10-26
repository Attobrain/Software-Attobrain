"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { Session } = require("../domain/session");
test("exportação v4 e importação v2/v3/v4 conservam amostras e rejeitam payloads malformados", async () => {
  const { validateImport } = await import("../../public/modules/timeline.js");
  const session = new Session(0);
  session.prepare({ channels: 1 });
  session.eeg.blocks.push({
    startIndex: 0,
    count: 2,
    sampleRate: 250,
    channels: [new Float32Array([1.25, -2.5])],
  });
  session.eeg.samples = 2;
  const data = JSON.parse(JSON.stringify(session.exportData()));
  assert.equal(validateImport(data), true);
  assert.equal(data.schemaVersion, 4);
  const legacy = structuredClone(data); legacy.schemaVersion = 2; delete legacy.report.analysis;
  assert.equal(validateImport(legacy), true);
  assert.deepEqual(data.eeg.blocks[0].channels[0], [1.25, -2.5]);
  assert.throws(() => validateImport({ schemaVersion: 1 }));
  assert.throws(() => validateImport({ ...data, runs: "invalid" }));
  data.eeg.blocks[0].channels[0][0] = "<script>";
  assert.throws(() => validateImport(data));
});
