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
            contacts: (run.result.collisionEpisodes ?? run.result.contacts).filter(
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
      `${time(instant)} da sessão · ${run?.label ?? "Intervalo / preparação"} · ${event?.type ?? "Sem evento"} · entrada: mouse`,
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
  document.getElementById("import").onclick = event => { event.target.value = ""; };
  document.getElementById("import").onchange = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 512 * 1024 * 1024)
        throw Error("Arquivo acima do limite de 512 MiB.");
      live = false;
      const value = JSON.parse(await file.text());
      setData(value, "Arquivo importado");
      window.dispatchEvent(new CustomEvent("attobrain-import", { detail: value }));
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
      setData(value, "Dados ao vivo copiados para inspeção");
      slider.value = instant;
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
    reset() { data = null; live = false; slider.value = 0; document.getElementById("import").value = ""; },
    inspectAt(instant, imported = false) {
      slider.value = instant;
      if (imported) { show(); return; }
      live = true;
      refreshLive(instant).then(() => { slider.value = instant; show(); });
    },
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
  if (![2, 3, 4].includes(data?.schemaVersion))
    throw Error(
      "Versão incompatível. Exportações antigas não contêm dados para as métricas v2.",
    );
  if (
    !data.manifest?.config ||
    ![250, 500].includes(data.manifest.config.sampleRate) ||
    ![1, 4, 8].includes(data.manifest.config.channels) ||
    !Array.isArray(data.runs) ||
    data.runs.length > 10 ||
    !Array.isArray(data.events) ||
    data.events.length > 100000 ||
    !Array.isArray(data.eeg?.blocks) ||
    data.eeg.blocks.length > 20000
  )
    throw Error("Estrutura inválida.");
  if (data.schemaVersion >= 3 && (!data.report || !Array.isArray(data.report.evaluations) || !Array.isArray(data.report.training))) throw Error("Relatório inválido.");
  if (data.eeg.spectra !== undefined && (!Array.isArray(data.eeg.spectra) || data.eeg.spectra.length > 2000)) throw Error("Espectros inválidos.");
  const analysis = data.report?.analysis;
  if (analysis && (!analysis.quality || !Array.isArray(analysis.features) || analysis.features.length > 10 || !Array.isArray(analysis.observations) || analysis.observations.length > 1000 || !Array.isArray(analysis.summary) || !Array.isArray(analysis.limitations) || typeof analysis.policy?.version !== "string" || !analysis.observations.every(o => typeof o.statement === "string" && typeof o.criteria === "string" && Array.isArray(o.evidence) && o.evidence.length <= 100 && Array.isArray(o.limitations)))) throw Error("Análise importada inválida.");
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
          Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1,
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
      b.sampleRate !== data.manifest.config.sampleRate ||
      !Array.isArray(b.channels) ||
      b.channels.length < 1 ||
      b.channels.length > 8 ||
      b.channels.length !== data.manifest.config.channels ||
      !b.channels.every(
        (c) =>
          Array.isArray(c) && c.length === b.count && c.every(Number.isFinite),
      )
    )
      throw Error("Bloco EEG inválido.");
    expected = b.startIndex + b.count;
  }
  if (data.schemaVersion===4) validateV4(data);
  return true;
}
function validateV4(data) {
  const a=data.report?.analysis;
  if (!a || a.schemaVersion!=="attobrain-interpretation-2.0" || !Array.isArray(a.dimensions) || !Array.isArray(a.unavailable) || !Array.isArray(a.reviewPoints)) throw Error("Análise v4 ausente ou incompatível.");
  const runs=new Map(data.runs.map(r=>[r.id,r]));
  if(data.runs.some(r=>typeof r.id!=="string"))throw Error("Identificador de execução inválido.");
  for(const key of ["performed","completed","expected"])if(!Number.isInteger(a.quality[key])||a.quality[key]<0||a.quality[key]>10)throw Error("Qualidade inválida.");
  if(runs.size!==data.runs.length) throw Error("Execuções duplicadas.");
  const events=new Map();
  let lastSeq=0,lastTime=0;
  for(const e of data.events) {if(!Number.isSafeInteger(e.seq)||e.seq<=lastSeq||e.sessionTime<lastTime||events.has(e.seq))throw Error("Sequência de eventos inválida.");events.set(e.seq,e);lastSeq=e.seq;lastTime=e.sessionTime;}
  const episodes=new Map();
  for(const r of data.runs) {
    if(!Array.isArray(r.result?.collisionEpisodes)) throw Error("Episódios v4 ausentes.");
    for(const e of r.result.collisionEpisodes) {
      if(typeof e.id!=="string"||episodes.has(e.id)||!Number.isFinite(e.start)||!Number.isFinite(e.end)||e.end<e.start||!Array.isArray(e.eventSeqs)||!e.position||![e.position.x,e.position.y].every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw Error("Episódio inválido.");
      if(e.eventSeqs.some(seq=>events.get(seq)?.runId!==r.id||events.get(seq)?.type!=="contact"))throw Error("Referência de episódio inválida.");
      episodes.set(e.id,r.id);
    }
    if(r.result.collisionEpisodeCount!==r.result.collisionEpisodes.length)throw Error("Contagem de episódios inconsistente.");
    if(!Array.isArray(r.result.contacts)||r.result.wallContactCount!==r.result.contacts.length||r.result.collisionEventCount!==data.events.filter(e=>e.runId===r.id&&e.type==="contact").length)throw Error("Contagens de contato inconsistentes.");
  }
  const statuses=["eligible","limited","insufficient","unavailable"];
  for(const f of a.features) {
    if(!runs.has(f.runId)||!f.metrics)throw Error("Origem de métrica inválida.");
    for(const m of Object.values(f.metrics)) if(typeof m.id!=="string"||typeof m.name!=="string"||typeof m.definition!=="string"||typeof m.definitionVersion!=="string"||typeof m.source!=="string"||!Array.isArray(m.limitations)||!statuses.includes(m.eligibility)||(m.supportCount!==null&&(!Number.isInteger(m.supportCount)||m.supportCount<0))||(m.value!==null&&!Number.isFinite(m.value)))throw Error("Métrica v4 inválida.");
  }
  const observations=new Set();
  for(const o of a.observations) {
    if(observations.has(o.id)||typeof o.ruleId!=="string"||typeof o.ruleVersion!=="string")throw Error("Regra inválida ou duplicada.");
    observations.add(o.id);
    for(const e of o.evidence) if(!runs.has(e.runId)||!a.features.find(f=>f.runId===e.runId)?.metrics[e.metric]||(e.eventSeqs??[]).some(seq=>events.get(seq)?.runId!==e.runId)||(e.episodeIds??[]).some(id=>episodes.get(id)!==e.runId))throw Error("Referência de evidência inválida.");
  }
  if(a.summary.length>5||a.summary.some(id=>!observations.has(id)))throw Error("Resumo inválido.");
}
