const app = document.querySelector("#app");
const toast = document.querySelector("#toast");

const studentsKey = "attobrain-students";
const sessionKey = "attobrain-session";

const sampleStudents = [
  { id: "victor", name: "Victor Gabriel Ferreira Theodoro", institution: "FATEC Registro", course: "DSM — Projeto Integrador I" },
  { id: "laura", name: "Laura Julia Mathias Amaral", institution: "FATEC Registro", course: "Desenvolvimento de Software Multiplataforma" },
  { id: "luiz", name: "Luiz Henrique Severo Cubas", institution: "FATEC Registro", course: "Desenvolvimento de Software Multiplataforma" },
  { id: "millie", name: "Millie Zanon Morelli Santos", institution: "FATEC Registro", course: "Desenvolvimento de Software Multiplataforma" },
  { id: "mario", name: "Mario Armando Takahashi Martins Dias", institution: "FATEC Registro", course: "Desenvolvimento de Software Multiplataforma" },
];

const horizontalWalls = [
  [0, 0], [71, 0], [142, 0], [213, 0], [284, 0], [355, 0], [426, 0], [497, 0],
  [0, 71], [213, 71], [284, 71],
  [71, 142], [142, 142], [213, 142], [355, 142], [426, 142],
  [71, 213],
  [142, 284], [213, 284], [284, 284], [355, 284], [426, 284],
  [71, 355],
  [0, 426], [71, 426], [142, 426], [213, 426], [284, 426], [355, 426], [426, 426], [497, 426],
];

const verticalWalls = [
  [0, 0], [142, 0], [426, 0], [568, 0],
  [0, 71], [71, 71], [213, 71], [355, 71], [497, 71], [568, 71],
  [0, 142], [213, 142], [355, 142], [497, 142], [568, 142],
  [0, 213], [142, 213], [284, 213], [426, 213], [497, 213], [568, 213],
  [0, 284], [71, 284], [213, 284], [355, 284], [497, 284], [568, 284],
  [0, 355], [142, 355], [284, 355], [426, 355], [568, 355],
];

let toastTimer;
let monitorTimer;

function readStudents() {
  try {
    const saved = localStorage.getItem(studentsKey);
    if (saved) return JSON.parse(saved);
  } catch (error) {
    console.warn("Não foi possível ler os cadastros locais.", error);
  }

  localStorage.setItem(studentsKey, JSON.stringify(sampleStudents));
  return [...sampleStudents];
}

function saveStudents(students) {
  localStorage.setItem(studentsKey, JSON.stringify(students));
}

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(sessionKey) || "null");
  } catch {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(sessionKey, JSON.stringify(session));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const remainder = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function elapsedSeconds(session) {
  if (!session?.startedAt) return 0;
  const end = session.endedAt || Date.now();
  return Math.max(0, Math.floor((end - session.startedAt) / 1000));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function currentRoute() {
  return decodeURIComponent(location.hash.slice(1) || "overview");
}

function go(route) {
  if (currentRoute() === route) render();
  else location.hash = route;
}

function routeParts() {
  const [page, id] = currentRoute().split("/");
  return { page, id };
}

function sidebar(page) {
  const active = page === "students" || page === "create" || page === "edit" || page === "delete"
    ? "students"
    : ["prepare", "maze", "monitor", "result"].includes(page) ? "maze" : "overview";

  return `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-logo-window"><img src="/assets/attobrain-logo.svg" alt="Attobrain" /></div>
        <small>Projeto Integrador I</small>
      </div>
      <nav class="side-nav" aria-label="Navegação principal">
        <a class="nav-link ${active === "overview" ? "active" : ""}" href="#overview" data-route="overview">
          <img src="/assets/icon-home.svg" alt="" /> <span>Início</span>
        </a>
        <a class="nav-link ${active === "students" ? "active" : ""}" href="#students" data-route="students">
          <img src="/assets/icon-students.svg" alt="" /> <span>Alunos</span>
        </a>
        <a class="nav-link ${active === "maze" ? "active" : ""}" href="#prepare" data-route="prepare">
          <img src="/assets/icon-maze.svg" alt="" /> <span>Labirinto</span>
        </a>
      </nav>
    </aside>`;
}

function shell(page, content) {
  return `
    <div class="app-shell">
      ${sidebar(page)}
      <div class="workspace">
        <header class="topbar">
          <div class="crumb">Attobrain&nbsp; / &nbsp;Projeto Integrador I</div>
          <span class="prototype-badge">PROTÓTIPO • DADOS SIMULADOS</span>
        </header>
        ${content}
      </div>
    </div>`;
}

function heading(title, description) {
  return `<div class="page-heading"><h1>${title}</h1><p>${description}</p></div>`;
}

function renderOverview() {
  const content = `
    <main class="main-content">
      ${heading("Painel de demonstração", "Projeto Integrador I • cadastro, labirinto e análise multimodal simulada.")}
      <section class="notice" aria-labelledby="notice-title">
        <strong id="notice-title">O que esta versão demonstra?</strong>
        <p>Um fluxo inicial de acompanhamento individual, usando dados ilustrativos.<br />Não há leitura de EEG, câmera ou diagnóstico automático.</p>
      </section>
      <section class="dashboard-grid" aria-label="Fluxos disponíveis">
        <article class="card dashboard-card">
          <h2>01&nbsp; Alunos</h2>
          <p>Cadastrar, consultar, editar e excluir registros.<br />As mudanças ficam salvas neste navegador.</p>
          <a class="btn" href="#students" data-route="students">Abrir cadastro&nbsp; →</a>
        </article>
        <article class="card dashboard-card">
          <h2>02&nbsp; Labirinto visual</h2>
          <p>Seguir o percurso, visualizar sinais sintéticos<br />e revisar o resultado da sessão.</p>
          <a class="btn teal" href="#prepare" data-route="prepare">Preparar atividade&nbsp; →</a>
        </article>
      </section>
      <section class="card scope-card">
        <strong>Fora do escopo neste semestre</strong>
        <p>Captação real de EEG/câmera, estimativas automáticas e neurofeedback dependem de validação futura.</p>
      </section>
    </main>`;
  return shell("overview", content);
}

function studentRows(search = "") {
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const students = readStudents().filter((student) =>
    `${student.name} ${student.institution} ${student.course}`.toLocaleLowerCase("pt-BR").includes(query));

  if (!students.length) {
    return `<tr><td class="empty-row" colspan="4">Nenhum aluno encontrado.</td></tr>`;
  }

  return students.map((student) => `
    <tr>
      <td>${escapeHtml(student.name)}</td>
      <td>${escapeHtml(student.institution)}</td>
      <td><span class="mint-badge">Demonstração</span></td>
      <td class="actions">
        <button class="btn secondary small" type="button" data-action="edit" data-id="${escapeHtml(student.id)}">Editar</button>
        <button class="btn danger small" type="button" data-action="delete" data-id="${escapeHtml(student.id)}" aria-label="Excluir ${escapeHtml(student.name)}">Excluir</button>
      </td>
    </tr>`).join("");
}

function renderStudents() {
  const count = readStudents().length;
  const content = `
    <main class="main-content">
      ${heading("Alunos", "Listagem ilustrativa de alunos • nenhum dado clínico é utilizado.")}
      <section class="card list-card">
        <div class="card-heading-row">
          <h2 class="card-title">Alunos cadastrados</h2>
          <a class="btn" href="#create" data-route="create">+ Cadastrar aluno</a>
        </div>
        <label class="search-note" for="student-search">
          <input id="student-search" type="search" placeholder="Buscar por nome ou instituição" autocomplete="off" />
        </label>
        <div class="table-wrap">
          <table class="student-table">
            <thead><tr><th>Aluno</th><th>Vínculo</th><th>Situação</th><th>Ações</th></tr></thead>
            <tbody id="student-rows">${studentRows()}</tbody>
          </table>
        </div>
      </section>
      <div class="table-footer">
        <span class="table-count" id="student-count">${count} alunos • Dados ilustrativos</span>
        <a class="btn secondary" href="#overview" data-route="overview">Voltar ao painel</a>
      </div>
    </main>`;
  return shell("students", content);
}

function renderStudentForm(mode, id) {
  const isEdit = mode === "edit";
  const students = readStudents();
  const student = isEdit ? students.find((item) => item.id === id) : null;

  if (isEdit && !student) {
    return shell("edit", `<main class="main-content">${heading("Aluno não encontrado", "O cadastro pode ter sido removido.")}<a class="btn" href="#students" data-route="students">Voltar para alunos</a></main>`);
  }

  const title = isEdit ? "Editar aluno" : "Cadastrar aluno";
  const description = isEdit
    ? "Operação de edição • protótipo navegável, sem banco de dados."
    : "Operação de cadastro • protótipo navegável, sem banco de dados.";
  const badge = isEdit ? '<span class="mint-badge">REGISTRO DE EXEMPLO</span>' : '<span class="soft-badge">NOVO ALUNO • EXEMPLO</span>';
  const cancelRoute = `#students`;

  const content = `
    <main class="main-content">
      ${heading(title, description)}
      <form class="card form-card" id="student-form" data-mode="${mode}" data-id="${isEdit ? escapeHtml(id) : ""}">
        ${badge}
        <div class="form-grid">
          <div class="field">
            <label for="student-name">Nome completo *</label>
            <input id="student-name" name="name" required maxlength="100" placeholder="Digite o nome completo" value="${escapeHtml(student?.name || "")}" />
          </div>
          <div class="field">
            <label for="student-institution">Instituição *</label>
            <input id="student-institution" name="institution" required maxlength="100" placeholder="Ex.: FATEC Registro" value="${escapeHtml(student?.institution || "FATEC Registro")}" />
          </div>
          <div class="field">
            <label for="student-course">Curso</label>
            <input id="student-course" name="course" maxlength="120" placeholder="Ex.: Desenvolvimento de Software Multiplataforma" value="${escapeHtml(student?.course || "")}" />
          </div>
        </div>
        <p class="form-note">${isEdit ? "Dados de demonstração • Não atribuir informações clínicas aos integrantes." : "Salvar retorna à listagem. Os dados ficam apenas neste navegador."}</p>
        <div class="form-actions">
          <a class="btn secondary" href="${cancelRoute}" data-route="students">Cancelar</a>
          <button class="btn" type="submit">${isEdit ? "Salvar alterações" : "Salvar cadastro"}&nbsp; →</button>
        </div>
      </form>
    </main>`;
  return shell(isEdit ? "edit" : "create", content);
}

function renderDelete(id) {
  const student = readStudents().find((item) => item.id === id);
  if (!student) return renderStudents();

  const content = `
    <main class="main-content">
      ${heading("Excluir aluno", "Operação de exclusão • exemplo sem alteração de dados reais.")}
      <section class="card delete-card">
        <span class="danger-badge">EXCLUSÃO DE CADASTRO</span>
        <h2>Excluir cadastro deste aluno?</h2>
        <div class="delete-person">
          <strong>${escapeHtml(student.name)}</strong>
          <p>A exclusão vale somente para os dados demonstrativos salvos neste navegador.</p>
        </div>
        <p class="delete-note">Nesta demonstração, nenhum registro fora deste navegador é removido.</p>
        <div class="form-actions">
          <a class="btn secondary" href="#students" data-route="students">Cancelar</a>
          <button class="btn danger" type="button" data-action="confirm-delete" data-id="${escapeHtml(student.id)}">Simular exclusão&nbsp; →</button>
        </div>
      </section>
    </main>`;
  return shell("delete", content);
}

function renderPrepare() {
  const students = readStudents();
  const selectedId = students.some((student) => student.id === "victor") ? "victor" : students[0]?.id;
  const options = students.map((student) => `<option value="${escapeHtml(student.id)}" ${student.id === selectedId ? "selected" : ""}>${escapeHtml(student.name)}</option>`).join("");

  const content = `
    <main class="main-content">
      ${heading("Preparar sessão • Labirinto visual", "Primeira proposta de atividade: seguir visualmente o caminho do início ao fim.")}
      <div class="session-layout">
        <form class="card session-card" id="session-form">
          <h2>Configuração da atividade</h2>
          <div class="field">
            <label for="session-student">Aluno</label>
            <select id="session-student" name="studentId" ${students.length ? "" : "disabled"}>${options || "<option>Cadastre um aluno primeiro</option>"}</select>
          </div>
          <div class="field">
            <label for="session-activity">Atividade</label>
            <select id="session-activity" name="activity">
              <option>Labirinto visual • Nível inicial</option>
              <option>Labirinto visual • Nível intermediário</option>
            </select>
          </div>
          <div class="field">
            <label>Modo de interação</label>
            <div class="mode-note">Modo demonstrativo • sem rastreamento ocular</div>
          </div>
          <button class="btn" type="submit" ${students.length ? "" : "disabled"}>Iniciar atividade&nbsp; →</button>
          ${students.length ? "" : '<p class="form-note">Cadastre um aluno antes de iniciar uma sessão.</p>'}
        </form>
        <aside class="card guide-card">
          <span class="soft-badge">SEM SENSOR</span>
          <h2>Orientações</h2>
          <ol>
            <li>Identifique o ponto de partida.</li>
            <li>Siga mentalmente o trajeto até a chegada.</li>
            <li>Clique no início e siga os corredores com o mouse.</li>
          </ol>
          <div class="important-note"><strong>Importante</strong>Olhar fora da tela não comprova desatenção. Esta versão não mede foco.</div>
        </aside>
      </div>
    </main>`;
  return shell("prepare", content);
}

function mazeSvg(session) {
  const horizontalSvg = horizontalWalls.map(([x, y]) => `<rect class="maze-wall" x="${x}" y="${y}" width="76" height="5" rx="2" />`).join("");
  const verticalSvg = verticalWalls.map(([x, y]) => `<rect class="maze-wall" x="${x}" y="${y}" width="5" height="76" rx="2" />`).join("");
  const col = session?.player?.col ?? 0;
  const row = session?.player?.row ?? 0;

  return `
    <svg id="maze-board" class="maze-board" viewBox="0 0 574 500" role="img" aria-label="Labirinto visual interativo. Use as setas do teclado ou clique em uma casa vizinha." tabindex="0">
      <g aria-hidden="true">${horizontalSvg}${verticalSvg}</g>
      <circle class="maze-start" cx="35.5" cy="35.5" r="16" />
      <text class="maze-label" x="67" y="39">Início</text>
      <circle class="maze-end" cx="532.5" cy="390.5" r="16" />
      <text class="maze-label end" x="516" y="369">FIM</text>
      <circle id="maze-player" class="maze-player" cx="${35.5 + col * 71}" cy="${35.5 + row * 71}" r="10" />
    </svg>`;
}

function renderMaze() {
  if (readSession()?.maze) return renderMouseMaze(readSession());
  const session = readSession();
  if (!session) return renderPrepare();

  const content = `
    <main class="main-content">
      ${heading("Labirinto visual — atividade inicial", "Siga o percurso com os olhos. Nesta versão, não há captação do olhar.")}
      <div class="maze-layout">
        <section class="card maze-card">${mazeSvg(session)}</section>
        <aside class="card maze-guide">
          <span class="soft-badge">LABIRINTO • MODO DEMO</span>
          <h2>Orientações</h2>
          <p>Siga o trajeto visualmente, do círculo verde ao violeta.</p>
          <p>O cursor pode ser utilizado apenas para demonstração.</p>
          <hr />
          <p class="small-text">EEG: não coletado<br />Câmera: não coletada<br />Olhar: não rastreado</p>
          <button class="btn teal" type="button" data-action="finish-maze">Finalizar&nbsp; →</button>
          <p class="move-hint" id="move-message" aria-live="polite">Use as setas ou clique em uma casa ao lado do marcador.</p>
        </aside>
      </div>
      <div class="maze-back"><a class="btn secondary" href="#prepare" data-route="prepare">← Preparação</a></div>
    </main>`;
  return shell("maze", content);
}

function sessionProgress(session) {
  if (session?.completed) return 100;
  return Math.min(96, 28 + (session?.moves || 0) * 2);
}

function sessionEvents(session) {
  const elapsed = elapsedSeconds(session);
  const events = [{ time: 0, title: "Início", color: "teal" }];
  if (!session?.resumedAt && elapsed >= 25) events.push({ time: 25, title: "Pausa manual", color: "indigo" });
  if (!session?.resumedAt && elapsed >= 32) events.push({ time: 32, title: "Atividade retomada", color: "indigo" });
  if (session?.resumedAt) {
    const resumedAt = Math.floor((session.resumedAt - session.startedAt) / 1000);
    events.push({ time: resumedAt, title: "Atividade retomada", color: "indigo" });
  }
  if (session?.endedAt) events.push({ time: elapsed, title: session.completed ? "Percurso concluído" : "Encerramento manual", color: "amber" });
  return events;
}

function eventRows(events) {
  return events.map((event) => `
    <div class="event-item">
      <span class="event-dot ${event.color === "teal" ? "teal" : event.color === "amber" ? "amber" : ""}"></span>
      <span class="event-time">${formatTime(event.time)}</span>
      <span>${escapeHtml(event.title)}</span>
    </div>`).join("");
}

function timeline(title, variant = "monitor") {
  const isResult = variant === "result";
  const wave = isResult ? "eeg-wave-result.svg" : "eeg-wave-timeline.svg";
  return `
    <section class="card timeline-card ${isResult ? "result-timeline" : ""}">
      <div class="timeline-heading">
        <h2>${title}</h2>
        <span class="soft-badge">${isResult ? "DADOS SINTÉTICOS" : "SINTÉTICA • NÃO É AQUISIÇÃO REAL"}</span>
      </div>
      <div class="timeline-graphic">
        <div class="timeline-labels"><span>EEG</span><span>Visão</span><span>Atividade</span><span>Eventos</span></div>
        <div class="timeline-track">
          <div class="timeline-track-inner">
            <div class="timeline-lines"><span></span><span></span><span></span><span></span></div>
            <img class="timeline-wave" src="/assets/${wave}" alt="Onda sintética de EEG" />
            <div class="timeline-activity"></div>
            <div class="timeline-events"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
            <div class="timeline-markers"><span></span><span></span><span></span><span></span></div>
          </div>
        </div>
      </div>
      <div class="timeline-axis-scroll"><div class="timeline-axis"><span>00:00</span><span>00:10</span><span>00:20</span><span>00:30</span><span>00:40</span><span>00:50</span></div></div>
    </section>`;
}

function renderMonitor() {
  if (readSession()?.maze) return renderMouseReport(readSession());
  const session = readSession();
  if (!session) return renderPrepare();
  const student = readStudents().find((item) => item.id === session.studentId);
  const studentName = student?.name || "Participante demonstrativo";
  const progress = sessionProgress(session);
  const events = sessionEvents(session);

  const content = `
    <main class="main-content">
      ${heading("Monitoramento multimodal", "Linha do tempo de EEG, visão e atividade — dados totalmente sintéticos.")}
      <section class="session-summary">
        <article class="card summary-panel">
          <span class="eyebrow">SESSÃO DEMONSTRATIVA</span>
          <dl><dt>Aluno</dt><dd>${escapeHtml(studentName)}</dd><dt>Atividade</dt><dd>${escapeHtml(session.activity)}</dd></dl>
        </article>
        <article class="card summary-panel">
          <span class="eyebrow">LABIRINTO EM ANDAMENTO — EXEMPLO</span>
          <div class="progress-heading"><strong data-session-time>${formatTime(elapsedSeconds(session))}</strong><span>/ 05:00 previstos</span></div>
          <p class="progress-copy">Progresso demonstrativo</p>
          <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
          <p class="progress-caption">${progress}%</p>
        </article>
      </section>
      <section class="monitor-grid" aria-label="Painéis de dados demonstrativos">
        <article class="card monitor-card">
          <h2>EEG / BCI</h2><span class="danger-badge">NÃO CONECTADO</span>
          <p class="mini-caption">Traçados ilustrativos</p>
          <div class="wave-row"><span>Delta</span><img src="/assets/eeg-wave-a.svg" alt="Traçado de demonstração" /></div>
          <div class="wave-row"><span>Alpha</span><img src="/assets/eeg-wave-b.svg" alt="Traçado de demonstração" /></div>
          <div class="wave-row"><span>Beta</span><img src="/assets/eeg-wave-c.svg" alt="Traçado de demonstração" /></div>
        </article>
        <article class="card monitor-card">
          <h2>Visão computacional</h2><span class="danger-badge">CÂMERA AUSENTE</span>
          <p class="mini-caption">Olhar estimado • exemplo</p>
          <div class="vision-box"><div class="vision-lines"><img src="/assets/line-muted.svg" alt="" /><img src="/assets/line-muted-alt.svg" alt="" /><img src="/assets/gaze-marker.svg" alt="Marcador hipotético" /></div></div>
          <p class="mini-caption">Direção: direita (simulada)</p>
        </article>
        <article class="card monitor-card">
          <h2>Desempenho</h2><span class="manual-badge">MODO MANUAL</span>
          <p class="mini-caption">Tempo observado</p>
          <strong class="progress-heading" data-session-time>${formatTime(elapsedSeconds(session))}</strong>
          <p class="mini-caption">Progresso</p><div class="small-progress"><span style="width:${progress}%"></span></div>
          <p class="mini-caption">Sem medição automática</p>
        </article>
        <article class="card monitor-card">
          <h2>Eventos da sessão</h2><span class="amber-badge">${events.length} MARCADORES</span>
          <div class="event-list">${eventRows(events)}</div>
        </article>
      </section>
      ${timeline("Linha do tempo multimodal")}
      <div class="data-note">Dados sintéticos: nenhum EEG, movimento ocular ou indicador clínico foi coletado nesta versão.</div>
      <div class="monitor-actions">
        <a class="btn secondary" href="#maze" data-route="maze">← Voltar ao labirinto</a>
        <button class="btn" type="button" data-action="show-result">Encerrar e ver resultado&nbsp; →</button>
      </div>
    </main>`;
  return shell("monitor", content);
}

function renderResult() {
  if (readSession()?.maze) return renderMouseReport(readSession());
  const session = readSession();
  if (!session) return renderPrepare();
  const student = readStudents().find((item) => item.id === session.studentId);
  const studentName = student?.name || "Participante demonstrativo";
  const elapsed = elapsedSeconds(session);
  const progress = sessionProgress(session);
  const events = sessionEvents(session);
  const conclusion = session.completed ? "Percurso concluído" : "Encerrada manualmente";

  const content = `
    <main class="main-content">
      ${heading("Resultado • Labirinto visual", "Resumo de uma sessão simulada — sem EEG ou câmera conectados.")}
      <section class="result-metrics">
        <article class="card metric-card"><span class="eyebrow">TEMPO DE SESSÃO</span><strong data-session-time>${formatTime(elapsed)}</strong><p>Exemplo de execução</p></article>
        <article class="card metric-card"><span class="eyebrow">PROGRESSO ILUSTRATIVO</span><strong>${progress}%</strong><p>${session.completed ? "Percurso concluído" : "Parada manual"}</p></article>
        <article class="card metric-card"><span class="eyebrow">EEG / BCI</span><strong>Não coletado</strong><p>Dispositivo ausente</p></article>
        <article class="card metric-card"><span class="eyebrow">CÂMERA</span><strong>Não coletada</strong><p>Rastreamento ausente</p></article>
      </section>
      <section class="result-grid">
        <article class="card detail-card">
          <h2>Resumo da sessão</h2>
          <div class="detail-row"><span>Aluno</span><span>${escapeHtml(studentName)}</span></div>
          <div class="detail-row"><span>Atividade</span><span>${escapeHtml(session.activity)}</span></div>
          <div class="detail-row"><span>Modo</span><span>Manual, sem sensores</span></div>
          <div class="detail-row"><span>Conclusão</span><span>${conclusion}</span></div>
        </article>
        <article class="card detail-card">
          <h2>Eventos de demonstração</h2>
          <div class="result-events">${eventRows(events)}</div>
        </article>
      </section>
      ${timeline("Linha do tempo sincronizada • demonstração", "result")}
      <div class="data-note">Resultado exclusivamente ilustrativo. Sem medição de atenção, diagnóstico ou inferência clínica nesta versão.</div>
      <div class="result-actions">
        <button class="btn secondary" type="button" data-action="new-session">← Nova sessão</button>
        <a class="btn" href="#overview" data-route="overview">Voltar ao painel&nbsp; →</a>
      </div>
    </main>`;
  return shell("result", content);
}

function render() {
  stopMouseCapture();
  clearInterval(monitorTimer);
  monitorTimer = null;
  const { page, id } = routeParts();
  window.scrollTo(0, 0);

  switch (page) {
    case "students": app.innerHTML = renderStudents(); break;
    case "create": app.innerHTML = renderStudentForm("create"); break;
    case "edit": app.innerHTML = renderStudentForm("edit", id); break;
    case "delete": app.innerHTML = renderDelete(id); break;
    case "prepare": app.innerHTML = renderPrepare(); break;
    case "maze": app.innerHTML = renderMaze(); break;
    case "monitor": app.innerHTML = renderMonitor(); break;
    case "result": app.innerHTML = renderResult(); break;
    default: app.innerHTML = renderOverview();
  }

  if (page === "maze") bindMouseMaze();
  if (page === "monitor") {
    monitorTimer = setInterval(() => {
      document.querySelectorAll("[data-session-time]").forEach((element) => {
        element.textContent = formatTime(elapsedSeconds(readSession()));
      });
    }, 1000);
  }
}

function canMove(from, to) {
  const dx = to.col - from.col;
  const dy = to.row - from.row;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return false;

  if (dx === 1) return !verticalWalls.some(([x, y]) => x === (from.col + 1) * 71 && y === from.row * 71);
  if (dx === -1) return !verticalWalls.some(([x, y]) => x === from.col * 71 && y === from.row * 71);
  if (dy === 1) return !horizontalWalls.some(([x, y]) => x === from.col * 71 && y === (from.row + 1) * 71);
  return !horizontalWalls.some(([x, y]) => x === from.col * 71 && y === from.row * 71);
}

function movePlayer(direction) {
  const session = readSession();
  if (!session || session.endedAt || session.maze) return;
  const move = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[direction];
  if (!move) return;

  const from = session.player || { col: 0, row: 0 };
  const to = { col: from.col + move[0], row: from.row + move[1] };
  if (to.col < 0 || to.col > 7 || to.row < 0 || to.row > 5 || !canMove(from, to)) {
    const message = document.querySelector("#move-message");
    if (message) message.textContent = "Há uma parede nesse caminho. Tente outra direção.";
    return;
  }

  session.player = to;
  session.moves = (session.moves || 0) + 1;
  session.completed = to.col === 7 && to.row === 5;
  saveSession(session);
  const marker = document.querySelector("#maze-player");
  if (marker) {
    marker.setAttribute("cx", String(35.5 + to.col * 71));
    marker.setAttribute("cy", String(35.5 + to.row * 71));
  }
  const message = document.querySelector("#move-message");
  if (message) message.textContent = session.completed ? "Percurso concluído. Você pode ver o monitoramento." : "Bom caminho. Continue até o ponto violeta.";
}

function startNewSession(form) {
  const students = readStudents();
  const formData = new FormData(form);
  const selectedStudent = students.find((student) => student.id === formData.get("studentId"));
  if (!selectedStudent) {
    showToast("Cadastre ou selecione um aluno para continuar.");
    return;
  }

  saveSession({
    studentId: selectedStudent.id,
    activity: String(formData.get("activity") || "Labirinto visual • Nível inicial"),
    maze: generateMaze(String(formData.get("activity")).includes("intermediário") ? 10 : 7, String(formData.get("activity")).includes("intermediário") ? 10 : 7),
    samples: [], visitedCells: [], wallContacts: 0,
    startedAt: null,
    endedAt: null,
    moves: 0,
    completed: false,
    player: { col: 0, row: 0 },
  });
  go("maze");
}

function finishMaze() {
  stopMouseCapture();
  const session = readSession();
  if (!session) return go("prepare");
  session.endedAt = Date.now();
  saveSession(session);
  go("monitor");
}

app.addEventListener("click", (event) => {
  const routeLink = event.target.closest("[data-route]");
  if (routeLink) {
    event.preventDefault();
    if (routeLink.dataset.route === "maze") {
      const session = readSession();
      if (session?.endedAt) {
        session.endedAt = null;
        session.resumedAt = Date.now();
        saveSession(session);
      }
    }
    go(routeLink.dataset.route);
    return;
  }

  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === "export-simulation") exportSimulation();

  if (action === "edit") go(`edit/${encodeURIComponent(id)}`);
  if (action === "delete") go(`delete/${encodeURIComponent(id)}`);

  if (action === "confirm-delete") {
    saveStudents(readStudents().filter((student) => student.id !== id));
    go("students");
    showToast("Cadastro removido dos dados locais.");
  }

  if (action === "finish-maze") finishMaze();

  if (action === "show-result") {
    const session = readSession();
    if (session && !session.endedAt) {
      session.endedAt = Date.now();
      saveSession(session);
    }
    go("result");
  }

  if (action === "new-session") {
    localStorage.removeItem(sessionKey);
    go("prepare");
  }
});

app.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;

  if (form.id === "student-form") {
    const formData = new FormData(form);
    const student = {
      name: String(formData.get("name") || "").trim(),
      institution: String(formData.get("institution") || "").trim(),
      course: String(formData.get("course") || "").trim(),
    };
    if (!student.name || !student.institution) return;

    const students = readStudents();
    if (form.dataset.mode === "edit") {
      const updatedStudents = students.map((item) => item.id === form.dataset.id ? { ...item, ...student } : item);
      saveStudents(updatedStudents);
      go("students");
      showToast("Cadastro atualizado neste navegador.");
    } else {
      student.id = `aluno-${Date.now()}`;
      saveStudents([student, ...students]);
      go("students");
      showToast("Aluno cadastrado neste navegador.");
    }
  }

  if (form.id === "session-form") startNewSession(form);
});

app.addEventListener("input", (event) => {
  if (event.target.id !== "student-search") return;
  const rows = document.querySelector("#student-rows");
  const count = document.querySelector("#student-count");
  if (!rows || !count) return;
  rows.innerHTML = studentRows(event.target.value);
  const visibleRows = rows.querySelectorAll("tr:not(:has(.empty-row))").length;
  count.textContent = `${visibleRows} alunos • Dados ilustrativos`;
});

app.addEventListener("click", (event) => {
  const board = event.target.closest("#maze-board");
  if (!board) return;
  const session = readSession();
  if (!session?.player) return;
  const bounds = board.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width) * 574;
  const y = ((event.clientY - bounds.top) / bounds.height) * 500;
  const target = { col: Math.floor(x / 71), row: Math.floor(y / 71) };
  const from = session.player;
  if (target.col === from.col + 1) movePlayer("right");
  else if (target.col === from.col - 1) movePlayer("left");
  else if (target.row === from.row + 1) movePlayer("down");
  else if (target.row === from.row - 1) movePlayer("up");
});

document.addEventListener("keydown", (event) => {
  if (!document.querySelector("#maze-board")) return;
  const directions = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
  if (!directions[event.key]) return;
  event.preventDefault();
  movePlayer(directions[event.key]);
});

window.addEventListener("hashchange", render);
render();
