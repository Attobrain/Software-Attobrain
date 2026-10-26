"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {describe,setFor}=require("../domain/mazes");
const {analyze}=require("../domain/metrics");
const {features}=require("../domain/analysis/features");
const {interpretation}=require("../domain/analysis/report");
const {consolidate}=require("../domain/report");
const {Session}=require("../domain/session");
const {configuration}=require("../validators/config");
const {freshWalls}=require("../domain/contacts");
const cfg=configuration();
// Controlled accepted-step fixtures: no participant and no physiological data.
function run(label="A",seconds=12,hits={}) {
 const d=describe(7,setFor(7).candidates[["A","B","C"].indexOf(label)].seed);
 const p=cell=>({x:(cell%7+.5)/7,y:(Math.floor(cell/7)+.5)/7});
 const start=p(0),next=p(d.path[1]);
 const steps=Array.from({length:seconds*20},(_,i)=>({...(i>=20?next:start),from:i===20?start:(i>20?next:start),dt:50,t:(i+1)*50,sessionTime:1000+(i+1)*50,segment:0,validInput:true,hits:hits[i]??[],cells:i===20?[d.path[1]]:[]}));
 const r={...d,id:label,label,state:"COMPLETED",active:seconds*1000,startedAt:1000,endedAt:1000+seconds*1000,sessionNow:1000+seconds*1000,steps,events:[],trajectory:steps.map(s=>({x:s.x,y:s.y,t:s.t,sessionTime:s.sessionTime,segment:s.segment})),pauses:[],progress:100,executionConfig:cfg,setId:setFor(7).id};
 let last=new Map(),seq=1;
 for(const s of steps){const walls=freshWalls(s.hits,last,s.t);if(walls.length)r.events.push({seq:seq++,runId:r.id,type:"contact",activeTime:s.t,sessionTime:s.sessionTime,data:{walls,position:{x:s.x,y:s.y}}});}
 r.result=analyze(r,cfg);return r;
}
test("esquina: duas paredes, um evento, um episódio com evidências sem duplicação",()=>{
 const r=run("A",12,{0:[1,2],1:[1,2]});r.events.push({...r.events[0]});r.result=analyze(r,cfg);
 assert.equal(r.result.wallContactCount,2);assert.equal(r.result.collisionEventCount,1);assert.equal(r.result.collisionEpisodeCount,1);
 assert.deepEqual(r.result.collisionEpisodes[0].eventSeqs,[1]);assert.equal(r.result.recovery.valid,1);
});
test("contatos próximos e recontagem de parede não inventam episódios",()=>{
 const r=run("A",12,{0:[1],1:[1],6:[1]});
 assert.equal(r.result.wallContactCount,2);assert.equal(r.result.collisionEventCount,2);assert.equal(r.result.collisionEpisodeCount,1);
 assert.deepEqual(r.result.collisionEpisodes[0].eventSeqs,[1,2]);
});
test("recuperação efetiva separa episódios; pausa e lacuna censuram",()=>{
 const r=run("A",12,{0:[1],30:[2]});assert.equal(r.result.collisionEpisodeCount,2);assert.equal(r.result.recovery.valid,1);assert.equal(r.result.recovery.censored,1);
 for(const kind of ["pause","gap"]){const x=run("A",12,{0:[1],8:[2]});if(kind==="pause")x.steps.slice(5).forEach(s=>s.segment=1);else x.steps[5].validInput=false;const m=analyze(x,cfg);assert.equal(m.collisionEpisodeCount,2);assert(m.recoveries[0].censored);assert.equal(m.recoveries[0].reason,kind==="pause"?"interruption":"input-gap");}
});
test("zero observado difere de ausência; contagem curta elegível e taxa insuficiente",()=>{
 const r=run();const f=features(r);assert.equal(f.metrics.contacts.value,0);assert.equal(f.metrics.contacts.eligibility,"eligible");assert.equal(f.metrics.contactsPerMinute.eligibility,"insufficient");
 r.steps=[];r.active=0;r.result=analyze(r,cfg);assert.equal(features(r).metrics.contacts.value,null);assert.equal(features(r).metrics.contacts.eligibility,"unavailable");
});
test("suporte e cálculo distintos: CV numérico curto permanece técnico",()=>{
 const f=features(run());assert(Number.isFinite(f.metrics.cv.value));assert.equal(f.metrics.cv.eligibility,"insufficient");
 for(const m of Object.values(f.metrics))for(const key of ["id","name","value","unit","definition","definitionVersion","source","supportCount","eligibility","reason","limitations"])assert(key in m,key);
});
test("comparabilidade confere semente, geometria e identificação; não agrega valores rejeitados",()=>{
 const runs=[run("A"),run("B"),run("C")];assert(interpretation(runs,cfg,setFor(7).id).quality.comparable);
 for(const change of [r=>delete r.setId,r=>r.seed=999,r=>r.maze.cells[0].walls[0]=!r.maze.cells[0].walls[0],r=>r.executionConfig={...cfg,speed:.3}]){
 const rs=structuredClone(runs);change(rs[1]);const report=consolidate(rs,cfg,setFor(7).id);assert(!report.comparable);assert.equal(report.pairs.length,0);assert.equal(report.aggregates.speed.count,0);assert(!report.rules.some(o=>o.ruleId.startsWith("trend-")));}
 const report=consolidate(runs,cfg,setFor(7).id);assert.equal(report.aggregates.cv.count,0);assert.equal(report.aggregates.contacts.count,3);
});
test("sessões curtas permitem fatos de episódios; resumo limitado e origem rastreável",()=>{
 const rs=[run("A",12,{0:[1],30:[2],50:[3]}),run("B",16,{0:[1]}),run("C",18,{0:[1]})];
 const a=interpretation(rs,cfg,setFor(7).id);assert.equal(a.quality.status,"limited");assert(a.observations.some(o=>o.ruleId==="initial-contact-pattern"));assert(a.summary.length<=5);
 for(const o of a.observations){assert(o.ruleId&&o.ruleVersion&&o.criteria&&o.limitations.length);for(const e of o.evidence){const r=rs.find(r=>r.id===e.runId);assert(r);assert(e.eventSeqs.every(seq=>r.events.some(x=>x.seq===seq)));assert(e.episodeIds.every(id=>r.result.collisionEpisodes.some(x=>x.id===id)));}assert(!/TDAH|impulsiv|atenção (melhor|pior)|diagnóstico detectado/i.test(o.statement));}
 const original=structuredClone(a);rs.forEach(r=>r.eeg={theta:9999});assert.deepEqual(interpretation(rs,cfg,setFor(7).id),original);
});
test("espacial usa início do episódio; equivalência regional continua indisponível",()=>{
 const rs=[run("A",12,{0:[1],30:[2],50:[3],70:[4]}),run("B"),run("C")];
 // Reset valid segments splits three later contacts at the same cell.
 for(const i of [40,60])rs[0].steps.slice(i).forEach(s=>s.segment++);
 rs[0].result=analyze(rs[0],cfg);const a=interpretation(rs,cfg,setFor(7).id);
 assert(a.observations.some(o=>o.ruleId==="spatial-concentration"));assert.equal(a.comparability.regional.eligibility,"unavailable");
});
test("v4 valida referências, mantém notas, aceita histórico sem reinterpretação",async()=>{
 const {validateImport}=await import("../../public/modules/timeline.js");const s=new Session(0);s.prepare({channels:1});s.notes="Nota manual preservada.";
 const data=JSON.parse(JSON.stringify(s.exportData()));assert.equal(validateImport(data),true);assert.equal(data.notes,s.notes);
 for(const version of [2,3]){const legacy=structuredClone(data);legacy.schemaVersion=version;legacy.report.analysis.schemaVersion="historical";const before=JSON.stringify(legacy);assert(validateImport(legacy));assert.equal(JSON.stringify(legacy),before);}
 const bad=structuredClone(data);bad.report.analysis.summary=["missing"];assert.throws(()=>validateImport(bad));
 const r=run("A",12,{0:[1,2]});s.runs=[r];s.current=r;s.events=r.events;s.reportKey="";s.reportCache=null;
 const linked=JSON.parse(JSON.stringify(s.exportData()));assert(validateImport(linked));
 const broken=structuredClone(linked);broken.runs[0].result.collisionEpisodes[0].eventSeqs=[999];assert.throws(()=>validateImport(broken));
 const wrongMetric=structuredClone(linked);wrongMetric.report.analysis.observations[0].evidence[0].metric="missing";assert.throws(()=>validateImport(wrongMetric));
});
test("frontend explica insuficiência e protege texto; gráfico não desenha valores rejeitados",async()=>{
 const {interpretationView,metricValue}=await import("../../public/modules/interpretation-view.js");const {comparison}=await import("../../public/modules/charts.js");
 const report=consolidate([run("A"),run("B"),run("C")],cfg,setFor(7).id);
 const html=interpretationView(report,{name:"<script>"},"demo");assert(html.includes("&lt;script&gt;"));assert(html.includes("Perfil de desempenho observado"));assert(html.includes("Por que o sistema diz isso?"));assert.equal(metricValue(report.analysis.features[0].metrics.cv),"Dados insuficientes");
 const bars=[],context={clearRect(){},fillText(){},fillRect(...args){bars.push(args);}};
 comparison({width:1000,height:220,getContext:()=>context},report.analysis);assert.equal(bars.length,9);
 report.analysis.features.forEach(f=>f.metrics.contacts.eligibility="insufficient");bars.length=0;comparison({width:1000,height:220,getContext:()=>context},report.analysis);assert.equal(bars.length,6);
});
