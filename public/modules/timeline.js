import { drawBoard } from "./board.js";
import { waveform } from "./charts.js";
import { text, time } from "./format.js";
export function bindTimeline(loadLive) {
  let data = null,
    live = false,
    requestId = 0;
  const select = document.getElementById("event-select"),
    slider = document.getElementById("timeline-time");
  function show() {
    if (!data) return;
    const instant = Number(slider.value),
      event = [...data.events].reverse().find((e) => e.sessionTime <= instant),
      run = data.runs.find((r) => r.id === event?.runId);
    const trail = run?.trajectory.filter((p) => p.sessionTime <= instant) ?? [];
    drawBoard(document.getElementById("replay-board"), run, {
      trail,
      marker: trail.at(-1),
      metrics: run?.result
        ? {
            contacts: run.result.contacts.filter(
              (c) => c.sessionTime <= instant,
            ),
            low: run.result.low.filter((e) => e.sessionEnd <= instant),
          }
        : null,
    });
    const rate = data.manifest.config.sampleRate,
      channel = [];
    for (const block of data.eeg.blocks)
      if (
        (block.startIndex / rate) * 1000 <= instant &&
        ((block.startIndex + block.count) / rate) * 1000 >= instant - 4000
      ) {
        for (let i = 0; i < block.count; i++) {
          const t = ((block.startIndex + i) / rate) * 1000;
          if (t <= instant && t >= instant - 4000)
            channel.push(block.channels[0][i]);
        }
      }
    waveform(document.getElementById("replay-eeg"), [channel]);
    text(
      "timeline-caption",
      `${time(instant)} da sessão · ${run?.label ?? "Intervalo / preparação"} · ${event?.type ?? "Sem evento"} · EEG sintético V1`,
    );
  }
  function setData(value, source) {
    validateImport(value);
    data = value;
    slider.max = Math.max(
      1,
      ...data.events.map((e) => e.sessionTime),
      (data.eeg.samples / data.manifest.config.sampleRate) * 1000,
    );
    text(
      "import-status",
      `${source} · sessão ${data.manifest.sessionId}. Inspeção somente leitura; não altera o motor.`,
    );
    show();
  }
  document.getElementById("import").onchange = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 512 * 1024 * 1024)
        throw Error("Arquivo acima do limite de 512 MiB.");
      live = false;
      setData(JSON.parse(await file.text()), "Arquivo importado");
      select.replaceChildren(
        ...data.events.map(
          (e) =>
            new Option(
              `${time(e.sessionTime)} · ${e.type}`,
              String(e.sessionTime),
            ),
        ),
      );
    } catch (error) {
      text("import-status", `Não foi possível importar: ${error.message}`);
    }
  };
  document.getElementById("inspect").onclick = async () => {
    try {
      const value = await loadLive(false, Number(select.value) || 0);
      live = true;
      setData(value, "Dados ao vivo copiados para inspeção");
      slider.value = select.value;
      show();
    } catch (error) {
      text("import-status", error.message);
    }
  };
  async function refreshLive(instant) {
    if (!live) return;
    const id = ++requestId;
    try {
      const value = await loadLive(false, instant);
      if (id !== requestId) return;
      data = value;
      show();
    } catch (error) {
      text("import-status", error.message);
    }
  }
  select.onchange = () => {
    if (data) {
      slider.value = select.value;
      show();
      refreshLive(Number(slider.value));
    }
  };
  slider.oninput = show;
  slider.onchange = () => refreshLive(Number(slider.value));
  return {
    events: (events) => {
      if (document.activeElement === select || (!live && data)) return;
      const value = select.value;
      select.replaceChildren(
        ...events
          .slice(-500)
          .map(
            (e) =>
              new Option(
                `${time(e.sessionTime)} · ${e.type}`,
                String(e.sessionTime),
              ),
          ),
      );
      if (value) select.value = value;
    },
  };
}
export function validateImport(data) {
  if (data?.schemaVersion !== 2)
    throw Error(
      "Versão incompatível. Exportações antigas não contêm dados para as métricas v2.",
    );
  if (
    !data.manifest?.config ||
    ![250, 500].includes(data.manifest.config.sampleRate) ||
    !Array.isArray(data.runs) ||
    data.runs.length > 10 ||
    !Array.isArray(data.events) ||
    data.events.length > 100000 ||
    !Array.isArray(data.eeg?.blocks) ||
    data.eeg.blocks.length > 20000
  )
    throw Error("Estrutura inválida.");
  if (
    !data.events.every(
      (e) =>
        Number.isFinite(e.sessionTime) &&
        e.sessionTime >= 0 &&
        e.sessionTime <= 1800000 &&
        typeof e.type === "string",
    )
  )
    throw Error("Eventos inválidos.");
  for (const r of data.runs)
    if (
      !r.maze ||
      ![7, 10].includes(r.maze.cols) ||
      !Array.isArray(r.walls) ||
      r.walls.length > 250 ||
      !r.walls.every(
        (w) => Array.isArray(w) && w.length === 4 && w.every(Number.isFinite),
      ) ||
      !Array.isArray(r.trajectory) ||
      r.trajectory.length > 40000 ||
      !r.trajectory.every(
        (p) =>
          Number.isFinite(p.sessionTime) &&
          Number.isFinite(p.x) &&
          Number.isFinite(p.y),
      )
    )
      throw Error("Percurso inválido.");
  let expected = 0;
  for (const b of data.eeg.blocks) {
    if (
      !Number.isSafeInteger(b.startIndex) ||
      b.startIndex < expected ||
      !Number.isSafeInteger(b.count) ||
      b.count < 1 ||
      b.count > 500 ||
      !Array.isArray(b.channels) ||
      b.channels.length < 1 ||
      b.channels.length > 8 ||
      !b.channels.every(
        (c) =>
          Array.isArray(c) && c.length === b.count && c.every(Number.isFinite),
      )
    )
      throw Error("Bloco EEG inválido.");
    expected = b.startIndex + b.count;
  }
  return true;
}
