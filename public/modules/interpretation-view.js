import { escape as esc, number, sourceLabel, labels, time } from "./format.js";
import { dash, eligibleValue, metricCard, metricLabel, runsOf, specs } from "./report-parts.js";
import { words, indicators, summarize, trendOf, trendText, moments, reword, plural } from "./distraction.js";
const statusNames={eligible:"Disponível",limited:"Limitado",insufficient:"Dados insuficientes",unavailable:"Indisponível"};
export function metricValue(m, technical=false) {
  if (!m) return "Indisponível";
  if (!technical && m.eligibility!=="eligible") return statusNames[m.eligibility]??"Indisponível";
  const digits=m.id?.endsWith("Count")?0:m.id==="smoothedSpeedCv"?3:m.id==="validInputSpeed"?4:2;
  return m.value==null?"Indisponível":`${number(m.value,digits)} ${esc(reword(m.unit))}`;
}
function observation(o) {
  return `<details class="explanation" data-observation-id="${esc(o.id)}"><summary>${esc(reword(o.statement,true))}</summary><p>${esc(reword(o.criteria))}</p><div class="evidence-values">${o.evidence.map(e=>`<article><strong>${esc(e.label)} · ${esc(metricLabel(e.metric,e))}</strong><p>${metricValue(e,true)}</p><small>${e.supportCount==null?"Suporte descrito no critério":`${e.supportCount} registro(s) de suporte`}</small><button class="secondary" data-evidence="${Number(e.sessionTime)||0}">Ver o percurso neste momento</button></article>`).join("")}</div><p>${o.limitations.map(esc).join(" ")}</p><details><summary>Detalhes técnicos (avançado)</summary><p>${esc(o.ruleId)} · versão ${esc(o.ruleVersion)} · ${esc(o.support)}</p>${o.evidence.map(e=>`<p>${esc(e.label)}: ${esc(sourceLabel(e.source))} · definição ${esc(e.definitionVersion??"histórica")} · episódios ${esc((e.episodeIds??[]).join(", ")||"não associados")} · eventos ${esc((e.eventSeqs??[]).join(", ")||"não associados")}</p>`).join("")}</details></details>`;
}
const dimensionNames={available:"Disponível",partial:"Parcial",insufficient:"Insuficiente"};
const dimensionTitles={control:"Distrações e caminho",regularity:"Ritmo",recovery:words.recovery,continuity:words.stops,consistency:"Consistência entre atividades"};
function dimensionCard(d,features) {
  const valueOf=(f,key)=>{const m=f.metrics?.[key],v=eligibleValue(f,key);return Number.isFinite(v)?(specs[key]?.format(v)??esc(metricValue(m))):dash(m?.reason??"Sem dados suficientes");};
  const reasons=[...new Set(features.flatMap(f=>d.keys.map(key=>f.metrics?.[key]).filter(m=>m&&m.eligibility!=="eligible"&&m.reason).map(m=>m.reason)))];
  const matrix=d.keys.length?`<details class="fold"><summary>Ver valores</summary><table class="mini-matrix"><thead><tr><th scope="col"><span class="sr-only">Medida</span></th>${features.map(f=>`<th scope="col">${esc(f.label)}</th>`).join("")}</tr></thead><tbody>${d.keys.map(key=>`<tr><th scope="row">${esc(metricLabel(key,features[0]?.metrics?.[key]))}</th>${features.map(f=>`<td>${valueOf(f,key)}</td>`).join("")}</tr>`).join("")}</tbody></table>${reasons.length?`<p class="matrix-note">Sem valor: ${reasons.map(esc).join(" ")}</p>`:""}</details>`:"";
  return `<article class="dimension-card"><div class="dimension-top"><h3>${esc(dimensionTitles[d.id]??d.title)}</h3><span class="dimension-status status-${esc(d.status)}">${dimensionNames[d.status]??"Indisponível"}</span></div>${d.status!=="available"||!d.keys.length?`<p class="dimension-reason">${esc(d.reason)}</p>`:""}${matrix}</article>`;
}

// Um cartão por atividade, com os indicadores de distração.
function distractionCard(run) {
  const s=summarize(run.result,run.feature), name=run.label==="Exploração"?"Exploração":`Atividade ${run.label}`;
  const chip=`<span class="chip chip-${run.state==="COMPLETED"?"eligible":"limited"}">${esc(labels[run.state]??run.state)}</span>`;
  if (!s) return `<article class="cmp-card distraction-card"><header><h3>${esc(name)}</h3>${chip}</header><p class="empty-note">Atividade não realizada.</p></article>`;
  const recoveryNote=s.recovery!==null&&s.recoveries<3?`<small>só ${plural(s.recoveries,"retomada","retomadas")}</small>`:"";
  const rows=[
    [words.stops,`${s.stops}<small>${s.stops?`${Math.round(s.stopSeconds)} s no total`:"nenhum"}</small>`],
    [words.recovery,`${s.recovery===null?dash("Nenhuma retomada observada"):`${s.recovery.toFixed(1).replace(".",",")} s`}${recoveryNote}`],
    [words.returns,String(s.returns)],
    [words.rhythm,s.rhythm===null?dash("Sem dados suficientes"):s.rhythm.toFixed(2).replace(".",",")],
  ].map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
  const rate=s.perMinute===null?"":`${s.perMinute.toFixed(1).replace(".",",")} por minuto`;
  return `<article class="cmp-card distraction-card"><header><h3>${esc(name)}</h3>${chip}</header><p class="kpi-big"><strong>${s.distractions===null?"—":s.distractions}</strong><span>${s.distractions===1?"distração":"distrações"}</span></p><p class="cmp-hint">${esc([rate,s.active>0?`${time(s.active)} de atividade`:""].filter(Boolean).join(" · "))}</p><dl class="distraction-stats">${rows}</dl></article>`;
}

// Como cada indicador mudou entre a primeira e a última atividade concluída.
function evolution(runs,a) {
  const single=runs.length<2||runs.some(r=>r.label==="Exploração");
  if (single) return {lead:"",list:""};
  const done=runs.filter(r=>r.state==="COMPLETED"&&r.result);
  const left=runs.length-done.length;
  if (!a.quality.comparable) return {lead:`<p class="notice">${esc(a.comparability?.reasons?.join(" ")||"Os labirintos não são equivalentes, por isso não há evolução de A para C.")}</p>`,list:""};
  if (done.length<2) return {lead:`<p class="notice">A evolução aparece quando duas ou mais atividades forem concluídas.</p>`,list:""};
  const items=indicators.map(ind=>{
    const values=done.map(r=>({label:r.label,value:ind.value(summarize(r.result,r.feature))}));
    const trend=trendOf(values);
    return trend?{ind,values,trend}:null;
  }).filter(Boolean);
  if (!items.length) return {lead:"",list:""};
  const main=items.find(i=>i.ind.key==="distractions")??items[0];
  const arrows={up:"↑",down:"↓",same:"→"};
  const chip=t=>`<span class="trend trend-${t.sign}"><span aria-hidden="true">${arrows[t.sign]}</span> ${t.word}</span>`;
  const list=items.map(({ind,values,trend})=>`<li><div class="evo-head"><strong>${esc(ind.title)}</strong>${chip(trend)}</div><p class="evo-values">${values.map(v=>`<span><b>${esc(v.label)}</b> ${Number.isFinite(v.value)?esc(ind.show(v.value)):"—"}</span>`).join("")}</p><p class="evo-text">${esc(trendText(trend,ind))}</p></li>`).join("");
  return {
    lead:`<div class="evolution"><p class="evolution-lead">${chip(main.trend)} <strong>${esc(main.ind.title)}:</strong> ${esc(trendText(main.trend,main.ind))}</p>${left?`<p class="cmp-hint">${plural(left,"atividade não concluída ficou","atividades não concluídas ficaram")} fora da evolução.</p>`:""}</div>`,
    list:`<details class="fold evolution-list" open><summary>Evolução de A para C, indicador por indicador</summary><ul class="evo-list">${list}</ul></details>`,
  };
}

// Os momentos mais longos de distração, com atalho para ver o percurso naquele instante.
function topMoments(runs) {
  const list=runs.flatMap(r=>moments(r.result,r.label)).sort((a,b)=>b.length-a.length).slice(0,5);
  const body=list.length
    ?`<ol class="moment-list">${list.map(m=>`<li><span class="moment-run">${esc(m.label)}</span><div><strong>${esc(m.text)}</strong><span>${time(m.sessionTime)} da sessão</span></div><button class="secondary moment-link" data-evidence="${Number(m.sessionTime)||0}">Ver o percurso neste momento</button></li>`).join("")}</ol>`
    :'<p class="empty-note">Nenhuma distração registrada nas atividades.</p>';
  return `<section class="card top-moments"><div class="section-heading"><div><span class="eyebrow">PARA REVER</span><h2>Momentos de maior distração</h2></div></div>${body}</section>`;
}

export function interpretationView(report,participant,sessionId,imported=false,endReason=null) {
  const a=report?.analysis;
  if (!a) return `<section class="card"><h2>Análise indisponível</h2><p>${esc(report?.analysisError??"Este arquivo não traz a análise pronta. Os registros originais continuam disponíveis.")}</p>${!imported?'<button data-flow="reanalyze">Gerar análise novamente</button>':""}</section>`;
  const historical=a.schemaVersion!=="attobrain-interpretation-2.0";
  const quality={sufficient:"Descrição disponível",limited:"Descrição parcial",insufficient:"Dados insuficientes"}[a.quality.status]??"Qualidade indisponível";
  const dimensions=a.dimensions??[];
  const runs=runsOf(report);
  const header=`<section class="card objective-profile"><div class="profile-heading"><div class="profile-identity"><div><span class="eyebrow">RESUMO DA SESSÃO</span><h2>${esc(participant?.name??"Participante demonstrativo")}</h2></div></div><span class="analysis-status status-${esc(a.quality.status)}">${quality}</span></div></section>`;
  const cards=runs.length?runs.map(distractionCard).join(""):'<p class="empty-note">Nenhuma atividade realizada.</p>';
  const evo=evolution(runs,a);
  const distraction=`<section class="card distraction-summary" aria-labelledby="kpi-title"><div class="section-heading"><div><span class="eyebrow">ATENÇÃO NA SESSÃO</span><h2 id="kpi-title">Distrações em cada atividade</h2></div></div>${evo.lead}<div class="distraction-grid">${cards}</div>${evo.list}</section>`;
  const review=a.reviewPoints?.length?`<section class="card review-points"><h2>Pontos para revisão profissional</h2><ul>${a.reviewPoints.map(p=>`<li>${esc(reword(p))}</li>`).join("")}</ul></section>`:"";
  const game=`<details class="card game-data" id="activity-data-panel"><summary>Dados da atividade</summary><div class="kpi-grid">${(historical?["duration"]:["duration","efficiency","speed"]).map(key=>metricCard(key,runs,"h3")).join("")}</div>${dimensions.length?`<div class="dimension-grid">${dimensions.map(d=>dimensionCard(d,a.features)).join("")}</div>`:""}</details>`;
  const evidence=`<details class="card observation-evidence" id="observations-panel"><summary>Observações do sistema e critérios (${a.observations.length})</summary>${a.observations.map(observation).join("")||"<p>Não há padrões elegíveis para explicar.</p>"}</details>`;
  return `${header}${distraction}${topMoments(runs)}${review}${game}${evidence}`;
}
