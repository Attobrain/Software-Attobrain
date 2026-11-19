// Peças de apresentação do relatório: só formatam números já calculados.
// Nada aqui recalcula métricas, regras ou critérios do motor de análise.
import { escape as esc } from "./format.js";
import { words } from "./distraction.js";

export const friendly = {
  contacts: words.distractions,
  wallContacts: "Toques na parede",
  collisionEvents: "Registros de contato",
  duration: words.activeTime,
  efficiency: words.directPath,
  excess: "Distância a mais",
  backtracks: words.returns,
  speed: words.speed,
  cv: words.rhythm,
  low: words.stopTime,
  contactsPerMinute: words.perMinute,
  recovery: words.recovery,
  contactDensity: words.perStretch,
};
export const statusNames = { eligible: "Disponível", limited: "Limitado", insufficient: "Dados insuficientes", unavailable: "Indisponível" };
export const metricLabel = (key, m) => friendly[key] ?? m?.name ?? key ?? "Medida";

const clean = (v) => (Math.abs(v) < 1e-9 ? 0 : v);
const ptNumber = (v, digits) => clean(v).toFixed(digits).replace(".", ",");
export const dash = (why = "Sem dados suficientes") =>
  `<span class="nodata"><span aria-hidden="true">—</span><span class="sr-only">${esc(why)}</span></span>`;
export const fmt = (v, digits = 0, unit = "") => (Number.isFinite(v) ? `${ptNumber(v, digits)}${unit}` : null);
export const cell = (v, digits = 0, unit = "") => fmt(v, digits, unit) ?? dash();
export const seconds = (s) => {
  if (!Number.isFinite(s)) return null;
  const total = Math.round(s);
  return total >= 60 ? `${Math.floor(total / 60)} min ${String(total % 60).padStart(2, "0")} s` : `${total} s`;
};

// Valor de uma métrica só quando ela atende ao critério do motor; caso contrário, null.
export function eligibleValue(feature, key) {
  const m = feature?.metrics?.[key];
  return m && m.eligibility === "eligible" && Number.isFinite(m.value) ? m.value : null;
}

const colors = ["#6941c6", "#16aaad", "#d98a0f", "#8b5cf6"];
// Direção entre a primeira e a última atividade com valor, em palavras neutras (sem julgar melhor/pior).
function direction(values) {
  const valid = values.filter(Number.isFinite);
  if (valid.length < 2) return null;
  const first = valid[0], last = valid.at(-1), top = Math.max(Math.abs(first), Math.abs(last));
  if (top === 0 || Math.abs(last - first) <= top * 0.1) return { sign: "same", text: "Estável" };
  return last > first ? { sign: "up", text: "Aumentou" } : { sign: "down", text: "Diminuiu" };
}
const arrows = { up: "↑", down: "↓", same: "→" };

// items: [{ label, value (número ou null), text (HTML do valor) }]
export function compareCard({ title, hint, items, trend = true, tag = "h4" }) {
  const max = Math.max(...items.map((i) => (Number.isFinite(i.value) ? i.value : 0)), 0);
  const dir = trend ? direction(items.map((i) => i.value)) : null;
  const rows = items
    .map((item, index) => {
      const width = Number.isFinite(item.value) && max > 0 ? Math.max(item.value > 0 ? 4 : 0, (item.value / max) * 100) : 0;
      return `<li><span class="cmp-label">${esc(item.label)}</span><span class="cmp-track" aria-hidden="true"><i style="--w:${width.toFixed(1)}%;--c:${colors[index % colors.length]}"></i></span><strong class="cmp-value">${item.text}</strong></li>`;
    })
    .join("");
  const first = items.find((i) => Number.isFinite(i.value)), last = [...items].reverse().find((i) => Number.isFinite(i.value));
  return `<article class="cmp-card"><header><${tag}>${esc(title)}</${tag}>${dir ? `<span class="trend trend-${dir.sign}"><span aria-hidden="true">${arrows[dir.sign]}</span> ${dir.text} <span class="sr-only">de ${esc(first.label)} para ${esc(last.label)}</span></span>` : ""}</header><ul class="cmp-bars">${rows}</ul>${hint ? `<p class="cmp-hint">${esc(hint)}</p>` : ""}</article>`;
}

// Atividades do relatório (A, B, C ou Exploração) com o resultado e as métricas de cada uma.
export function runsOf(report) {
  const evaluations = report?.single?.length ? report.single.map((r) => ({ ...r, label: "Exploração" })) : report?.evaluations ?? [];
  return evaluations.map((r) => ({
    label: r.label,
    state: r.state,
    result: r.result,
    feature: report?.analysis?.features?.find((f) => f.runId === r.runId),
  }));
}
export const specs = {
  duration: { title: words.activeTime, hint: "Tempo em atividade, sem as pausas", format: (v) => seconds(v) },
  contacts: { title: words.distractions, hint: "Vezes em que o aluno encostou na parede", format: (v) => fmt(v, 0) },
  contactsPerMinute: { title: words.perMinute, hint: "Frequência das distrações ao longo da atividade", format: (v) => fmt(v, 1) },
  contactDensity: { title: words.perStretch, hint: "Distrações a cada 10 larguras de corredor", format: (v) => fmt(v, 1) },
  efficiency: { title: words.directPath, hint: "Quanto o caminho foi direto até a chegada", format: (v) => fmt(v, 0, "%") },
  backtracks: { title: words.returns, hint: "Trechos em que o aluno perdeu o caminho e voltou", format: (v) => fmt(v, 0) },
  speed: { title: words.speed, hint: "Larguras do quadro por segundo", format: (v) => fmt(v, 3) },
  cv: { title: words.rhythm, hint: "Quanto maior, mais o ritmo oscilou", format: (v) => fmt(v, 2) },
  recovery: { title: words.recovery, hint: "Tempo típico para voltar a andar após encostar", format: (v) => fmt(v, 1, " s") },
  low: { title: words.stopTime, hint: "Soma dos segundos parado", format: (v) => fmt(v, 0, " s") },
};
export function metricCard(key, runs, tag) {
  const spec = specs[key];
  const items = runs.map((run) => {
    const value = key === "duration" && Number.isFinite(run.result?.activeMs) ? run.result.activeMs / 1000 : eligibleValue(run.feature, key);
    const why = run.feature?.metrics?.[key]?.reason ?? "Sem dados suficientes";
    return { label: run.label, value, text: Number.isFinite(value) ? spec.format(value) : dash(why) };
  });
  return compareCard({ title: spec.title, hint: spec.hint, items, tag });
}

// Grupo de números detalhados: cartões pequenos com rótulo curto e valor.
export const stat = (label, value, note = "") =>
  `<div class="stat"><dt>${esc(label)}</dt><dd>${value}</dd>${note ? `<small>${note}</small>` : ""}</div>`;
export const statGroup = (title, stats) =>
  `<section class="stat-group"><h4>${esc(title)}</h4><dl class="stat-grid">${stats.join("")}</dl></section>`;
