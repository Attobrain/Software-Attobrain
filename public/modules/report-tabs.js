export function createReportTabs(technical, notes) {
  const root=document.getElementById("result-panel"), session=document.getElementById("session-view");
  const nav=document.createElement("nav"); nav.className="report-tabs"; nav.setAttribute("role","tablist");nav.setAttribute("aria-label","Seções do relatório");
  const panels={};
  for(const [id,label] of [["summary","Resumo"],["comparison","Comparação"],["evidence","Percursos"],["technical","Detalhes técnicos"]]) {
    const button=document.createElement("button");button.id=`tab-${id}`;button.type="button";button.textContent=label;button.dataset.reportTab=id;button.setAttribute("role","tab");button.setAttribute("aria-controls",`report-${id}`);nav.append(button);
    const panel=document.createElement("section");panel.id=`report-${id}`;panel.className="report-tab-panel";panel.setAttribute("role","tabpanel");panel.setAttribute("aria-labelledby",button.id);panels[id]=panel;root.append(panel);
  }
  nav.querySelector("#tab-technical").hidden=true; // Detalhes técnicos ficam fora do MVP.
  root.querySelector(".page-heading").after(nav);
  panels.summary.append(document.getElementById("interpretation"),notes);
  const comparisonCard=document.createElement("section");comparisonCard.className="card";comparisonCard.innerHTML="<h2>Comparação entre atividades</h2>";
  for(const id of ["report-description","comparison"]) comparisonCard.append(document.getElementById(id));const chartFold=document.createElement("details");chartFold.className="fold";chartFold.innerHTML="<summary>Ver em gráfico de barras</summary>";chartFold.append(document.getElementById("comparison-chart"));comparisonCard.append(chartFold);
  panels.comparison.append(comparisonCard);
  const evidence=document.createElement("section");evidence.className="card";evidence.innerHTML="<h2>Percursos e momentos</h2>";
  evidence.append(document.getElementById("individual-results"));panels.evidence.append(evidence);
  panels.technical.insertAdjacentHTML("beforeend",'<p class="tab-intro">Para conferir como cada número foi calculado. Não é necessário para ler o resultado.</p>');panels.technical.append(document.getElementById("result-technical"));
  const eegWindow=document.createElement("details");eegWindow.className="card";eegWindow.innerHTML="<summary>Sinal simulado no momento escolhido</summary>";
  eegWindow.append(document.getElementById("replay-eeg").parentElement);document.getElementById("diagnostics").append(eegWindow);
  document.getElementById("rules").hidden=true;
  let active="summary";
  function activate(id,focus=false) {
    active=id;
    for(const [key,panel] of Object.entries(panels)) {panel.hidden=key!==id;const b=document.getElementById(`tab-${key}`);b.setAttribute("aria-selected",String(key===id));b.tabIndex=key===id?0:-1;}
    if(focus) document.getElementById(`tab-${id}`).focus();
  }
  nav.onclick=e=>{const b=e.target.closest("[data-report-tab]");if(b)activate(b.dataset.reportTab);};
  nav.onkeydown=e=>{const ids=Object.keys(panels).filter(k=>k!=="technical"),i=ids.indexOf(active);if(["ArrowLeft","ArrowRight","Home","End"].includes(e.key)){e.preventDefault();activate(e.key==="Home"?ids[0]:e.key==="End"?ids.at(-1):ids[(i+(e.key==="ArrowRight"?1:ids.length-1))%ids.length],true);}};
  activate("summary");
  return {activate,show(result){
    const timeline=document.getElementById("timeline");
    if(result){if(timeline.parentElement!==panels.evidence)panels.evidence.append(timeline);if(technical.parentElement!==panels.technical)panels.technical.append(technical);technical.hidden=false;}
    else{if(timeline.parentElement!==technical)technical.prepend(timeline);if(technical.parentElement!==session)session.append(technical);}
  }};
}
