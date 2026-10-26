"use strict";
const { statistics, quantile }=require("./metrics");
const { interpretation }=require("./analysis/report");
// All compatibility projections use the same eligibility-aware analysis.
function consolidate(runs,config,setId) {
  const analysis=interpretation(runs,config,setId);
  const evaluations=["A","B","C"].map(label=>{
    const r=runs.find(r=>r.label===label);
    return r?{label,runId:r.id,state:r.state,result:r.result??null}:{label,state:"NOT_PERFORMED",result:null};
  });
  const aggregates=Object.fromEntries(["contacts","contactDensity","efficiency","speed","cv","recovery","low"].map(key=>[key,{count:0,median:null,range:null,...statistics([]),definitionVersion:null}])),pairs=[];
  if (analysis.quality.comparable) for (const key of ["contacts","contactDensity","efficiency","speed","cv","recovery","low"]) {
    const fs=analysis.features.filter(f=>f.state==="COMPLETED"&&f.metrics[key].eligibility==="eligible");
    const values=fs.map(f=>f.metrics[key].value);
    aggregates[key]={count:values.length,median:quantile(values,.5),range:values.length?Math.max(...values)-Math.min(...values):null,...statistics(values),definitionVersion:fs[0]?.metrics[key].definitionVersion??null};
    for(let i=1;i<fs.length;i++) pairs.push({metric:key,from:fs[i-1].label,to:fs[i].label,difference:fs[i].metrics[key].value-fs[i-1].metrics[key].value});
  }
  return {version:3,analysis,evaluations,aggregates,pairs,comparable:analysis.quality.comparable,
    rules:analysis.observations.map(o=>({ruleId:o.ruleId,version:o.ruleVersion,text:o.statement,metrics:o.evidence.map(e=>e.metric),values:o.evidence.map(e=>e.value),runIds:o.evidence.map(e=>e.runId)})),
    description:"Perfil descritivo da sessão. Métricas e comparações respeitam seus critérios de elegibilidade.",
    training:runs.filter(r=>r.label==="Treinamento").map(r=>({runId:r.id,state:r.state,result:r.result})),
    single:runs.filter(r=>r.label==="Exploração").map(r=>({label:r.label,runId:r.id,state:r.state,result:r.result})),
  };
}
module.exports={consolidate};
