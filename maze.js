// Simulador didático. Coordenadas vêm do mouse; EEG é inteiramente sintético.
const mazeSize = 600;
let captureTimer;
let pointerPosition = null;
let pointerPrevious = null;
let recordingSession = null;

function generateMaze(cols, rows) {
  const cells = Array.from({ length: cols * rows }, () => ({ walls: [true, true, true, true], visited: false }));
  const stack = [0];
  cells[0].visited = true;
  // Busca em profundidade: remove uma parede entre vizinhos ainda não visitados.
  while (stack.length) {
    const index = stack[stack.length - 1];
    const x = index % cols;
    const y = Math.floor(index / cols);
    const choices = [];
    [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dx, dy], direction) => {
      const nx = x + dx, ny = y + dy;
      const next = ny * cols + nx;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !cells[next].visited) choices.push({ next, direction });
    });
    if (!choices.length) { stack.pop(); continue; }
    const choice = choices[Math.floor(Math.random() * choices.length)];
    cells[index].walls[choice.direction] = false;
    cells[choice.next].walls[(choice.direction + 2) % 4] = false;
    cells[choice.next].visited = true;
    stack.push(choice.next);
  }
  return { cols, rows, cells };
}

function drawMouseMaze(session, replay = false) {
  const m = session.maze;
  const w = mazeSize / m.cols, h = mazeSize / m.rows;
  let lines = '';
  m.cells.forEach((cell, i) => {
    const x = (i % m.cols) * w, y = Math.floor(i / m.cols) * h;
    if (cell.walls[0]) lines += `<path d="M${x},${y}h${w}"/>`;
    if (cell.walls[3]) lines += `<path d="M${x},${y}v${h}"/>`;
    if (i % m.cols === m.cols - 1) lines += `<path d="M${x+w},${y}v${h}"/>`;
    if (Math.floor(i / m.cols) === m.rows - 1) lines += `<path d="M${x},${y+h}h${w}"/>`;
  });
  const path = (session.samples || []).filter(p => p.inside).map(p => `${p.x * mazeSize},${p.y * mazeSize}`).join(' ');
  return `<svg id="mouse-maze" viewBox="-5 -5 610 610" class="mouse-maze" aria-label="Labirinto aleatório. Clique no início verde e siga os corredores com o mouse.">
    <rect width="600" height="600" fill="#fff"/>
    ${replay ? `<polyline points="${path}" fill="none" stroke="#9380ed" stroke-width="2" opacity=".6"/>` : ''}
    <g stroke="#46516b" stroke-width="3" fill="none">${lines}</g>
    <circle cx="${w/2}" cy="${h/2}" r="13" fill="#12b8a6"/><text x="${w/2}" y="${h/2+4}" text-anchor="middle" fill="white" font-size="10">1</text>
    <circle cx="${mazeSize-w/2}" cy="${mazeSize-h/2}" r="13" fill="#7646ef"/><text x="${mazeSize-w/2}" y="${mazeSize-h/2+4}" text-anchor="middle" fill="white" font-size="10">2</text>
    <circle id="mouse-marker" cx="${w/2}" cy="${h/2}" r="6" fill="#ffb020" pointer-events="none"/>
  </svg>`;
}

function renderMouseMaze(session) {
  if (!session?.maze) return renderPrepare();
  return shell('maze', `<main class="main-content">
    ${heading('Labirinto • olhar simulado pelo mouse', 'Cada atividade gera um novo percurso. Clique no início verde para começar a coleta.')}
    <div class="maze-layout"><section class="card maze-card">${drawMouseMaze(session)}</section>
    <aside class="card maze-guide"><span class="soft-badge">MOUSE → SIMULAÇÃO</span><h2>Do verde ao violeta</h2>
    <p>1. Clique no círculo verde.<br>2. Mova o mouse pelos corredores.<br>3. Alcance o círculo violeta.</p>
    <p>Paredes bloqueiam o marcador. Se sair do quadro ou cruzar uma parede, volte ao marcador amarelo para continuar.</p>
    <p id="capture-status" role="status">${session.endedAt ? 'Sessão encerrada.' : 'Aguardando clique no início.'}</p>
    <div id="capture-values">Coleta nominal: 20 amostras/s</div>
    <p class="small-text">Posição e tempo: capturados do mouse.<br>EEG: gerado por modelo didático, sem sensor.</p>
    <button class="btn secondary" data-action="finish-maze">Encerrar e analisar</button>
    </aside></div></main>`);
}

function stopMouseCapture() {
  clearInterval(captureTimer);
  if (recordingSession) {
    if (recordingSession.startedAt && !recordingSession.endedAt) recordingSession.endedAt = Date.now();
    saveSession(recordingSession);
  }
  recordingSession = null;
  pointerPosition = null;
  pointerPrevious = null;
}

function bindMouseMaze() {
  const board = document.querySelector('#mouse-maze');
  if (!board) return;
  const session = readSession();
  if (!session?.maze || session.endedAt) return;
  recordingSession = session;
  let lastPoint = session.lastPoint || null;
  let needsReturn = true;
  let wallContact = false;
  let lastTime = performance.now();
  const status = document.querySelector('#capture-status');
  function point(event) {
    const bounds = board.getBoundingClientRect();
    return { x: (((event.clientX-bounds.left)/bounds.width)*610-5)/600, y: (((event.clientY-bounds.top)/bounds.height)*610-5)/600 };
  }
  function setMarker(p) {
    const marker = document.querySelector('#mouse-marker');
    marker.setAttribute('cx', p.x*600); marker.setAttribute('cy', p.y*600);
  }
  function crossesWall(a, b) {
    const m = session.maze;
    const steps = Math.max(1, Math.ceil(Math.hypot((b.x-a.x)*m.cols, (b.y-a.y)*m.rows)*30));
    let prior = a;
    for (let i=1; i<=steps; i++) {
      const p = {x:a.x+(b.x-a.x)*i/steps, y:a.y+(b.y-a.y)*i/steps};
      const c1=Math.floor(prior.x*m.cols), r1=Math.floor(prior.y*m.rows);
      const c2=Math.floor(p.x*m.cols), r2=Math.floor(p.y*m.rows);
      if (c1!==c2 && r1!==r2) return true;
      const walls=m.cells[r1*m.cols+c1].walls;
      if ((c2>c1 && walls[1]) || (c2<c1 && walls[3]) || (r2>r1 && walls[2]) || (r2<r1 && walls[0])) return true;
      prior=p;
    }
    return false;
  }
  board.addEventListener('click', event => {
    if (session.startedAt) return;
    const p=point(event), start={x:.5/session.maze.cols,y:.5/session.maze.rows};
    if (Math.hypot(p.x-start.x,p.y-start.y)>13/600) return;
    session.startedAt=Date.now(); lastTime=performance.now(); lastPoint=start; session.lastPoint=start;
    pointerPosition=p; needsReturn=false;
    session.visitedCells=[0];
    saveSession(session); status.textContent='Coletando. Siga pelos corredores.';
  });
  board.addEventListener('pointermove', event => {
    if (!session.startedAt || session.endedAt) return;
    const p=point(event);
    if (p.x<0 || p.x>=1 || p.y<0 || p.y>=1) { pointerPosition=null; needsReturn=true; return; }
    pointerPosition=p;
    if (needsReturn) {
      if (Math.hypot(p.x-lastPoint.x,p.y-lastPoint.y)>8/600) return;
      needsReturn=false; status.textContent='Coleta retomada no marcador.';
    }
    if (crossesWall(lastPoint,p)) {
      session.wallContacts++; wallContact=true; needsReturn=true;
      status.textContent='Parede cruzada. Volte ao marcador amarelo.'; return;
    }
    lastPoint=p; session.lastPoint=p; setMarker(p); wallContact=false;
    const m=session.maze, cell=Math.floor(p.y*m.rows)*m.cols+Math.floor(p.x*m.cols);
    if (!session.visitedCells.includes(cell)) session.visitedCells.push(cell);
    if (Math.hypot(p.x-(1-.5/m.cols),p.y-(1-.5/m.rows))<13/600) end(true);
  });
  board.addEventListener('pointerleave', () => { pointerPosition=null; needsReturn=true; if(session.startedAt) status.textContent='Fora do quadro. Volte ao marcador amarelo.'; });
  function sample() {
    if (!session.startedAt || session.endedAt) return;
    const now=performance.now(), dt=Math.min(.25,(now-lastTime)/1000); lastTime=now;
    const p=pointerPosition;
    const speed=p && pointerPrevious ? Math.hypot(p.x-pointerPrevious.x,p.y-pointerPrevious.y)/dt : 0;
    session.samples.push({t:Date.now()-session.startedAt,x:p?.x??null,y:p?.y??null,inside:!!p,valid:!!p&&!needsReturn,wall:wallContact,speed:Number(speed.toFixed(4)),dt});
    pointerPrevious=p;
    const values=document.querySelector('#capture-values');
    values.textContent=`${formatTime(elapsedSeconds(session))} • ${session.samples.length} amostras • ${session.wallContacts} contatos com paredes`;
    if(session.samples.length%20===0) saveSession(session);
    if (session.samples.length>=12000) end(false);
  }
  function end(completed) {
    session.completed=completed; session.endedAt=Date.now();
    saveSession(session); clearInterval(captureTimer); recordingSession=null; go('result');
  }
  captureTimer=setInterval(sample,50);
  if(lastPoint) setMarker(lastPoint);
}

function mouseMetrics(session) {
  const samples=session.samples||[];
  const duration=Math.max(0,((session.endedAt||Date.now())-(session.startedAt||Date.now()))/1000);
  let inside=0, stationary=0, distance=0;
  let previous=null;
  samples.forEach(p=>{
    if(p.inside) { inside+=p.dt; if(p.speed<.03) stationary+=p.dt; }
    if(p.inside && previous?.inside) distance+=Math.hypot(p.x-previous.x,p.y-previous.y);
    previous=p;
  });
  return {duration,inside,stationary,distance,count:samples.length};
}

// Valores de engenharia arbitrários: nenhuma relação fisiológica é inferida.
function syntheticEeg(session) {
  const output=[];
  const samples=session.samples||[];
  const duration=mouseMetrics(session).duration;
  let cursor=0;
  for(let i=0;i<Math.floor(duration*128);i++) {
    const t=i/128;
    while(cursor<samples.length-1 && samples[cursor+1].t<=t*1000) cursor++;
    const p=samples[cursor];
    const movement=Math.min(1,p?.speed||0);
    const theta=8+4*movement, alpha=12-4*movement, beta=5+6*movement;
    const artifact=p?.inside ? (p.wall?12:0) : 20;
    const uv=theta*Math.sin(2*Math.PI*6*t)+alpha*Math.sin(2*Math.PI*10*t)+beta*Math.sin(2*Math.PI*20*t)+artifact*Math.sin(2*Math.PI*1.5*t);
    output.push({t,uv:Number(uv.toFixed(3)),thetaAmplitude:theta,alphaAmplitude:alpha,betaAmplitude:beta});
  }
  return output;
}

function renderMouseReport(session) {
  if(!session?.maze) return renderPrepare();
  const m=mouseMetrics(session), eeg=syntheticEeg(session);
  const last=eeg.slice(-512);
  const points=last.map((p,i)=>`${i/(Math.max(1,last.length-1))*800},${80-p.uv}`).join(' ');
  const name=readStudents().find(s=>s.id===session.studentId)?.name||'Participante';
  return shell('result', `<main class="main-content">
    ${heading('Resultado da atividade', `${escapeHtml(name)} • ${session.completed?'Percurso concluído':'Sessão interrompida'}`)}
    <section class="result-metrics">
    <article class="card metric-card"><span>Tempo capturado</span><strong>${formatTime(m.duration)}</strong><p>${m.count} amostras do mouse</p></article>
    <article class="card metric-card"><span>Presença no quadro</span><strong>${m.duration?Math.min(100,100*m.inside/m.duration).toFixed(1):0}%</strong><p>Tempo dentro dos limites</p></article>
    <article class="card metric-card"><span>Mouse quase parado</span><strong>${m.stationary.toFixed(1)} s</strong><p>Velocidade &lt; 0,03 quadros/s</p></article>
    <article class="card metric-card"><span>Contatos com paredes</span><strong>${session.wallContacts}</strong><p>Travessias bloqueadas</p></article></section>
    <div class="result-grid"><section class="card detail-card"><h2>Trajetória registrada</h2>${drawMouseMaze(session,true)}<p>Coordenadas normalizadas de 0 a 1. Trechos fora do quadro não têm posição válida. Linha mostra a trajetória do mouse, incluindo tentativas bloqueadas.</p></section>
    <section class="card detail-card"><span class="soft-badge">EEG TOTALMENTE SINTÉTICO</span><h2>Canal virtual • 128 Hz</h2>
    <p>Janela final de até 4 segundos • amplitude em µV sintéticos</p>
    <svg viewBox="0 0 800 160" role="img" aria-label="EEG sintético, amplitude de menos 80 a mais 80 microvolts"><path d="M0 80H800" stroke="#ddd"/><polyline points="${points}" stroke="#7044e8" stroke-width="1.5" fill="none"/></svg>
    <p>Componentes: theta 6 Hz, alpha 10 Hz e beta 20 Hz. ${eeg.length} amostras geradas.</p>
    <p>O movimento modula amplitudes por uma regra didática. Ausência e paredes adicionam uma onda lenta artificial. Isso não estima atividade cerebral, atenção ou diagnóstico.</p>
    <p><a href="https://emotiv.gitbook.io/emotivpro-v3/data-streams/frequency-bands" target="_blank" rel="noreferrer">Referência das bandas</a> · <a href="https://datasets-benchmarks-proceedings.neurips.cc/paper/2021/hash/a3c65c2974270fd093ee8a9bf8ae7d0b-Abstract-round1.html" target="_blank" rel="noreferrer">EEG e olhar na pesquisa</a></p>
    </section></div>
    <div class="data-note">Mouse medido ≠ olhar medido ≠ EEG. Os sinais virtuais servem para demonstrar o fluxo futuro de um BCI.</div>
    <div class="result-actions"><button class="btn secondary" data-action="new-session">Nova atividade</button><button class="btn" data-action="export-simulation">Baixar dados da sessão (JSON)</button></div>
    </main>`);
}

function exportSimulation() {
  const session=readSession();
  if(!session?.maze) return;
  const data={schemaVersion:1,source:'mouse',eegSource:'synthetic-didactic-not-physiological',units:{position:'normalized-0-1',time:'seconds (mouse t in milliseconds)',eeg:'synthetic microvolts'},nominalMouseRateHz:20,eegRateHz:128,model:'sum of sinusoids at 6, 10, 20 Hz; arbitrary amplitude modulation by mouse speed; 1.5 Hz artificial artifacts',session,metrics:mouseMetrics(session),eeg:syntheticEeg(session)};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=document.createElement('a'); a.href=url; a.download=`attobrain-simulacao-${session.startedAt||Date.now()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}

window.addEventListener('beforeunload', stopMouseCapture);
