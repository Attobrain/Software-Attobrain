import { escape as esc, number, time, labels } from "./format.js";
const row = (name, value) => `<tr><th>${name}</th><td>${esc(value)}</td></tr>`;
export function metricDetails(m) {
  if (!m) return "Sem dados observados.";
  return `<table class="result-table"><tbody>${[
    row("Tempo ativo / pausado", `${time(m.activeMs)} / ${time(m.pausedMs)}`),
    row(
      "Distância aceita / referência / grafo (larguras)",
      `${number(m.distance)} / ${number(m.reference)} / ${number(m.graphDistance)}`,
    ),
    row("Eficiência no grafo (%)", number(m.efficiency)),
    row(
      "Distância excedente / percentual",
      `${number(m.excess)} / ${number(m.excessPercent)}%`,
    ),
    row(
      "Velocidade média / DP (larguras/s)",
      `${number(m.speed, 4)} / ${number(m.velocity.sd, 4)}`,
    ),
    row("CV da velocidade", number(m.velocity.cv, 3)),
    row(
      "Contatos / minuto / largura",
      `${m.contacts.length} / ${number(m.contactsPerMinute)} / ${number(m.contactsPerDistance)}`,
    ),
    row(
      "Recuperação mediana · Q1 · Q3 (s)",
      `${number(m.recovery.median === null ? null : m.recovery.median / 1000)} · ${number(m.recovery.q1 === null ? null : m.recovery.q1 / 1000)} · ${number(m.recovery.q3 === null ? null : m.recovery.q3 / 1000)}`,
    ),
    row(
      "Recuperações válidas / sem recuperação observada",
      `${m.recovery.valid} / ${m.recovery.censored}`,
    ),
    row(
      "Baixa movimentação: episódios / segundos",
      `${m.low.length} / ${number(m.lowMs / 1000)}`,
    ),
    row(
      "Retrocessos / distância (larguras)",
      `${m.backtracks.length} / ${number(m.backtracks.reduce((v, e) => v + e.distance, 0))}`,
    ),
    row("Mudanças de direção ≥60°", m.directionChanges.length),
  ].join(
    "",
  )}</tbody></table><h4>Evolução por terços de tempo ativo</h4><div class="table-wrap"><table class="result-table"><thead><tr><th>Terço</th><th>Contatos/min</th><th>Velocidade</th><th>CV</th><th>Baixa mov. (s)</th><th>Checkpoints</th></tr></thead><tbody>${m.thirds.map((t, i) => `<tr><td>${i + 1}${t.eligible ? "" : " · &lt;5 s válidos"}</td><td>${number(t.contactsPerMinute)}</td><td>${number(t.speed, 4)}</td><td>${number(t.cv, 3)}</td><td>${number(t.lowMs / 1000)}</td><td>${t.checkpoints}</td></tr>`).join("")}</tbody></table></div><p class="panel-caption">Fórmulas v${m.formulaVersion}. Ausência de dado é indisponível; parâmetros são experimentais. Eficiência exige conclusão.</p>`;
}
export function renderReport(report) {
  if (!report) return;
  const evaluations = report.single?.length ? report.single.map(r => ({ ...r, label: "Exploração" })) : report.evaluations;
  document.getElementById("report-description").textContent =
    report.description;
  document.getElementById("comparison").innerHTML =
    `<div class="table-wrap"><table class="result-table"><thead><tr><th>Atividade</th><th>Situação</th><th>Tempo ativo</th><th>Eficiência (%)</th><th>Contatos/min</th><th>CV</th></tr></thead><tbody>${evaluations.map((r) => `<tr><th>${r.label}</th><td>${esc(r.state === "NOT_PERFORMED" ? "Não realizada" : (labels[r.state] ?? r.state))}</td><td>${time(r.result?.activeMs)}</td><td>${number(r.result?.efficiency)}</td><td>${number(r.result?.contactsPerMinute)}</td><td>${number(r.result?.velocity.cv)}</td></tr>`).join("")}</tbody></table></div><p class="panel-caption">Comparação geométrica operacional. Treinamento excluído. Três tentativas não estimam confiabilidade clínica.</p><details><summary>Agregados e comparações entre pares</summary><pre>${esc(JSON.stringify({ aggregates: report.aggregates, pairs: report.pairs }, null, 2))}</pre></details>`;
  document.getElementById("rules").innerHTML = report.rules.length
    ? report.rules
        .map(
          (r) =>
            `<details><summary>${esc(r.text)}</summary><p>Regra ${esc(r.ruleId)} v${r.version} · ${esc(r.metrics.join(", "))}</p><pre>${esc(JSON.stringify({ values: r.values, runIds: r.runIds }, null, 2))}</pre></details>`,
        )
        .join("")
    : "<p>Sem descrição automática elegível. Consulte os valores observados.</p>";
  document.getElementById("individual-results").innerHTML = [
    ...report.evaluations.filter((r) => r.result),
    ...(report.single ?? []),
  ]
    .map(
      (r) =>
        `<details><summary>Resultado ${esc(r.label ?? "Exploração")} · ${esc(labels[r.state] ?? r.state)}</summary>${metricDetails(r.result)}<canvas class="result-trajectory" data-run="${esc(r.runId)}" width="800" height="800" aria-label="Trajetória individual"></canvas></details>`,
    )
    .join("");
  document.getElementById("training-results").innerHTML =
    report.training
      .map(
        (r, i) =>
          `<details><summary>Tentativa ${i + 1} · ${esc(labels[r.state] ?? r.state)}</summary>${metricDetails(r.result)}</details>`,
      )
      .join("") || "Não realizado.";
}
