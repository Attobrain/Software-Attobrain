import { escape as esc, time, labels, sourceLabel } from "./format.js";
import { cell, dash, fmt, seconds, stat, statGroup, metricLabel, metricCard, runsOf, statusNames } from "./report-parts.js";

const count = (value) => (value == null ? "Histórico" : esc(value));
const sec = (ms) => (Number.isFinite(ms) ? ms / 1000 : null);

// Números de uma atividade, em quatro grupos (Tempo, Percurso, Encostes, Movimento) e a evolução em três partes.
export function metricDetails(m) {
  if (!m || !(m.activeMs > 0)) return '<p class="empty-note">Ainda não há dados observados.</p>';
  const recovery = m.recovery ?? {}, velocity = m.velocity ?? {}, low = m.low ?? [], backtracks = m.backtracks ?? [];
  const range = Number.isFinite(recovery.q1) && Number.isFinite(recovery.q3) ? `Entre ${fmt(sec(recovery.q1), 1, " s")} e ${fmt(sec(recovery.q3), 1, " s")}` : "";
  const groups = [
    statGroup("Tempo", [
      stat("Em atividade", seconds(sec(m.activeMs)) ?? dash()),
      stat("Pausado", seconds(sec(m.pausedMs)) ?? dash()),
      stat("Pouco movimento", cell(sec(m.lowMs), 0, " s"), `${low.length} vez(es)`),
      stat("Tempo para retomar", cell(sec(recovery.median), 1, " s"), [range, (recovery.valid || recovery.censored) ? `${recovery.valid ?? 0} retomada(s) observada(s) · ${recovery.censored ?? 0} sem retomada` : ""].filter(Boolean).join(" · ")),
    ]),
    statGroup("Percurso", [
      stat("Caminho direto", cell(m.efficiency, 0, "%"), "Não mede a precisão do movimento"),
      stat("Distância percorrida", cell(m.distance, 2), "larguras do quadro"),
      stat("Menor caminho possível", cell(m.graphDistance, 2), "larguras do quadro"),
      stat("Distância ideal", cell(m.reference, 2), "larguras do quadro"),
      stat("Distância a mais", cell(m.excess, 2), Number.isFinite(m.excessPercent) ? `${fmt(m.excessPercent, 0)}% além do necessário` : ""),
    ]),
    statGroup("Encostes", [
      stat("Encostes na parede", count(m.collisionEpisodeCount)),
      stat("Registros de colisão", count(m.collisionEventCount)),
      stat("Toques na parede", count(m.wallContactCount ?? m.contacts?.length)),
    ]),
    statGroup("Movimento", [
      stat("Velocidade média", cell(m.speed, 3), "larguras do quadro por segundo"),
      stat("Variação da velocidade", cell(velocity.sd, 3)),
      stat("Irregularidade do ritmo", cell(velocity.cv, 2), "Quanto maior, mais irregular"),
      stat("Voltas para trás", String(backtracks.length), `${fmt(backtracks.reduce((v, e) => v + e.distance, 0), 2) ?? "—"} larguras do quadro`),
      stat("Mudanças bruscas de direção", String(m.directionChanges?.length ?? 0)),
    ]),
  ].join("");
  const legacy = `<details class="fold legacy-values"><summary>Cálculo da versão antiga</summary><dl class="stat-grid">${[
    stat("Toques", String(m.contacts?.length ?? 0)),
    stat("Por minuto", cell(m.contactsPerMinute, 2)),
    stat("Por distância", cell(m.contactsPerDistance, 2)),
  ].join("")}</dl></details>`;
  const thirds = (m.thirds ?? [])
    .map(
      (t, i) =>
        `<article class="third-card"><h5>Parte ${i + 1}${t.eligible ? "" : ' <span class="chip chip-limited">poucos dados</span>'}</h5><dl><div><dt>Encostes por minuto</dt><dd>${cell(t.contactsPerMinute, 1)}</dd></div><div><dt>Velocidade</dt><dd>${cell(t.speed, 3)}</dd></div><div><dt>Irregularidade</dt><dd>${cell(t.cv, 2)}</dd></div><div><dt>Pouco movimento</dt><dd>${cell(sec(t.lowMs), 0, " s")}</dd></div><div><dt>Pontos do caminho</dt><dd>${esc(t.checkpoints ?? "—")}</dd></div></dl>${t.eligible ? "" : '<small>Menos de 5 s registrados.</small>'}</article>`,
    )
    .join("");
  return `<div class="stat-groups">${groups}</div>${legacy}<section class="stat-group"><h4>Evolução ao longo da atividade</h4><p class="group-note">A atividade dividida em três partes iguais.</p><div class="third-grid">${thirds || '<p class="empty-note">Sem dados.</p>'}</div></section><p class="panel-caption">Um traço (—) indica dados insuficientes. Os parâmetros são experimentais, e o caminho só é avaliado se o aluno chegar ao fim. Versão do cálculo: ${esc(m.formulaVersion)}.</p>`;
}

function definition(key, m) {
  const value = Number.isFinite(m.value) ? `${fmt(m.value, Math.abs(m.value - Math.round(m.value)) < 1e-6 ? 0 : Math.abs(m.value) < 1 ? 3 : 2)} ${esc(m.unit ?? "")}` : dash(m.reason ?? "Sem dados suficientes");
  const status = m.eligibility ?? "unavailable";
  return `<article class="def-card"><div class="def-head"><h5>${esc(metricLabel(key, m))}</h5><span class="chip chip-${esc(status)}">${esc(statusNames[status] ?? "Indisponível")}</span></div><p class="def-value">${value}</p><p class="def-text">${esc(m.definition ?? "Definição histórica preservada no arquivo original.")}</p>${(m.limitations ?? []).length ? `<p class="def-text">${m.limitations.map(esc).join(" ")}</p>` : ""}<small>${m.reason ? `${esc(m.reason)} · ` : ""}Definição ${esc(m.definitionVersion ?? "histórica")} · fonte: ${esc(sourceLabel(m.source ?? "arquivo histórico"))} · suporte: ${esc(m.supportCount ?? "não informado")}</small></article>`;
}

export function renderReport(report) {
  if (!report) return;
  document.getElementById("metric-catalog").innerHTML =
    (report.analysis?.features ?? []).map((f) => `<details class="fold"><summary>Como cada número é calculado · ${esc(f.label)}</summary><div class="def-grid">${Object.entries(f.metrics).map(([key, m]) => definition(key, m)).join("")}</div></details>`).join("") ||
    '<p class="empty-note">Esta versão do relatório não traz a explicação dos cálculos.</p>';

  document.getElementById("report-description").textContent = report.description;

  const modern = report.analysis?.schemaVersion === "attobrain-interpretation-2.0";
  const runs = runsOf(report);
  const notice = report.analysis?.quality.comparable
    ? "Os labirintos têm estrutura parecida. Valores que não puderam ser calculados aparecem com traço (—)."
    : esc(report.analysis?.comparability?.reasons?.join(" ") ?? "Comparação indisponível. O relatório original foi preservado nos detalhes.");
  const status = `<ul class="run-chips" aria-label="Situação das atividades">${runs.map((r) => `<li class="run-chip"><strong>${esc(r.label)}</strong><span>${esc(labels[r.state] ?? r.state)}</span></li>`).join("")}</ul>`;
  const sections = modern
    ? [
        ["Tempo", ["duration", "recovery", "low"]],
        ["Encostes na parede", ["contacts", "contactsPerMinute", "contactDensity"]],
        ["Percurso", ["efficiency", "backtracks"]],
        ["Movimento", ["speed", "cv"]],
      ].map(([title, keys]) => `<section class="cmp-section"><h3>${title}</h3><div class="cmp-grid">${keys.map((key) => metricCard(key, runs, "h4")).join("")}</div></section>`).join("")
    : `<p class="empty-note">Estes valores usam o cálculo de uma versão antiga e não podem ser comparados aqui. Tempo ativo: ${runs.map((r) => `${esc(r.label)} ${esc(time(r.result?.activeMs))}`).join(" · ")}.</p>`;
  document.getElementById("comparison").innerHTML = `<p class="notice">${notice}</p>${status}${sections}<p class="panel-caption">Ter um valor para cada atividade não significa que elas possam ser comparadas. O caminho direto não diz se houve encostes na parede nem se o movimento foi preciso.</p>`;

  document.getElementById("rules").innerHTML = report.rules.length
    ? report.rules.map((r) => `<details><summary>${esc(r.text)}</summary><p>Regra ${esc(r.ruleId)} v${r.version} · ${esc(r.metrics.join(", "))}</p><pre>${esc(JSON.stringify({ values: r.values, runIds: r.runIds }, null, 2))}</pre></details>`).join("")
    : '<p class="empty-note">Ainda não há descrição automática. Consulte os valores observados.</p>';

  document.getElementById("individual-results").innerHTML = `<div class="run-grid">${[...report.evaluations, ...(report.single ?? [])].filter((r) => r.result)
    .map((r) => {
      const f = report.analysis?.features.find((f) => f.runId === r.runId);
      const episodes = r.result.collisionEpisodes ?? [];
      const regions = (f?.spatialEpisodes ?? []).map((p) => `<li>Região ${p.cell + 1}: ${p.count} vez(es)</li>`).join("");
      const limited = f ? Object.entries(f.metrics).filter(([, m]) => m.eligibility !== "eligible") : [];
      const quick = [
        ["Tempo ativo", seconds(sec(r.result.activeMs)) ?? dash()],
        ["Encostes", count(r.result.collisionEpisodeCount)],
        ["Caminho direto", cell(r.result.efficiency, 0, "%")],
      ].map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
      return `<article class="run-card"><header><h3>${esc(r.label ?? "Exploração")}</h3><span class="chip chip-${r.state === "COMPLETED" ? "eligible" : "limited"}">${esc(labels[r.state] ?? r.state)}</span></header><canvas class="result-trajectory" data-run="${esc(r.runId)}" width="800" height="800" aria-label="Caminho feito e encostes na parede por região, atividade ${esc(r.label ?? "Exploração")}"></canvas><dl class="run-quick">${quick}</dl><div class="run-block"><h4>Onde encostou</h4>${regions ? `<ul class="region-list">${regions}</ul>` : '<p class="empty-note">Sem distribuição por região.</p>'}</div>${episodes.length ? `<details class="fold run-moments"><summary>Momentos para rever (${episodes.length})</summary><div class="episode-list">${episodes.map((e) => `<button class="secondary" data-evidence="${e.sessionTime ?? 0}">Momento ${esc(e.id.split(":").at(-1))} · ${time(e.start)} · ${e.censored ? "sem retomada observada" : `retomou em ${fmt(e.duration / 1000, 1, " s")}`}</button>`).join("")}</div></details>` : '<div class="run-block"><h4>Momentos para rever</h4><p class="empty-note">Nenhum encoste registrado.</p></div>'}<details class="fold"><summary>Números desta atividade</summary>${metricDetails(r.result)}${limited.length ? `<section class="stat-group"><h4>Medidas sem valor completo</h4><ul class="limited-list">${limited.map(([key, m]) => `<li><strong>${esc(metricLabel(key, m))}</strong> ${esc(statusNames[m.eligibility] ?? "Indisponível")}${m.reason ? ` · ${esc(m.reason)}` : ""}</li>`).join("")}</ul></section>` : ""}</details></article>`;
    })
    .join("")}</div>`;

  document.getElementById("training-results").innerHTML =
    report.training.map((r, i) => `<details class="fold"><summary>Treino, tentativa ${i + 1} · ${esc(labels[r.state] ?? r.state)}</summary>${metricDetails(r.result)}</details>`).join("") || '<p class="empty-note">Treino não realizado.</p>';
}
