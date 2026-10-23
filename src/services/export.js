"use strict";
const { once } = require("node:events");
const { setImmediate: yieldLoop } = require("node:timers/promises");
async function streamExport(session, request, response) {
  if (session.exporting) {
    response.writeHead(429);
    response.end("Exportação em andamento.");
    return;
  }
  session.exporting = true;
  const cancellation = new AbortController();
  response.once("close", () => cancellation.abort());
  try {
    if (session.closed && session.worker)
      await session.worker.finish(session.time);
    const revision = session.revision,
      data = session.exportData(false);
    // Snapshot array membership before yielding; a live run may continue during download.
    data.events = [...data.events];
    data.runs = data.runs.map((r) => ({
      ...r,
      steps: [...r.steps],
      inputs: [...r.inputs],
      trajectory: [...r.trajectory],
      events: [...r.events],
      pauses: r.pauses.map((p) => ({ ...p })),
    }));
    const eeg = {
      samples: session.eeg.samples,
      blocks: [...session.eeg.blocks],
      spectra: [...session.eeg.spectra],
      artifacts: [...session.eeg.artifacts],
      gaps: [...session.eeg.gaps],
    };
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="attobrain-${session.id}.json"`,
    });
    let writes = 0;
    async function write(value) {
      if (response.destroyed) throw Error("Download cancelado.");
      if (!response.write(value))
        await once(response, "drain", { signal: cancellation.signal });
      if (++writes % 20 === 0) await yieldLoop();
    }
    async function array(values, encode = JSON.stringify) {
      await write("[");
      for (let i = 0; i < values.length; i += 100)
        await write(
          (i ? "," : "") +
            values
              .slice(i, i + 100)
              .map(encode)
              .join(","),
        );
      await write("]");
    }
    const { events, runs, ...header } = data;
    await write(JSON.stringify(header).slice(0, -1) + ',"events":');
    await array(events);
    await write(',"runs":[');
    for (let i = 0; i < runs.length; i++) {
      const { steps, inputs, trajectory, events, ...run } = runs[i];
      await write((i ? "," : "") + JSON.stringify(run).slice(0, -1));
      for (const [name, records] of Object.entries({
        steps,
        inputs,
        trajectory,
        events,
      })) {
        await write(`,"${name}":`);
        await array(records);
      }
      await write("}");
    }
    await write(
      '],"eeg":' +
        JSON.stringify({
          samples: eeg.samples,
          gaps: eeg.gaps,
          artifacts: eeg.artifacts,
        }).slice(0, -1) +
        ',"spectra":',
    );
    // Each spectral object is bounded to eight channels; yield between windows.
    await write("[");
    for (let i = 0; i < eeg.spectra.length; i++)
      await write((i ? "," : "") + JSON.stringify(eeg.spectra[i]));
    await write('],"blocks":[');
    for (let i = 0; i < eeg.blocks.length; i++) {
      const b = eeg.blocks[i];
      await write(
        (i ? "," : "") +
          JSON.stringify({
            ...b,
            channels: b.channels.map((a) => Array.from(a)),
          }),
      );
    }
    response.end("]}}");
    if (request.headers["x-attobrain-export"] === "true")
      session.exportedRevision = revision;
  } finally {
    session.exporting = false;
  }
}
module.exports = { streamExport };
