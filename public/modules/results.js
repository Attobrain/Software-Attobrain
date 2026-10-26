import { escape as esc, number, time, labels } from "./format.js";
import { metricValue } from "./interpretation-view.js";
const row = (name, value) => `<tr><th>${name}</th><td>${esc(value)}</td></tr>`;
export function metricDetails(m) {
  if (!m) return "Sem dados observados.";
  return `<table class="result-table"><tbody>${[
    row("Tempo ativo / pausado", `${time(m.activeMs)} / ${time(m.pausedMs)}`),
    row(
      "Distância aceita / referência / grafo (larguras)",
      `${number(m.distance)} / ${number(m.reference)} / ${number(m.graphDistance)}`,
    ),
    row("Eficiência da rota no grafo (%) · não mede precisão lateral", number(m.efficiency)),
    row(
      "Distância excedente no grafo / percentual",
      `${number(m.excess)} / ${number(m.excessPercent)}%`,
    ),
    row(
      "Velocidade média / DP (larguras/s)",
      `${number(m.speed, 4)} / ${number(m.velocity.sd, 4)}`,
    ),
    row("CV por passo do motor · técnico, distinto do CV suavizado", number(m.velocity.cv, 3)),
    row("Episódios / eventos / registros por parede", `${m.collisionEpisodeCount ?? "Histórico"} / ${m.collisionEventCount ?? "Histórico"} / ${m.wallContactCount ?? m.contacts.length}`),
    row(
      "Legado: registros por parede / minuto / largura · valores técnicos",
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
  document.getElementById("metric-catalog").innerHTML=(report.analysis?.features??[]).map(f=>`<details><summary>Catálogo de métricas · ${esc(f.label)}</summary>${Object.values(f.metrics).map(m=>`<article class="metric-definition"><h4>${esc(m.name??m.id??"Métrica histórica")}</h4><p>${metricValue(m,true)} · ${esc(m.eligibility)} · ${esc(m.reason??"Critério atendido")}</p><p>${esc(m.definition??"Definição histórica preservada no arquivo original.")}</p><small>Definição ${esc(m.definitionVersion)} · fonte ${esc(m.source??"arquivo histórico")} · suporte ${esc(m.supportCount??"não informado")}</small><p>${(m.limitations??[]).map(esc).join(" ")}</p></article>`).join("")}</details>`).join("")||"<p>Não há catálogo de métricas nesta versão do arquivo.</p>";
  const evaluations = report.single?.length ? report.single.map(r => ({ ...r, label: "Exploração" })) : report.evaluations;
  document.getElementById("report-description").textContent =
    report.description;
  document.getElementById("comparison").innerHTML =
    `<p>${report.analysis?.quality.comparable ? "Compatibilidade geométrica operacional confirmada; valores elegíveis por métrica." : esc(report.analysis?.comparability?.reasons?.join(" ") ?? "Comparação indisponível. Relatório histórico preservado nos detalhes.")}</p><div class="table-wrap"><table class="result-table"><thead><tr><th>Atividade</th><th>Situação</th><th>Tempo ativo</th><th>Episódios</th><th>Densidade</th><th>Eficiência da rota no grafo</th><th>CV suavizado</th></tr></thead><tbody>${evaluations.map(r=>{
      const f=report.analysis?.features.find(f=>f.runId===r.runId), modern=report.analysis?.schemaVersion==="attobrain-interpretation-2.0";
      return `<tr><th>${esc(r.label)}</th><td>${esc(labels[r.state]??r.state)}</td><td>${time(r.result?.activeMs)}</td>${["contacts","contactDensity","efficiency","cv"].map(key=>`<td>${modern?metricValue(f?.metrics[key]):"Definição histórica"}</td>`).join("")}</tr>`;
    }).join("")}</tbody></table></div><p class="panel-caption">Valores individuais elegíveis não implicam comparabilidade. Eficiência no grafo não mede ausência de contatos nem precisão lateral.</p>`;
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
          (r) => {
            const f=report.analysis?.features.find(f=>f.runId===r.runId);
            return `<details><summary>Resultado ${esc(r.label ?? "Exploração")} · ${esc(labels[r.state] ?? r.state)}</summary><canvas class="result-trajectory" data-run="${esc(r.runId)}" width="800" height="800" aria-label="Trajetória e episódios por região"></canvas><p>${(f?.spatialEpisodes??[]).map(p=>`Célula ${p.cell+1}: ${p.count} episódio(s)`).join(" · ")||"Sem distribuição espacial de episódios disponível."}</p><div class="episode-list">${(r.result.collisionEpisodes??[]).map(e=>`<button class="secondary" data-evidence="${e.sessionTime??0}">Episódio ${esc(e.id.split(":").at(-1))} · ${time(e.start)} · ${e.censored?`sem recuperação observada (${esc(e.reason)})`:`recuperação em ${number(e.duration/1000)} s`}</button>`).join("")}</div><details><summary>Métricas calculadas e elegibilidade</summary>${f?`<div class="table-wrap"><table class="result-table"><thead><tr><th>Métrica</th><th>Valor calculado</th><th>Elegibilidade / motivo</th></tr></thead><tbody>${Object.values(f.metrics).map(m=>`<tr><th>${esc(m.name??m.id)}</th><td>${metricValue(m,true)}</td><td>${esc(m.eligibility)} · ${esc(m.reason??"Atende ao critério operacional")}</td></tr>`).join("")}</tbody></table></div>`:""}${metricDetails(r.result)}</details></details>`;
          },
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
