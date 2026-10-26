"use strict";
const { features } = require("./features");
const { observations, selectObservations, POLICY } = require("./rules");
const { comparability } = require("./comparability");
function interpretation(runs, config, setId) {
  const selected=runs.filter(r=>r.label!=="Treinamento" && r.result && r.startedAt!=null);
  const fs=selected.map(features), comparison=comparability(selected,config,setId);
  const complete=selected.filter(r=>r.state==="COMPLETED").length, expected=config.mode==="single"?1:3;
  const obs=observations(fs,selected,comparison.eligible);
  const unavailable=fs.flatMap(f=>Object.entries(f.metrics).filter(([,m])=>m.eligibility!=="eligible").map(([key,m])=>({runId:f.runId,label:f.label,metric:key,name:m.name,eligibility:m.eligibility,reason:m.reason})));
  const dimensions=[
    ["control","Controle do percurso",["contacts","efficiency","contactDensity"]],
    ["regularity","Regularidade da execução",["speed","cv"]],
    ["recovery","Recuperação após dificuldades",["recovery"]],
    ["continuity","Continuidade da atividade",["low"]],
  ].map(([id,title,keys])=>{
    const metrics=fs.flatMap(f=>keys.map(k=>f.metrics[k])), eligible=metrics.filter(m=>m.eligibility==="eligible").length;
    return {id,title,keys,status:metrics.length && eligible===metrics.length?"available":eligible?"partial":"insufficient",reason:eligible?"Consulte valores e suporte por atividade.":unavailable.find(u=>keys.includes(u.metric))?.reason??"Nenhuma atividade avaliativa disponível."};
  });
  dimensions.push({id:"consistency",title:"Consistência entre atividades",keys:[],status:comparison.eligible && complete===3?"available":comparison.eligible?"partial":"insufficient",reason:config.mode==="single"?"Atividade única, sem comparação A/B/C.":comparison.reasons.join(" ")||"Compatibilidade geométrica operacional; cada métrica possui critérios próprios."});
  const qualityReasons=[...new Set(unavailable.filter(u=>["speed","cv","low","contactsPerMinute","recovery"].includes(u.metric)).map(u=>u.reason))];
  if (complete<expected) qualityReasons.unshift(`${complete}/${expected} percursos concluídos; atividades incompletas não entram em tendências.`);
  if (config.mode==="protocol" && !comparison.eligible) qualityReasons.push(...comparison.reasons);
  return {
    schemaVersion:"attobrain-interpretation-2.0",policy:POLICY,
    quality:{status:!fs.length?"insufficient":qualityReasons.length?"limited":"sufficient",performed:selected.length,completed:complete,expected,comparable:comparison.eligible,coverageKnown:fs.length>0&&fs.every(f=>f.quality.coverage!==null),clinicalInference:"not_available",reasons:qualityReasons},
    comparability:comparison,features:fs,dimensions,observations:obs,summary:selectObservations(obs),unavailable,
    reviewPoints:[...new Set(obs.filter(o=>o.reviewPoint).map(o=>o.reviewPoint).concat(obs.some(o=>o.dimension==="mixed")?["Revisar a relação entre ritmo, estratégia de percurso e controle do dispositivo, sem atribuir causa ao padrão misto."]:[]))],
    limitations:["Dados desta sessão; critérios de engenharia, sem validação clínica ou comparação normativa.","Treinamento excluído das comparações.","Mouse é controle de entrada; não é rastreamento ocular.","EEG sintético não representa a fisiologia do participante e não participa desta análise.","Equivalência geométrica operacional não garante dificuldade humana equivalente.",comparison.regional.reason],
    provenance:{input:"mouse",eeg:{source:"synthetic",participantPhysiology:false,interpretationEligible:false},clinicalInference:"not_available"},
  };
}
module.exports={interpretation};
