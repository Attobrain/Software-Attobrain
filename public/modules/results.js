import { escape as esc, number, time, labels } from "./format.js";
import { metricValue } from "./interpretation-view.js";
const row = (name, value) => `<tr><th>${name}</th><td>${esc(value)}</td></tr>`;
export function metricDetails(m) {
  if (!m) return "Ainda não há dados observados.";
  return `<table class="result-table"><tbody>${[
    row("Tempo em atividade / pausado", `${time(m.activeMs)} / ${time(m.pausedMs)}`),
    row(
      "Distância percorrida / ideal / menor caminho no labirinto (larguras do quadro)",
      `${number(m.distance)} / ${number(m.reference)} / ${number(m.graphDistance)}`,
    ),
    row("Quão direto foi o caminho (%) · não mede precisão do movimento", number(m.efficiency)),
    row(
      "Distância a mais que o necessário / percentual",
      `${number(m.excess)} / ${number(m.excessPercent)}%`,
    ),
    row(
      "Velocidade média / variação (larguras do quadro por segundo)",
      `${number(m.speed, 4)} / ${number(m.velocity.sd, 4)}`,
    ),
    row("Irregularidade da velocidade (cálculo técnico)", number(m.velocity.cv, 3)),
    row("Encostes na parede: vezes / registros / toques", `${m.collisionEpisodeCount ?? "Histórico"} / ${m.collisionEventCount ?? "Histórico"} / ${m.wallContactCount ?? m.contacts.length}`),
    row(
      "Versão antiga do cálculo: toques / por minuto / por distância (técnico)",
      `${m.contacts.length} / ${number(m.contactsPerMinute)} / ${number(m.contactsPerDistance)}`,
    ),
    row(
      "Tempo para retomar: típico · mais rápidos · mais lentos (s)",
      `${number(m.recovery.median === null ? null : m.recovery.median / 1000)} · ${number(m.recovery.q1 === null ? null : m.recovery.q1 / 1000)} · ${number(m.recovery.q3 === null ? null : m.recovery.q3 / 1000)}`,
    ),
    row(
      "Retomadas observadas / sem retomada observada",
      `${m.recovery.valid} / ${m.recovery.censored}`,
    ),
    row(
      "Quase parado: vezes / segundos",
      `${m.low.length} / ${number(m.lowMs / 1000)}`,
    ),
    row(
      "Voltas para trás / distância (larguras do quadro)",
      `${m.backtracks.length} / ${number(m.backtracks.reduce((v, e) => v + e.distance, 0))}`,
    ),
    row("Mudanças bruscas de direção", m.directionChanges.length),
  ].join(
    "",
  )}</tbody></table><h4>Evolução ao longo da atividade (três partes iguais)</h4><div class="table-wrap"><table class="result-table"><thead><tr><th>Parte</th><th>Encostes por minuto</th><th>Velocidade</th><th>Irregularidade</th><th>Quase parado (s)</th><th>Pontos do caminho</th></tr></thead><tbody>${m.thirds.map((t, i) => `<tr><td>${i + 1}${t.eligible ? "" : " · menos de 5 s registrados"}</td><td>${number(t.contactsPerMinute)}</td><td>${number(t.speed, 4)}</td><td>${number(t.cv, 3)}</td><td>${number(t.lowMs / 1000)}</td><td>${t.checkpoints}</td></tr>`).join("")}</tbody></table></div><p class="panel-caption">Quando não há dado suficiente, o valor aparece como indisponível. Os parâmetros são experimentais. O caminho só é avaliado se o aluno chegar ao fim. (Versão do cálculo: ${m.formulaVersion})</p>`;
}
export function renderReport(report) {
  if (!report) return;
  document.getElementById("metric-catalog").innerHTML=(report.analysis?.features??[]).map(f=>`<details><summary>Como cada número é calculado · ${esc(f.label)}</summary>${Object.values(f.metrics).map(m=>`<article class="metric-definition"><h4>${esc(m.name??m.id??"Métrica histórica")}</h4><p>${metricValue(m,true)} · ${esc(m.eligibility)} · ${esc(m.reason??"Critério atendido")}</p><p>${esc(m.definition??"Definição histórica preservada no arquivo original.")}</p><small>Definição ${esc(m.definitionVersion)} · fonte ${esc(m.source??"arquivo histórico")} · suporte ${esc(m.supportCount??"não informado")}</small><p>${(m.limitations??[]).map(esc).join(" ")}</p></article>`).join("")}</details>`).join("")||"<p>Esta versão do relatório não traz a explicação dos cálculos.</p>";
  const evaluations = report.single?.length ? report.single.map(r => ({ ...r, label: "Exploração" })) : report.evaluations;
  document.getElementById("report-description").textContent =
    report.description;
  document.getElementById("comparison").innerHTML =
    `<p>${report.analysis?.quality.comparable ? "Os labirintos têm estrutura parecida; os valores que puderam ser calculados aparecem abaixo." : esc(report.analysis?.comparability?.reasons?.join(" ") ?? "Comparação indisponível. O relatório original foi preservado nos detalhes.")}</p><div class="table-wrap"><table class="result-table"><thead><tr><th>Atividade</th><th>Situação</th><th>Tempo ativo</th><th>Encostes na parede</th><th>Encostes por distância</th><th>Quão direto foi o caminho</th><th>Irregularidade da velocidade</th></tr></thead><tbody>${evaluations.map(r=>{
      const f=report.analysis?.features.find(f=>f.runId===r.runId), modern=report.analysis?.schemaVersion==="attobrain-interpretation-2.0";
      return `<tr><th>${esc(r.label)}</th><td>${esc(labels[r.state]??r.state)}</td><td>${time(r.result?.activeMs)}</td>${["contacts","contactDensity","efficiency","cv"].map(key=>`<td>${modern?metricValue(f?.metrics[key]):"Cálculo de versão antiga"}</td>`).join("")}</tr>`;
    }).join("")}</tbody></table></div><p class="panel-caption">Ter um valor para cada atividade não significa que elas possam ser comparadas. O caminho direto não diz se houve encostes na parede nem se o movimento foi preciso.</p>`;
  document.getElementById("rules").innerHTML = report.rules.length
    ? report.rules
        .map(
          (r) =>
            `<details><summary>${esc(r.text)}</summary><p>Regra ${esc(r.ruleId)} v${r.version} · ${esc(r.metrics.join(", "))}</p><pre>${esc(JSON.stringify({ values: r.values, runIds: r.runIds }, null, 2))}</pre></details>`,
        )
        .join("")
    : "<p>Ainda não há descrição automática. Consulte os valores observados.</p>";
  document.getElementById("individual-results").innerHTML = [
    ...report.evaluations.filter((r) => r.result),
    ...(report.single ?? []),
  ]
    .map(
          (r) => {
            const f=report.analysis?.features.find(f=>f.runId===r.runId);
            return `<details><summary>Resultado ${esc(r.label ?? "Exploração")} · ${esc(labels[r.state] ?? r.state)}</summary><canvas class="result-trajectory" data-run="${esc(r.runId)}" width="800" height="800" aria-label="Caminho feito e encostes na parede por região"></canvas><p>${(f?.spatialEpisodes??[]).map(p=>`Região ${p.cell+1}: ${p.count} vez(es)`).join(" · ")||"Sem distribuição por região disponível."}</p><div class="episode-list">${(r.result.collisionEpisodes??[]).map(e=>`<button class="secondary" data-evidence="${e.sessionTime??0}">Momento ${esc(e.id.split(":").at(-1))} · ${time(e.start)} · ${e.censored?`sem retomada observada`:`retomou em ${number(e.duration/1000)} s`}</button>`).join("")}</div><details><summary>Números calculados (avançado)</summary>${f?`<div class="table-wrap"><table class="result-table"><thead><tr><th>Medida</th><th>Valor</th><th>Situação / motivo</th></tr></thead><tbody>${Object.values(f.metrics).map(m=>`<tr><th>${esc(m.name??m.id)}</th><td>${metricValue(m,true)}</td><td>${esc(m.eligibility)} · ${esc(m.reason??"Atende ao critério operacional")}</td></tr>`).join("")}</tbody></table></div>`:""}${metricDetails(r.result)}</details></details>`;
          },
    )
    .join("");
  document.getElementById("training-results").innerHTML =
    report.training
      .map(
        (r, i) =>
          `<details><summary>Treino, tentativa ${i + 1} · ${esc(labels[r.state] ?? r.state)}</summary>${metricDetails(r.result)}</details>`,
      )
      .join("") || "Treino não realizado.";
}
