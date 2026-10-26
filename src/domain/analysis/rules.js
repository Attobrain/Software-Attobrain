"use strict";
const { POLICY } = require("./policy");
const LIMIT = "Descrição operacional desta sessão; não identifica causa, atenção ou condição clínica.";
function observations(features, runs, comparable) {
  const output = [];
  const display={contactDensity:"Densidade de episódios",efficiency:"Eficiência da rota no grafo",speed:"Ritmo de execução",cv:"Variabilidade do ritmo",recovery:"Recuperação após contatos",low:"Tempo de baixa movimentação"};
  const ok = (f, key) => f.metrics[key]?.eligibility === "eligible";
  function evidence(f, key) {
    const run = runs.find(r => r.id === f.runId), episodes = (run.result.collisionEpisodes ?? []).filter(e=>key!=="recovery"||!e.censored);
    return { runId: f.runId, label: f.label, metric: key, ...f.metrics[key], episodeIds: key === "contacts" || key === "contactDensity" || key === "recovery" ? episodes.map(e => e.id) : [], eventSeqs: ["contacts","contactDensity","recovery"].includes(key) ? [...new Set(episodes.flatMap(e => e.eventSeqs))] : [], sessionTime: episodes[0]?.sessionTime ?? run.startedAt ?? 0, interval: [run.startedAt, run.endedAt] };
  }
  function emit(ruleId, title, statement, items, criteria, priority = 30, dimension = title, extra = {}) {
    output.push({ id: `${ruleId}:${items.map(e => e.runId).join(":")}`, ruleId, ruleVersion: "2.0", title, dimension, statement, priority, support: "sufficient_for_description", criteria, evidence: items, limitations: [LIMIT], ...extra });
  }
  const tolerance = key => key === "efficiency" ? POLICY.efficiencyPoints : ["contactDensity", "contacts", "excess"].includes(key) ? POLICY.relative : POLICY.patternRelative;
  const changed = (a,b,key) => key === "efficiency" ? Math.abs(b-a) >= tolerance(key) : a === 0 ? b !== 0 : Math.abs(b-a) / Math.abs(a) >= tolerance(key) - 1e-8;
  const difference = (a,b) => ({ absolute: b-a, relative: a === 0 ? null : (b-a)/Math.abs(a) });
  for (const f of features) {
    if (ok(f,"contacts")) emit("observed-contacts", "Controle do percurso", `${f.label}: ${f.metrics.contacts.value} episódio(s) de contato, incluindo os encerrados sem recuperação observada.`, [evidence(f,"contacts")], "Episódios agrupados pela política de contato e recuperação; cobertura válida ≥80%.", 15);
    if (ok(f,"recovery")) emit("recovery-summary", "Recuperação após dificuldades", `${f.label}: recuperação mediana de ${f.metrics.recovery.value.toFixed(2)} s em ${f.metrics.recovery.supportCount} episódios completos.`, [evidence(f,"recovery")], "Três ou mais recuperações completas; episódios censurados excluídos.", 25);
    const total = f.metrics.contacts.value, max = f.spatialEpisodes[0]?.count ?? 0;
    if (ok(f,"contacts") && total >= 3 && max / total >= .5) {
      const regions = f.spatialEpisodes.filter(p => p.count === max);
      emit("spatial-concentration", "Distribuição dos episódios", `${f.label}: ${max} de ${total} episódios começaram na célula ${regions.map(p => p.cell + 1).join(" ou ")}${regions.length > 1 ? " (empate entre regiões)" : ""}.`, [{ ...evidence(f,"contacts"), cells: regions.map(p => p.cell), sessionTime: runs.find(r => r.id === f.runId).result.collisionEpisodes.find(e => e.cell === regions[0].cell)?.sessionTime ?? f.seconds * 1000 }], "Pelo menos três episódios; célula inicial com ≥50% dos episódios. Limiar operacional.", 40);
    }
    if (f.quality.temporalEligible && ok(f,"low")) {
      const run = runs.find(r => r.id === f.runId), m = run.result;
      const later = m.low.reduce((v,e) => v + Math.max(0,e.end-Math.max(e.start,run.active/2)),0);
      if (m.lowMs >= 2000 && later/m.lowMs >= .6) emit("low-second-half", "Continuidade da atividade", `${f.label}: pelo menos 60% do tempo de baixa movimentação ocorreu na segunda metade.`, [{...evidence(f,"low"),secondHalfSeconds:later/1000}], "45 s ativos, 15 s válidos por terço e ≥2 s de baixa movimentação.",35);
      const [first,,last] = f.quality.thirdsCv;
      if (ok(f,"cv") && first > 0 && Number.isFinite(last) && last >= first*1.2) emit("final-cv", "Regularidade da execução", `${f.label}: maior variabilidade da velocidade no terço final.`, [{...evidence(f,"cv"),firstThirdCv:first,lastThirdCv:last}], "Terços elegíveis e CV final pelo menos 20% acima do inicial.",35);
    }
  }
  const completed = features.filter(f => ["A","B","C"].includes(f.label) && f.state === "COMPLETED").sort((a,b)=>a.label.localeCompare(b.label));
  if (comparable) {
    for (const key of ["contactDensity","efficiency","speed","cv","recovery","low"]) {
      const fs = completed.filter(f=>ok(f,key));
      for (let i=1;i<fs.length;i++) {
        const a=fs[i-1],b=fs[i], av=a.metrics[key].value,bv=b.metrics[key].value;
        emit(`pair-${key}`, a.metrics[key].name, `${a.metrics[key].name}: ${av.toFixed(2)} em ${a.label} e ${bv.toFixed(2)} em ${b.label}.`, [evidence(a,key),evidence(b,key)], "Atividades concluídas, métricas elegíveis e geometria operacional compatível.",20,key,{difference:difference(av,bv)});
      }
      if (fs.length !== 3) continue;
      const [a,b,c]=fs, [av,bv,cv]=fs.map(f=>f.metrics[key].value);
      let direction = null;
      if (!changed(av,bv,key) && !changed(bv,cv,key) && !changed(av,cv,key)) direction="permaneceu semelhante";
      else if (av>bv && bv>cv && changed(av,bv,key) && changed(bv,cv,key)) direction="diminuiu progressivamente";
      else if (av<bv && bv<cv && changed(av,bv,key) && changed(bv,cv,key)) direction="aumentou progressivamente";
      else if ((bv-av)*(cv-bv)<0 && changed(av,bv,key) && changed(bv,cv,key)) direction="oscilou";
      if (direction) emit(`trend-${key}`, display[key], `${display[key]} ${direction} entre A, B e C.`, fs.map(f=>evidence(f,key)), `Política ${POLICY.version}; tolerância ${key==="efficiency" ? "5 pontos percentuais" : `${tolerance(key)*100}%`}; referência na atividade anterior, sem percentual quando zero.`,50,key);
    }
    if (completed.length===3 && completed.every(f=>ok(f,"contacts"))) {
      const [a,b,c]=completed;
      if (a.metrics.contacts.value>b.metrics.contacts.value && a.metrics.contacts.value>c.metrics.contacts.value) emit("initial-contact-pattern","Controle do percurso","A atividade A apresentou mais episódios de contato do que B e C.",completed.map(f=>evidence(f,"contacts")),"Três percursos concluídos, episódios elegíveis e conjunto geométrico confirmado.",65,"contacts",{reviewPoint:"Revisar familiarização com a tarefa, estratégia de navegação e uso do dispositivo; o registro não determina qual fator participou do resultado."});
    }
    for (let i=1;i<completed.length;i++) {
      const a=completed[i-1],b=completed[i];
      const keys=["speed","contactDensity","efficiency"];
      if (keys.every(k=>ok(a,k)&&ok(b,k)) && b.metrics.speed.value>a.metrics.speed.value && changed(a.metrics.speed.value,b.metrics.speed.value,"speed")) {
        const contactUp=b.metrics.contactDensity.value>a.metrics.contactDensity.value && changed(a.metrics.contactDensity.value,b.metrics.contactDensity.value,"contactDensity");
        const efficiencyDown=b.metrics.efficiency.value<a.metrics.efficiency.value-POLICY.efficiencyPoints;
        if (contactUp || efficiencyDown) emit("speed-control","Padrão misto",`De ${a.label} para ${b.label}, o ritmo aumentou, acompanhado de ${contactUp ? "maior densidade de episódios" : "menor eficiência da rota no grafo"}.`,keys.flatMap(k=>[evidence(a,k),evidence(b,k)]),"Velocidade aumenta ≥20%; densidade aumenta ≥10% ou eficiência cai mais de 5 pontos.",100,"mixed");
        else if (b.metrics.contactDensity.value<=a.metrics.contactDensity.value && !efficiencyDown) emit("speed-maintained-control","Ritmo e controle",`De ${a.label} para ${b.label}, o ritmo aumentou sem aumento observado da densidade de episódios nem queda relevante da eficiência da rota.`,keys.flatMap(k=>[evidence(a,k),evidence(b,k)]),"Velocidade aumenta ≥20%; densidade não aumenta e eficiência não cai mais de 5 pontos.",70,"mixed");
      }
      if (["duration","contactDensity","excess"].every(k=>ok(a,k)&&ok(b,k)) && b.seconds<a.seconds*.8 && ((b.metrics.contactDensity.value>a.metrics.contactDensity.value && changed(a.metrics.contactDensity.value,b.metrics.contactDensity.value,"contactDensity")) || (b.metrics.excess.value>a.metrics.excess.value && changed(a.metrics.excess.value,b.metrics.excess.value,"excess")))) emit("time-control-mixed","Padrão misto",`De ${a.label} para ${b.label}, o percurso foi concluído mais rapidamente, acompanhado de mais episódios por referência geométrica ou maior distância excedente no grafo.`,["duration","contactDensity","excess"].flatMap(k=>[evidence(a,k),evidence(b,k)]),"Tempo diminui ≥20% e densidade ou excedente aumenta ≥10%; zero usa diferença absoluta.",95,"mixed");
    }
  }
  return output;
}
function selectObservations(observations) {
  const selected=[], groups=new Set();
  for (const o of [...observations].sort((a,b)=>b.priority-a.priority || a.id.localeCompare(b.id))) {
    const group=({contacts:"control",contactDensity:"control",efficiency:"control","Controle do percurso":"control",speed:"regularity",cv:"regularity","Regularidade da execução":"regularity",low:"continuity","Continuidade da atividade":"continuity",recovery:"recovery","Recuperação após dificuldades":"recovery"})[o.dimension]??o.dimension;
    if (groups.has(group)) continue;
    groups.add(group); selected.push(o.id);
    if (selected.length===5) break;
  }
  return selected;
}
module.exports = { observations, selectObservations, POLICY };
