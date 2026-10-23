const {randomUUID}=require('node:crypto');
const {performance}=require('node:perf_hooks');
const {generateMaze,geometry,move,solution}=require('./engine');
function attach(io){
 const sessions=new Map();
 function log(s,type,data={}){s.events.push({seq:s.events.length+1,t:s.active,type,data});}
 function pause(s,reason){if(s.state!=='RUNNING')return;s.state='PAUSED';s.pauseAt=performance.now();s.target=null;log(s,'pause',{reason});}
 function snapshot(s){return {id:s.id,state:s.state,maze:s.maze,walls:s.walls,position:s.position,trajectory:s.trajectory,events:s.events.slice(-100),active:s.active,contacts:s.contacts,progress:s.progress,distance:s.distance,pauses:s.pauses,low:s.low,connected:{student:!!s.student,professional:!!s.professional},seed:s.seed,notes:s.notes};}
 io.on('connection',socket=>{
  let session,role,lastSeq=-1;
  socket.on('join',(request,reply=()=>{})=>{
   if(!request||typeof request!=='object')return reply({error:'Requisição inválida.'});
   if(session)return reply({error:'Já associado.'});
   let s;
   if(request.create){s={id:randomUUID(),professionalKey:randomUUID(),studentKey:randomUUID(),state:'IDLE',events:[],trajectory:[],active:0,contacts:0,progress:0,distance:0,pauses:[],low:[],notes:''};sessions.set(s.id,s);role='professional';}
   else{s=sessions.get(request.id);if(!s)return reply({error:'Sessão não encontrada. Crie outra no painel.'});role=request.key===s.professionalKey?'professional':request.key===s.studentKey?'student':null;}
   if(!role||s[role])return reply({error:'Credencial inválida ou tela já conectada.'});
   session=s;s[role]=socket.id;socket.join(s.id);reply({id:s.id,key:role==='professional'?s.professionalKey:s.studentKey,studentKey:role==='professional'?s.studentKey:undefined,role});socket.emit('snapshot',snapshot(s));
  });
  socket.on('command',(r,reply=()=>{})=>{if(!r||typeof r!=='object')return reply({error:'Comando inválido.'});const s=session;if(!s||role!=='professional')return reply({error:'Sem permissão.'});if(r.id!==s.id)return reply({error:'Sessão inválida.'});
   if(r.type==='prepare'&&['IDLE','READY'].includes(s.state)){s.seed=Number.isInteger(r.seed)?r.seed:42;s.maze=generateMaze(r.level===10?10:7,r.level===10?10:7,s.seed);s.walls=geometry(s.maze);s.path=solution(s.maze);s.position={x:.5/s.maze.cols,y:.5/s.maze.rows};s.state='READY';s.checkpoint=0;log(s,'prepared');}
   else if((r.type==='start'&&s.state==='READY'||r.type==='resume'&&s.state==='PAUSED')&&s.student&&s.professional){if(s.pauseAt)s.pauses.push({duration:performance.now()-s.pauseAt});s.pauseAt=null;s.state='RUNNING';s.lastInput=performance.now();s.windowStart=s.active;s.windowDistance=s.distance;s.hitTimes=new Map();log(s,'started');}
   else if(r.type==='pause'&&s.state==='RUNNING')pause(s,'manual');
   else if(r.type==='abort'&&['RUNNING','PAUSED'].includes(s.state)){if(s.pauseAt)s.pauses.push({duration:performance.now()-s.pauseAt});s.pauseAt=null;s.state='ABORTED';log(s,'aborted');}
   else if(r.type==='reset'&&s.state!=='RUNNING'){Object.assign(s,{state:'IDLE',maze:null,walls:null,position:null,events:[],trajectory:[],inputs:[],active:0,contacts:0,progress:0,distance:0,pauses:[],low:[],notes:'',pauseAt:null});lastSeq=-1;}
   else if(r.type==='notes'&&typeof r.value==='string')s.notes=r.value.slice(0,4000);
   else return reply({error:'Comando indisponível neste estado.'});reply({ok:true});io.to(s.id).emit('snapshot',snapshot(s));
  });
  socket.on('input',r=>{if(!r||typeof r!=='object')return;const s=session;if(!s||role!=='student'||s.state!=='RUNNING'||!Number.isInteger(r.seq)||r.seq<=lastSeq)return;lastSeq=r.seq;if(r.hidden){pause(s,'Tela do aluno oculta');return;}if(r.inside&&(!Number.isFinite(r.x)||!Number.isFinite(r.y)||r.x<0||r.x>1||r.y<0||r.y>1))return;s.lastInput=performance.now();s.target=r.inside?{x:r.x,y:r.y}:null;s.inputs??=[];s.inputs.push({t:s.active,x:r.inside?r.x:null,y:r.inside?r.y:null});});
  socket.on('export',reply=>{if(session&&role==='professional')reply({...snapshot(session),events:session.events,inputs:session.inputs||[],config:{speed:.25,radius:.01,wallWidth:.005,version:1},source:'mouse',sensors:'not-connected'});});
  socket.on('disconnect',()=>{if(session&&session[role]===socket.id){session[role]=null;pause(session,'Conexão interrompida');io.to(session.id).emit('snapshot',snapshot(session));}});
 });
 let previous=performance.now(),counter=0;
 const timer=setInterval(()=>{let now=performance.now(),dt=Math.min(.05,(now-previous)/1000);previous=now;for(const s of sessions.values()){
  if(s.state==='RUNNING'){if(now-s.lastInput>2000){pause(s,'Entrada indisponível');continue;}s.active+=dt*1000;
   if(s.target&&now-s.lastInput<500){let result=move(s.position,s.target,dt,s.walls);s.distance+=Math.hypot(result.position.x-s.position.x,result.position.y-s.position.y);s.position=result.position;for(const hit of result.hits){if(!s.hitTimes.has(hit)||now-s.hitTimes.get(hit)>200){s.contacts++;log(s,'collision',{wall:hit,position:s.position});}s.hitTimes.set(hit,now);}}
   const cell=Math.floor(s.position.y*s.maze.rows)*s.maze.cols+Math.floor(s.position.x*s.maze.cols);if(cell===s.path[s.checkpoint+1]){s.checkpoint++;s.progress=Math.round(100*s.checkpoint/(s.path.length-1));log(s,'checkpoint',{cell});}
   if(!s.target||now-s.lastInput>=500){s.windowStart=s.active;s.windowDistance=s.distance;}
   if(s.active-s.windowStart>=2000){if(s.distance-s.windowDistance<.01){let last=s.low.at(-1);if(last&&last.end===s.windowStart)last.end=s.active;else{s.low.push({start:s.windowStart,end:s.active});log(s,'low-movement');}}s.windowStart=s.active;s.windowDistance=s.distance;}
   if(s.progress===100&&Math.hypot(s.position.x-(1-.5/s.maze.cols),s.position.y-(1-.5/s.maze.rows))<.02){s.state='COMPLETED';log(s,'completed');}
   if(counter%3===0)s.trajectory.push({...s.position,t:s.active});if(s.active>=600000)pause(s,'Limite de 10 minutos');
  }
  if(counter%3===0)io.to(s.id).emit('snapshot',snapshot(s));
 }counter++;},1000/60);
 return ()=>clearInterval(timer);
}
module.exports={attach};
