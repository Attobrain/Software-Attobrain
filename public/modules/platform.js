import { escape as esc } from "./format.js";
import { readStudents, saveStudent, removeStudent, studentForm, studentList } from "./students.js";
import { drawBoard } from "./board.js";
import { interpretationView } from "./interpretation-view.js";

export function createPlatform({ connect, command, state, credentials, socket, message, timeline, showImported, restoreLive, newSession }) {
  const page = document.getElementById("platform-view"), session = document.getElementById("session-view");
  let editId = null, creating = false, selected = null, returnToFlow = false, renderKey = "", previewTimer, pending = false, imported = null, previews = [];
  const technical = document.createElement("details");
  technical.id = "technical-panel"; technical.className = "card technical-panel";
  technical.innerHTML = '<summary>Linha do tempo e demonstração técnica</summary>';
  for (const id of ["timeline", "eeg-panel", "diagnostics"]) technical.append(document.getElementById(id));
  session.append(technical);
  const reportActions = document.createElement("div"); reportActions.className = "controls report-actions";
  const reportHeading = document.querySelector("#result-panel > .page-heading");
  for (const id of ["export", "print", "result-new"]) reportActions.append(document.getElementById(id));
  reportHeading.append(reportActions);
  document.getElementById("print").classList.add("secondary");
  const notes = document.createElement("section"); notes.className = "card professional-notes";
  notes.append(document.getElementById("notes").closest("label"), document.getElementById("unsaved"));
  document.getElementById("result-panel").insertBefore(notes, document.getElementById("result-technical"));
  document.getElementById("execution-panel").insertAdjacentHTML("beforeend", '<button class="secondary" data-flow="technical">Inspecionar linha do tempo e EEG sintético</button>');
  document.getElementById("result-new").onclick = newSession;
  const heading = (title, description) => `<section class="page-heading"><div><span class="eyebrow">PLATAFORMA ATTOBRAIN</span><h1 tabindex="-1">${title}</h1><p>${description}</p></div></section>`;
  function route() {
    const value = location.hash.slice(1);
    if (["prepare", "maze", "monitor", "activity-setup", "monitoring"].includes(value)) return "session";
    if (value === "result") return "results";
    return value || (location.pathname === "/profissional" ? "session" : "overview");
  }
  function navigate(value) {
    if (location.hash === `#${value}`) { renderKey = ""; show(); }
    else location.hash = value;
  }
  function studentsPage(selection = false) {
    const list = readStudents();
    const continuation = selection ? `<button id="confirm-participant" data-flow="participant" ${list.some(v => v.id === selected) ? "" : "disabled"}>Confirmar aluno e continuar →</button>` : "";
    return `${selection ? "" : heading("Alunos", "Cadastros demonstrativos salvos somente neste navegador.")}<section class="card student-picker"><div class="section-heading"><h2>${selection ? "Quem vai participar?" : "Cadastros demonstrativos"}</h2><button class="secondary" data-student="create">Cadastrar aluno</button></div><label class="student-search">Buscar aluno<input id="student-search" type="search" placeholder="Nome ou instituição" autocomplete="off"></label><div id="student-rows">${studentList(list, selection, selected)}</div><p id="student-selected" role="status">${selection ? "Selecione e confirme o aluno para continuar." : `${list.length} cadastro(s) neste navegador.`}</p>${continuation}</section>`;
  }
  function steps(s) {
    const list = s.config.mode === "single" ? [["participant", "Aluno"], ["configuration", "Configuração"], ["review", "Revisão"], ["activity", "Atividade"]] : [["participant", "Aluno"], ["configuration", "Configuração"], ["review", "Revisão"], ["training", "Treino"], ["A", "A"], ["B", "B"], ["C", "C"]];
    const index = list.findIndex(([key]) => key === s.workflow.step);
    document.getElementById("flow-steps").innerHTML = `<p class="step-count">Etapa ${Math.max(1, index + 1)} de ${list.length} · ${esc(list[index]?.[1] ?? "Resultados")}</p><ol class="guided-steps">${list.map(([key, title], i) => {
      const outcome = s.workflow.runStates?.[key];
      const interrupted = ["ABORTED", "TIMED_OUT"].includes(outcome);
      const caption = outcome === "ABORTED" ? "Interrompida" : outcome === "TIMED_OUT" ? "Tempo encerrado" : outcome === "PAUSED" ? "Pausada" : outcome === "COMPLETED" ? "Concluída" : i === index ? "Atual" : i < index ? "Concluída" : "Bloqueada";
      return `<li class="${i === index ? "current" : i < index ? "done" : "locked"} ${interrupted ? "interrupted" : ""}" ${i === index ? 'aria-current="step"' : ""}><span>${i < index && !interrupted ? "✓" : i + 1}</span>${title}<small>${caption}</small></li>`;
    }).join("")}</ol>`;
  }
  function updatePreview() {
    const form = document.getElementById("configuration"), config = Object.fromEntries(new FormData(form));
    for (const name of ["seed", "trainingSeconds", "intervalSeconds"]) form.elements.namedItem(name).closest("label").hidden = name === "seed" ? config.mode === "protocol" : config.mode === "single";
    for (const input of form.elements) if (input.name && ["number"].includes(input.type)) config[input.name] = Number(input.value);
    for (const name of ["level", "channels", "sampleRate"]) config[name] = Number(config[name]);
    config.artifacts = config.artifacts === "true";
    socket.timeout(4000).emit("preview", { config }, (error, reply) => {
      if (error || reply?.error) { document.getElementById("preview-description").textContent = reply?.error ?? "Sem conexão para a prévia."; return; }
      if (route() !== "session" || state()?.workflow.step !== "configuration") return;
      previews = reply.preview;
      const selector = document.getElementById("preview-phase");
      const previous = selector.value;
      selector.replaceChildren(...previews.map(p => new Option(p.label, p.label)));
      if (previews.some(p => p.label === previous)) selector.value = previous;
      drawBoard(document.getElementById("preview-board"), previews.find(p => p.label === selector.value));
      document.getElementById("preview-description").textContent = `${reply.preview[0].label} · ${config.level} × ${config.level}. ${config.mode === "protocol" ? "Conjunto versionado A/B/C; sementes fixas para comparação." : `Exploração · semente ${config.seed}; sem tendência A/B/C.`} Nenhuma coleta iniciada.`;
    });
  }
  function show() {
    const current = route(), s = state();
    if (current === "session" && imported) { imported = null; renderKey = ""; timeline.reset(); restoreLive(); }
    const platformPage = ["overview", "students"].includes(current);
    page.hidden = !platformPage; session.hidden = platformPage;
    document.querySelectorAll(".side-nav .nav-link").forEach(link => {
      const active = link.hash === `#${platformPage ? current : "session"}`;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
    });
    if (current === "results" && !s && !imported && !credentials()?.id) {
      page.hidden = false; session.hidden = true;
      page.innerHTML = `${heading("Abrir resultado", "Relatórios importados ficam somente na memória desta página.")}<section class="card"><p>Após recarregar, selecione novamente o arquivo JSON para inspecionar seu relatório.</p><button data-flow="import">Abrir relatório JSON</button></section>`;
      return;
    }
    if (platformPage) {
      technical.hidden = true;
      if (current === "overview") page.innerHTML = `${heading("Painel de demonstração", "Prepare uma atividade, acompanhe o percurso e compreenda os resultados.")}<section class="platform-notice"><strong>Um ambiente de demonstração científica</strong><p>Interações do mouse são observadas durante o labirinto. O EEG é sintético; não há captura de sinais cerebrais ou diagnóstico.</p></section><div class="home-grid"><article class="card"><span class="home-number">01</span><h2>Alunos</h2><p>Organize os cadastros demonstrativos deste navegador.</p><a href="#students" class="button secondary">Consultar alunos →</a></article><article class="card"><span class="home-number">02</span><h2>Labirinto visual</h2><p>Uma preparação guiada, com treino e atividades A, B e C.</p><a href="#session" class="button">${credentials()?.id ? "Continuar sessão" : "Preparar atividade"} →</a></article></div><section class="card import-card"><h2>Revisar um resultado exportado</h2><p>Abra um JSON v2 ou v3 para inspeção local, sem modificar uma sessão em andamento.</p><button class="secondary" data-flow="import">Abrir relatório JSON</button></section>`;
      else if (creating || editId) page.innerHTML = `${heading("Cadastro demonstrativo", "Sem banco de dados. As alterações ficam neste navegador.")}${studentForm(editId ? readStudents().find(v => v.id === editId) : {})}`;
      else page.innerHTML = studentsPage();
      return;
    }
    if (!s && !imported) {
      document.getElementById("wizard-panel").innerHTML = '<section class="card"><h2>Conectando a sessão</h2><p>Aguardando confirmação do servidor…</p><button class="secondary" data-flow="reconnect">Tentar conectar novamente</button><button class="secondary" data-flow="new">Criar outra sessão</button></section>';
      connect().catch(error => message(error.message));
      return;
    }
    if (current === "results" && imported) {
      document.getElementById("wizard-panel").hidden = true;
      document.getElementById("configuration-panel").hidden = true;
      document.getElementById("execution-panel").hidden = true;
      document.getElementById("flow-steps").hidden = true;
      document.querySelector(".flow-heading").hidden = true;
      document.getElementById("result-panel").hidden = false;
      technical.hidden = false;
      return;
    }
    if (!s) return;
    const w = s.workflow, result = w.step === "results", config = w.step === "configuration", execution = !!s.runId;
    document.getElementById("configuration-panel").hidden = !config;
    document.getElementById("execution-panel").hidden = !execution || result;
    document.getElementById("result-panel").hidden = !result;
    document.querySelector(".flow-heading").hidden = result;
    document.getElementById("flow-steps").hidden = result;
    document.getElementById("wizard-panel").hidden = config || execution || result;
    technical.hidden = !execution;
    steps(s);
    const key = `${w.step}:${w.controlRevision}`;
    if (key !== renderKey) {
      renderKey = key;
      const titles = { participant: "Selecionar aluno", configuration: "Configurar o labirinto", review: "Tudo pronto para começar?", training: "Treinamento", activity: "Exploração", A: "Atividade A", B: "Atividade B", C: "Atividade C" };
      document.getElementById("flow-title").textContent = titles[w.step] ?? "Sessão";
      document.getElementById("flow-description").textContent = execution ? `${s.participant?.name ?? "Participante demonstrativo"} · As análises completas estarão disponíveis ao finalizar.` : "Uma etapa de cada vez, com os dados necessários para começar.";
      const wizard = document.getElementById("wizard-panel");
      if (w.step === "participant") wizard.innerHTML = studentsPage(true);
      if (config) {
        const form = document.getElementById("configuration");
        for (const [name, value] of Object.entries(s.config)) if (form.elements.namedItem(name)) form.elements.namedItem(name).value = String(value);
        document.getElementById("activity-setup").open = true;
        updatePreview();
      }
      if (w.step === "review") wizard.innerHTML = `<section class="review-grid"><article class="card"><span class="eyebrow">REVISÃO</span><h2>${esc(s.participant?.name)}</h2><dl class="review-values"><dt>Protocolo</dt><dd>${s.config.mode === "protocol" ? "Treinamento + A/B/C" : "Exploração"}</dd><dt>Geometria</dt><dd>${s.config.level} × ${s.config.level}</dd><dt>Entrada</dt><dd>Mouse · sem rastreamento ocular</dd><dt>Duração máxima</dt><dd>Treino ${s.config.trainingSeconds} s · atividade ${s.config.activitySeconds} s</dd><dt>Intervalos A/B/C</dt><dd>${s.config.intervalSeconds} s</dd><dt>Simulação EEG</dt><dd>${s.config.channels} canais · ${s.config.sampleRate} Hz · ${s.config.eegMode === "independent" ? "independente" : "didática"}</dd></dl><p>Dados comportamentais temporários. EEG sintético excluído da interpretação.</p><button class="secondary" data-flow="back" data-step="configuration">Revisar configuração</button></article><article class="card connection-review"><span class="eyebrow">DUAS JANELAS NO MESMO COMPUTADOR</span><h2>Conecte a tela do aluno</h2><p>Abra a janela do aluno e deixe-a visível ao lado deste painel. Alternar abas pode ocultar a atividade e provocar uma pausa.</p><button class="secondary" data-flow="open">Abrir tela do aluno</button><p id="review-connection" role="status"></p><p id="popup-help">Se a janela não abrir, permita o popup deste site e tente novamente.</p><button data-flow="begin" id="begin-session">Iniciar sessão →</button></article></section>`;
      if (result) {
        document.getElementById("interpretation").innerHTML = interpretationView(s.report, s.participant, s.id, false, s.endReason);
        document.getElementById("result-technical").open = false;
      }
      document.getElementById("flow-title").focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    if (w.step === "review") {
      document.getElementById("begin-session").disabled = !w.actions.begin || pending;
      document.getElementById("review-connection").textContent = w.studentReady ? "Aluno conectado e tela visível. Tudo pronto." : s.connected.student ? "Aluno conectado. Deixe a janela do aluno visível para começar." : "Aguardando a conexão do aluno.";
    }
    if (execution) {
      document.querySelector(".monitor-heading").hidden = true;
      document.getElementById("phase").textContent = s.label;
      document.getElementById("next").textContent = s.label === "Treinamento" ? "Continuar para A →" : s.label === "A" ? "Continuar para B →" : "Continuar para C →";
    }
  }
  const attempt = async (type, extra = {}) => {
    if (pending) return;
    pending = true;
    try { await command(type, extra); } catch (error) { message(error.message); }
    finally { pending = false; show(); }
  };
  document.getElementById("configuration").addEventListener("change", () => { clearTimeout(previewTimer); previewTimer = setTimeout(updatePreview, 250); });
  document.getElementById("preview-phase").onchange = event => {
    const chosen = previews.find(p => p.label === event.target.value);
    drawBoard(document.getElementById("preview-board"), chosen);
    if (chosen) document.getElementById("preview-description").textContent = `${chosen.label} · ${chosen.maze.cols} × ${chosen.maze.rows} · semente ${chosen.seed}. Prévia sem coleta. Geometria rastreável; não implica dificuldade humana equivalente.`;
  };
  document.addEventListener("input", event => {
    if (event.target.id !== "student-search") return;
    const query = event.target.value.toLocaleLowerCase("pt-BR");
    document.getElementById("student-rows").innerHTML = studentList(readStudents().filter(v => `${v.name} ${v.institution}`.toLocaleLowerCase("pt-BR").includes(query)), route() === "session", selected);
  });
  document.addEventListener("submit", event => {
    if (event.target.id !== "student-form") return;
    event.preventDefault();
    try {
      const value = saveStudent(Object.fromEntries(new FormData(event.target)), editId);
      creating = false; editId = null; selected = value.id;
      if (returnToFlow) { returnToFlow = false; navigate("session"); }
      else show();
    } catch (error) { document.getElementById("student-error").textContent = error.message; }
  });
  document.addEventListener("click", event => {
    const anchor = event.target.closest('a[href="#timeline"], a[href="#diagnostics"]');
    if (anchor) {
      event.preventDefault();
      technical.hidden = false; technical.open = true;
      if (anchor.hash === "#diagnostics") document.getElementById("diagnostics").open = true;
      document.querySelector(anchor.hash).scrollIntoView({ behavior: "instant" });
      return;
    }
    const button = event.target.closest("[data-flow], [data-student], [data-evidence], [data-observation]");
    if (!button) return;
    try {
      if (button.dataset.observation) {
        const target = [...document.querySelectorAll("[data-observation-id]")].find(item => item.dataset.observationId === button.dataset.observation);
        const panel = document.getElementById("observations-panel");
        if (target && panel) { panel.open = true; target.open = true; target.scrollIntoView({ behavior: "instant", block: "start" }); }
      }
      if (button.dataset.evidence !== undefined) {
        technical.hidden = false; technical.open = true;
        timeline.inspectAt(Number(button.dataset.evidence), !!imported);
        document.getElementById("timeline").scrollIntoView({ behavior: "instant" });
      }
      if (button.dataset.student) {
        const action = button.dataset.student;
        if (action === "select") { selected = button.dataset.id; document.getElementById("confirm-participant").disabled = false; document.getElementById("student-selected").textContent = `Selecionado: ${readStudents().find(v => v.id === selected).name}`; }
        if (action === "create" || action === "edit") { returnToFlow = route() === "session"; editId = action === "edit" ? button.dataset.id : null; creating = true; navigate("students"); }
        if (action === "delete" && confirm("Excluir este cadastro demonstrativo do navegador? Sessões já registradas preservam sua identificação.")) { removeStudent(button.dataset.id); show(); }
        if (action === "cancel") { creating = false; editId = null; navigate(returnToFlow ? "session" : "students"); returnToFlow = false; }
      }
      const action = button.dataset.flow;
      if (action === "participant") attempt("select-participant", { participant: readStudents().find(v => v.id === selected) });
      if (action === "back") attempt("back", { step: button.dataset.step });
      if (action === "begin") attempt("begin");
      if (action === "reanalyze") attempt("reanalyze");
      if (action === "open") document.getElementById("open").click();
      if (action === "new") newSession();
      if (action === "reconnect") connect(true).catch(error => message(error.message));
      if (action === "import") document.getElementById("import").click();
      if (action === "technical") { technical.open = !technical.open; if (technical.open) technical.scrollIntoView({ behavior: "instant" }); }
    } catch (error) { message(error.message); }
  });
  window.addEventListener("hashchange", () => { renderKey = ""; try { show(); } catch (error) { message(error.message); } });
  window.addEventListener("attobrain-import", event => {
    try {
      const data = event.detail;
      const html = interpretationView(data.report, data.manifest.participant, data.manifest.sessionId, true, data.manifest.endReason);
      showImported(data);
      imported = data; document.getElementById("interpretation").innerHTML = html;
      document.getElementById("result-technical").open = false;
      navigate("results");
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (error) { message(`Arquivo incompatível: ${error.message}`); }
  });
  try { show(); } catch (error) { message(error.message); }
  return {
    update(previous) {
      if (!imported && state()?.closed && !previous?.closed) navigate("results");
      if (!["overview", "students"].includes(route())) show();
    },
    isImported: () => !!imported,
    show,
  };
}
