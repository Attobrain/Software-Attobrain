// Visão de distração para o profissional.
// Aqui só reorganizamos o que o sistema já mede (encostes na parede, momentos parado,
// retornos, tempo para retomar). Nenhuma medida nova é criada.

// Rótulos únicos: os mesmos no monitoramento, nos resultados, no histórico e na impressão.
export const words = {
  distractions: "Distrações",
  perMinute: "Distrações por minuto",
  perStretch: "Distrações por trecho",
  stops: "Momentos parado",
  stopTime: "Tempo parado",
  recovery: "Tempo para retomar o foco",
  returns: "Retornos",
  rhythm: "Oscilação de ritmo",
  directPath: "Caminho direto",
  speed: "Velocidade média",
  activeTime: "Tempo ativo",
};

const comma = (value, digits = 0) => value.toFixed(digits).replace(".", ",");
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export const clock = (ms) => {
  const total = Math.floor((ms + 0.000001) / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

// Números de uma atividade, já no vocabulário de distração.
// "feature" (opcional) vem da análise e diz se o ritmo tem dados suficientes.
export function summarize(result, feature = null) {
  if (!result) return null;
  const active = result.activeMs ?? 0;
  const count = Number.isInteger(result.collisionEpisodeCount) ? result.collisionEpisodeCount : null;
  const rhythm = feature?.metrics?.cv;
  const recovery = result.recovery ?? {};
  return {
    active,
    distractions: count,
    perMinute: count !== null && active > 0 ? count / (active / 60000) : null,
    stops: Array.isArray(result.low) ? result.low.length : null,
    stopSeconds: (result.lowMs ?? 0) / 1000,
    recovery: recovery.median != null ? recovery.median / 1000 : null,
    recoveries: recovery.valid ?? 0,
    returns: Array.isArray(result.backtracks) ? result.backtracks.length : null,
    rhythm: rhythm?.eligibility === "eligible" && Number.isFinite(rhythm.value) ? rhythm.value : null,
  };
}

// Indicadores usados na evolução de A para C. "value" é o que entra na comparação.
export const indicators = [
  {
    key: "distractions", title: words.distractions,
    value: (s) => s.distractions, show: (v) => comma(v), amount: (v) => plural(v, "distração", "distrações"),
  },
  {
    key: "perMinute", title: words.perMinute,
    value: (s) => s.perMinute, show: (v) => comma(v, 1), amount: (v) => `${comma(v, 1)} por minuto`,
  },
  {
    key: "stops", title: words.stops,
    value: (s) => s.stops, show: (v) => comma(v), amount: (v) => plural(v, "momento", "momentos"),
  },
  {
    // Só com três retomadas completas, como no cálculo da análise.
    key: "recovery", title: words.recovery,
    value: (s) => (s.recoveries >= 3 ? s.recovery : null), show: (v) => `${comma(v, 1)} s`, amount: (v) => `${comma(v, 1)} s`,
  },
  {
    key: "returns", title: words.returns,
    value: (s) => s.returns, show: (v) => comma(v), amount: (v) => plural(v, "retorno", "retornos"),
  },
  {
    key: "rhythm", title: words.rhythm,
    value: (s) => s.rhythm, show: (v) => comma(v, 2), amount: (v) => comma(v, 2),
  },
];

// Direção entre a primeira e a última atividade com valor: mudança de até 10% conta como estável.
export function trendOf(items) {
  const valid = items.filter((item) => Number.isFinite(item.value));
  if (valid.length < 2) return null;
  const first = valid[0], last = valid.at(-1), diff = last.value - first.value;
  const top = Math.max(Math.abs(first.value), Math.abs(last.value));
  const sign = top === 0 || Math.abs(diff) <= top * 0.1 ? "same" : diff > 0 ? "up" : "down";
  return { sign, word: { same: "Estável", up: "Aumentou", down: "Diminuiu" }[sign], first, last, diff };
}

// Frase direta, sem julgar: "2 distrações a menos em C do que em A".
export function trendText(trend, indicator) {
  const { first, last, diff, sign } = trend;
  if (sign === "same") {
    return diff === 0
      ? `Igual em ${first.label} e ${last.label} (${indicator.show(last.value)}).`
      : `Quase igual: ${indicator.show(first.value)} em ${first.label} e ${indicator.show(last.value)} em ${last.label}.`;
  }
  return `${indicator.amount(Math.abs(diff))} a ${sign === "down" ? "menos" : "mais"} em ${last.label} do que em ${first.label} (de ${indicator.show(first.value)} para ${indicator.show(last.value)}).`;
}

// Momentos da atividade para rever, do mais longo para o mais curto.
export function moments(result, label = "") {
  const list = [];
  for (const episode of result?.collisionEpisodes ?? []) {
    list.push({
      kind: "distraction", label, sessionTime: episode.sessionTime ?? 0, length: (episode.end ?? episode.start) - episode.start,
      text: episode.censored || episode.duration == null ? "Encostou na parede e não retomou o caminho" : `Encostou na parede e retomou em ${comma(episode.duration / 1000, 1)} s`,
    });
  }
  for (const stop of result?.low ?? []) {
    list.push({ kind: "stop", label, sessionTime: stop.sessionStart ?? 0, length: stop.duration, text: `Ficou parado por ${Math.round(stop.duration / 1000)} s` });
  }
  return list.sort((a, b) => b.length - a.length);
}

// Barras da linha do tempo: faixa 0 = distrações, faixa 1 = parado. Posições em % do tempo total.
export function timelineMarks(result, span) {
  if (!(span > 0)) return [];
  const pct = (ms) => Math.max(0, Math.min(100, (ms / span) * 100));
  const marks = [];
  for (const e of result?.collisionEpisodes ?? [])
    marks.push({ lane: 0, from: pct(e.start), to: pct(e.end ?? e.start), at: e.start });
  for (const e of result?.low ?? [])
    marks.push({ lane: 1, from: pct(e.start), to: pct(e.end), at: e.start });
  return marks;
}

// Linha do tempo em HTML (texto real, funciona bem no celular).
export function timelineHtml(result, active, limitMs) {
  const span = Math.max(limitMs > 0 ? limitMs : 60000, active);
  const lanes = [["Distrações", "hit"], ["Parado", "stop"]];
  const marks = timelineMarks(result, span);
  const track = (index, type) =>
    `<i class="dt-elapsed" style="width:${((active / span) * 100).toFixed(2)}%"></i>${marks
      .filter((m) => m.lane === index)
      .map((m) => `<i class="dt-mark dt-${type}" style="left:${m.from.toFixed(2)}%;width:${Math.max(0, m.to - m.from).toFixed(2)}%" title="${clock(m.at)}"></i>`)
      .join("")}<i class="dt-now" style="left:${((active / span) * 100).toFixed(2)}%"></i>`;
  const rows = lanes
    .map(([name, type], i) => `<div class="dt-lane"><span class="dt-name">${name}</span><div class="dt-track">${track(i, type)}</div></div>`)
    .join("");
  const axis = [0, 1, 2, 3, 4].map((i) => `<span>${clock((span * i) / 4)}</span>`).join("");
  return `${rows}<div class="dt-axis" aria-hidden="true">${axis}</div>`;
}

// Situação neste instante, só com sinais que já existem: encostou e ainda não retomou, ou quase parado.
export function liveStatus(state, trail = []) {
  if (!state || ["IDLE", "READY"].includes(state.state)) return { tone: "idle", title: "Aguardando", detail: "A atividade ainda não começou" };
  if (state.state === "PAUSED") return { tone: "idle", title: "Pausado", detail: "Atividade pausada" };
  if (state.state !== "RUNNING") return { tone: "idle", title: "Finalizada", detail: "A atividade terminou" };
  const open = (state.metrics?.collisionEpisodes ?? []).at(-1);
  if (open && open.reason === "pending")
    return { tone: "alert", title: "Distraído agora", detail: "Encostou na parede e ainda não retomou o caminho" };
  const need = (state.config?.lowSeconds ?? 2) * 1000, limit = state.config?.lowSpeed ?? 0.005;
  const last = trail.at(-1);
  if (last) {
    let path = 0, covered = 0;
    for (let i = trail.length - 1; i > 0 && covered < need; i--) {
      if (trail[i].segment !== trail[i - 1].segment) break;
      path += Math.hypot(trail[i].x - trail[i - 1].x, trail[i].y - trail[i - 1].y);
      covered = last.t - trail[i - 1].t;
    }
    if (covered >= need && path / (covered / 1000) < limit)
      return { tone: "alert", title: "Distraído agora", detail: `Parado há pelo menos ${Math.round(need / 1000)} s` };
  }
  return { tone: "ok", title: "Concentrado", detail: "Seguindo o caminho" };
}

const pauseReasons = { manual: "Pausa solicitada", disconnected: "Conexão interrompida", "student-hidden": "Tela do aluno oculta" };
const controlEvents = { started: "Atividade iniciada", resumed: "Atividade retomada", pause: "Atividade pausada", "run-ended": "Atividade finalizada" };

// Eventos recentes da atividade atual, falando de distração. Os mais novos primeiro.
export function recentItems(events, result, runId, limit = 6) {
  const list = [];
  for (const e of result?.collisionEpisodes ?? []) {
    list.push({ key: `d:${e.id}`, time: e.sessionTime ?? 0, title: "Encostou na parede", detail: "Distração" });
    if (!e.censored && e.duration != null && e.sessionEnd != null)
      list.push({ key: `r:${e.id}`, time: e.sessionEnd, title: "Retomou o caminho", detail: `Retomou em ${comma(e.duration / 1000, 1)} s` });
  }
  for (const e of result?.low ?? [])
    list.push({ key: `p:${e.sessionStart}`, time: e.sessionStart ?? 0, title: `Ficou parado ${Math.round(e.duration / 1000)} s`, detail: "Momento parado" });
  for (const e of events ?? [])
    if (controlEvents[e.type] && e.runId === runId)
      list.push({ key: `e:${e.seq}`, time: e.sessionTime, title: controlEvents[e.type], detail: e.type === "pause" ? (pauseReasons[e.data?.reason] ?? "Pausa automática") : "" });
  return list.sort((a, b) => b.time - a.time).slice(0, limit);
}

// Os textos prontos da análise usam termos técnicos; aqui eles passam para o vocabulário de distração.
const swaps = [
  [/incluindo os encerrados sem recuperação observada/g, "incluindo as que não tiveram retomada observada"],
  [/episódio\(s\) de contato/g, "distração(ões)"],
  [/episódios de contato/g, "distrações"],
  [/episódios completos/g, "retomadas completas"],
  [/recuperação mediana de/g, "tempo mediano para retomar o foco de"],
  [/Densidade de episódios/g, "Distrações por trecho"],
  [/densidade de episódios/g, "distrações por trecho"],
  [/Taxa de episódios/g, "Distrações por minuto"],
  [/episódios/g, "distrações"],
  [/episódio/g, "distração"],
  [/Eficiência da rota no grafo/g, "Caminho direto"],
  [/eficiência da rota no grafo/g, "caminho direto"],
  [/Ritmo de execução/g, "Velocidade"],
  [/Variabilidade do ritmo/g, "Oscilação de ritmo"],
  [/variabilidade da velocidade/g, "oscilação de ritmo"],
  [/Tempo de baixa movimentação/g, "Momentos parado"],
  [/tempo de baixa movimentação/g, "tempo parado"],
  [/baixa movimentação/g, "momentos parado"],
  [/Recuperação após (contatos|dificuldades)/g, "Tempo para retomar o foco"],
  [/Controle do percurso/g, "Distrações"],
];
// Com decimals = true, os números também passam para a vírgula (3.80 vira 3,80).
export function reword(value, decimals = false) {
  const out = swaps.reduce((text, [from, to]) => text.replace(from, to), String(value ?? ""));
  return decimals ? out.replace(/(\d)\.(\d)/g, "$1,$2") : out;
}
