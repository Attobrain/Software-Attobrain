import { escape as esc } from "./format.js";
import { loadStudents, readStudents, saveStudent, removeStudent, studentForm, studentList, loadHistory, historyPage, participantOf } from "./students.js";
import { drawBoard } from "./board.js";
import { interpretationView } from "./interpretation-view.js";
import { createReportTabs } from "./report-tabs.js";
import { projectProfileView } from "./project-profile.js";

export function createPlatform({ connect, command, state, credentials, socket, message, timeline, showImported, restoreLive, newSession }) {
  const page = document.getElementById("platform-view"), session = document.getElementById("session-view");
  let historyOf = null, historyRows = [], editId = null, creating = false, selected = null, returnToFlow = false, renderKey = "", previewTimer, pending = false, imported = null, previews = [];
  const technical = document.createElement("details");
  technical.id = "technical-panel"; technical.className = "card technical-panel";
  technical.innerHTML = '<summary>Detalhes da sessão (avançado)</summary>';
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
  const reportTabs = createReportTabs(technical, notes);
  document.getElementById("execution-panel").insertAdjacentHTML("beforeend", '<button class="secondary" data-flow="technical">Ver detalhes da sessão (avançado)</button>');
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
    const continuation = selection ? `<button id="confirm-participant" data-flow="participant" ${list.some(v => String(v.id) === String(selected)) ? "" : "disabled"}>Confirmar aluno e continuar →</button>` : "";
    return `${selection ? "" : heading("Alunos", "Cadastre e consulte os alunos acompanhados por você.")}<section class="card student-picker"><div class="section-heading"><h2>${selection ? "Quem vai participar?" : "Alunos cadastrados"}</h2><button class="secondary" data-student="create">Cadastrar aluno</button></div><label class="student-search">Buscar aluno<input id="student-search" type="search" placeholder="Nome ou escola" autocomplete="off"></label><div id="student-rows">${studentList(list, selection, selected)}</div><p id="student-selected" role="status">${selection ? "Selecione e confirme o aluno para continuar." : `${list.length} aluno(s) cadastrado(s).`}</p>${continuation}</section>`;
  }
  function steps(s) {
    const list = s.config.mode === "single" ? [["participant", "Aluno"], ["configuration", "Configuração"], ["review", "Revisão"], ["activity", "Atividade"]] : [["participant", "Aluno"], ["configuration", "Configuração"], ["review", "Revisão"], ["training", "Treino"], ["A", "A"], ["B", "B"], ["C", "C"]];
    const index = list.findIndex(([key]) => key === s.workflow.step);
    document.getElementById("flow-steps").innerHTML = `<p class="step-count">Etapa ${Math.max(1, index + 1)} de ${list.length} · ${esc(list[index]?.[1] ?? "Resultados")}</p><ol class="guided-steps">${list.map(([key, title], i) => {
      const outcome = s.workflow.runStates?.[key];
      const interrupted = ["ABORTED", "TIMED_OUT"].includes(outcome);
      const caption = outcome === "ABORTED" ? "Interrompida" : outcome === "TIMED_OUT" ? "Tempo encerrado" : outcome === "PAUSED" ? "Pausada" : outcome === "COMPLETED" ? "Concluída" : i === index ? "Atual" : i < index ? "Concluída" : "Aguardando";
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
      if (error || reply?.error) { document.getElementById("preview-description").textContent = reply?.error ?? "Não foi possível mostrar a prévia agora. Verifique a conexão e tente alterar uma opção novamente."; return; }
      if (route() !== "session" || state()?.workflow.step !== "configuration") return;
      previews = reply.preview;
      const selector = document.getElementById("preview-phase");
      const previous = selector.value;
      selector.replaceChildren(...previews.map(p => new Option(p.label, p.label)));
      if (previews.some(p => p.label === previous)) selector.value = previous;
      drawBoard(document.getElementById("preview-board"), previews.find(p => p.label === selector.value));
      document.getElementById("preview-description").textContent = `${reply.preview[0].label} · labirinto de ${config.level} × ${config.level}. ${config.mode === "protocol" ? "As atividades A, B e C usam labirintos fixos, para poderem ser comparadas." : `Exploração · código do labirinto ${config.seed}; sem comparação entre atividades.`} Nada foi registrado ainda.`;
    });
  }
  function show() {
    const current = route(), s = state();
    if (current === "session" && imported) { imported = null; renderKey = ""; timeline.reset(); restoreLive(); }
    const platformPage = ["overview", "students", "project"].includes(current);
    page.hidden = !platformPage; session.hidden = platformPage;
    document.querySelectorAll(".side-nav .nav-link").forEach(link => {
      const active = link.hash === `#${platformPage ? current : "session"}`;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
    });
    if (current === "results" && !s && !imported && !credentials()?.id) {
      page.hidden = false; session.hidden = true;
      page.innerHTML = `${heading("Abrir resultado", "Veja um relatório que você baixou antes.")}<section class="card"><p>Escolha o arquivo do relatório salvo no seu computador. Ele é só para consulta e não altera o histórico do aluno. Se a página for recarregada, abra o arquivo de novo.</p><button data-flow="import">Abrir relatório salvo</button></section>`;
      return;
    }
    if (platformPage) {
      technical.hidden = true;
      if (current === "overview") page.innerHTML = `${heading("Painel do profissional", "Prepare uma atividade, acompanhe o percurso e compreenda os resultados.")}<section class="platform-notice overview-notice"><div class="overview-notice-copy"><span class="eyebrow">VISÃO FUTURA · INTERFACE CONCEITUAL</span><strong>Um labirinto preparado para novas camadas de leitura</strong><p>Veja como uma trajetória de olhar e sinais neurofisiológicos poderão se relacionar ao percurso. As artes antecipam essa experiência; os sensores ainda não estão conectados.</p><details class="simulation-disclosure"><summary>Como os dados são demonstrados hoje?</summary><p>O percurso usa uma entrada provisória para movimentar o ponto no labirinto. A onda neurofisiológica é gerada artificialmente e não entra na análise da sessão.</p></details><a class="project-overview-link" href="#project">Conheça a proposta e os limites do projeto →</a></div><img class="overview-future-art art-float" src="/assets/future-sensor-concept.png" alt="Conceito visual de sensores oculares e faixa neurofisiológica ao lado de um labirinto" width="1000" height="667" fetchpriority="high"></section><section class="future-capabilities" aria-labelledby="future-capabilities-title"><div class="section-heading"><div><span class="eyebrow">POSSIBILIDADES DE EVOLUÇÃO</span><h2 id="future-capabilities-title">Uma experiência, diferentes camadas</h2></div><span class="concept-badge">Simulações visuais</span></div><div class="future-capability-grid"><article class="future-capability-card"><div class="future-capability-art art-float"><img src="/assets/gaze-maze-vision.png" alt="" width="1000" height="667" loading="lazy"></div><span class="future-layer-status">VISÃO CONCEITUAL</span><h3>Trajetória do olhar</h3><p>Pontos de fixação poderiam ser apresentados sobre o percurso quando houver integração com sensor ocular.</p></article><article class="future-capability-card"><div class="future-capability-art art-float art-delay-1"><img src="/assets/visual-focus-concept.png" alt="" width="1000" height="667" loading="lazy"></div><span class="future-layer-status">HIPÓTESE DE INTERFACE</span><h3>Foco visual</h3><p>Uma forma didática de explicar para onde a leitura visual se orienta, sem atribuir atenção ou diagnóstico.</p></article><article class="future-capability-card"><div class="future-capability-art art-float art-delay-2"><img src="/assets/neural-signal-concept.png" alt="" width="1000" height="667" loading="lazy"></div><span class="future-layer-status">SINAL SINTÉTICO</span><h3>Atividade neurofisiológica</h3><p>O painel avançado demonstra o formato de uma onda; nenhum dado cerebral real é coletado.</p></article></div></section><div class="home-grid"><article class="card"><span class="home-number">01</span><h2>Alunos</h2><p>Cadastre seus alunos e consulte o histórico de sessões de cada um.</p><a href="#students" class="button secondary">Consultar alunos →</a></article><article class="card"><span class="home-number">02</span><h2>Labirinto</h2><p>Prepare a sessão passo a passo: treino e atividades A, B e C.</p><a href="#session" class="button">${credentials()?.id ? "Continuar sessão" : "Preparar atividade"} →</a></article></div><section class="card import-card"><h2>Abrir um relatório salvo</h2><p>Reveja o relatório de uma sessão que você baixou antes. É só para consulta e não interfere em uma sessão em andamento.</p><button class="secondary" data-flow="import">Abrir relatório salvo</button></section>`;
      else if (current === "project") page.innerHTML = projectProfileView();
      else if (creating || editId) page.innerHTML = `${heading("Cadastro de aluno", "Os dados ficam salvos no sistema e podem ser editados depois.")}${studentForm(editId ? readStudents().find(v => String(v.id) === String(editId)) : {})}`;
      else if (historyOf) page.innerHTML = `${heading("Histórico do aluno", "Resumo das sessões do labirinto já encerradas.")}${historyPage(readStudents().find(v => String(v.id) === String(historyOf)), historyRows)}`;
      else page.innerHTML = studentsPage();
      return;
    }
    if (!s && !imported) {
      document.getElementById("wizard-panel").innerHTML = '<section class="card"><h2>Conectando a sessão</h2><p>Aguardando confirmação do servidor…</p><button class="secondary" data-flow="reconnect">Tentar conectar novamente</button><button class="secondary" data-flow="new">Criar outra sessão</button></section>';
      connect().catch(error => message(error.message));
      return;
    }
    if (current === "results" && imported) {
      reportTabs.show(true);
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
    reportTabs.show(result);
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
      document.getElementById("flow-description").textContent = execution ? `${s.participant?.name ?? "Participante demonstrativo"} · A análise completa aparece ao final da sessão.` : "Uma etapa de cada vez, com os dados necessários para começar.";
      const wizard = document.getElementById("wizard-panel");
      if (w.step === "participant") wizard.innerHTML = studentsPage(true);
      if (config) {
        const form = document.getElementById("configuration");
        for (const [name, value] of Object.entries(s.config)) if (form.elements.namedItem(name)) form.elements.namedItem(name).value = String(value);
        document.getElementById("activity-setup").open = true;
        updatePreview();
      }
      if (w.step === "review") wizard.innerHTML = `<section class="review-grid"><article class="card"><span class="eyebrow">CONFERÊNCIA</span><h2>${esc(s.participant?.name)}</h2><dl class="review-values"><dt>Tipo de sessão</dt><dd>${s.config.mode === "protocol" ? "Treino + atividades A, B e C" : "Uma atividade livre (exploração)"}</dd><dt>Tamanho do labirinto</dt><dd>${s.config.level} × ${s.config.level}</dd><dt>Interação demonstrativa</dt><dd>Trajetória visual com entrada provisória</dd><dt>Tempo máximo</dt><dd>Treino ${s.config.trainingSeconds} s · cada atividade ${s.config.activitySeconds} s</dd><dt>Descanso entre atividades</dt><dd>${s.config.intervalSeconds} s</dd></dl><details class="parameters"><summary>Como as leituras são simuladas</summary><p>O ponteiro movimenta o ponto como entrada provisória para demonstrar o percurso. Não há sensor ocular conectado. O sinal neurofisiológico é gerado por software e não entra na análise.</p><p>Sinal sintético: ${s.config.channels} canais · ${s.config.sampleRate} Hz · ${s.config.eegMode === "independent" ? "independente da atividade" : "reação didática à interação"}.</p></details><p>A análise descreve os registros do percurso e não atribui atenção nem atividade cerebral.</p><button class="secondary" data-flow="back" data-step="configuration">Voltar às configurações</button></article><article class="card connection-review"><span class="eyebrow">DUAS JANELAS NO MESMO COMPUTADOR</span><h2>Conecte a tela do aluno</h2><img class="connection-illustration" src="/assets/screens-guide.png" alt="" width="180" height="130"><p>Abra a janela do aluno e deixe-a visível ao lado deste painel. Alternar abas pode ocultar a atividade e provocar uma pausa.</p><button class="secondary" data-flow="open">Abrir tela do aluno</button><p id="review-connection" role="status"></p><p id="popup-help">Se a janela não abrir, permita o popup deste site e tente novamente.</p><button data-flow="begin" id="begin-session">Iniciar sessão →</button></article></section>`;
      if (result) {
        document.getElementById("interpretation").innerHTML = interpretationView(s.report, s.participant, s.id, false, s.endReason);
        reportTabs.activate("summary");
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
    if (chosen) document.getElementById("preview-description").textContent = `${chosen.label} · labirinto de ${chosen.maze.cols} × ${chosen.maze.rows} · código ${chosen.seed}. Prévia: nada foi registrado. Formato parecido não garante a mesma dificuldade para o aluno.`;
  };
  document.addEventListener("input", event => {
    if (event.target.id !== "student-search") return;
    const query = event.target.value.toLocaleLowerCase("pt-BR");
    document.getElementById("student-rows").innerHTML = studentList(readStudents().filter(v => `${v.nome} ${v.escola ?? ""}`.toLocaleLowerCase("pt-BR").includes(query)), route() === "session", selected);
  });
  document.addEventListener("submit", async event => {
    if (event.target.id !== "student-form") return;
    event.preventDefault();
    const salvar = event.target.querySelector('button[type="submit"]');
    salvar.disabled = true; // evita cadastro duplicado por clique duplo
    try {
      const value = await saveStudent(Object.fromEntries(new FormData(event.target)), editId);
      creating = false; editId = null; selected = value.id;
      if (returnToFlow) { returnToFlow = false; navigate("session"); }
      else show();
    } catch (error) {
      document.getElementById("student-error").textContent = error.message;
      salvar.disabled = false;
    }
  });
  document.addEventListener("click", event => {
    const anchor = event.target.closest('a[href="#timeline"], a[href="#diagnostics"]');
    if (anchor) {
      event.preventDefault();
      if(!document.getElementById("result-panel").hidden) reportTabs.activate(anchor.hash==="#timeline"?"evidence":"technical");
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
        reportTabs.activate("evidence");
        technical.hidden = false; technical.open = true;
        timeline.inspectAt(Number(button.dataset.evidence), !!imported);
        document.getElementById("timeline").scrollIntoView({ behavior: "instant" });
      }
      if (button.dataset.student) {
        const action = button.dataset.student;
        if (action === "select") { selected = button.dataset.id; document.getElementById("confirm-participant").disabled = false; document.getElementById("student-selected").textContent = `Selecionado: ${readStudents().find(v => String(v.id) === String(selected)).nome}`; }
        if (action === "create" || action === "edit") { returnToFlow = route() === "session"; editId = action === "edit" ? button.dataset.id : null; creating = true; navigate("students"); }
        if (action === "delete" && confirm("Excluir este aluno? O histórico de sessões dele também será apagado.")) removeStudent(button.dataset.id).then(() => { if (String(selected) === String(button.dataset.id)) selected = null; show(); }).catch(error => message(error.message));
        if (action === "history") loadHistory(button.dataset.id).then(rows => { historyOf = button.dataset.id; historyRows = rows; renderKey = ""; show(); }).catch(error => message(error.message));
        if (action === "cancel") { creating = false; editId = null; historyOf = null; navigate(returnToFlow ? "session" : "students"); returnToFlow = false; }
      }
      const action = button.dataset.flow;
      if (action === "participant") attempt("select-participant", { participant: participantOf(selected) });
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
  window.addEventListener("hashchange", () => { renderKey = ""; historyOf = null; try { show(); } catch (error) { message(error.message); } });
  window.addEventListener("attobrain-import", event => {
    try {
      const original = event.detail;
      const data = original.report ? original : { ...original, report: {
        analysis:null, description:"Este arquivo é antigo e não traz o relatório pronto. Os registros originais continuam disponíveis para consulta.",rules:[],aggregates:{},pairs:[],
        evaluations:original.runs.filter(r=>["A","B","C"].includes(r.label)).map(r=>({...r,runId:r.id})),
        training:original.runs.filter(r=>r.label==="Treinamento").map(r=>({...r,runId:r.id})),single:original.runs.filter(r=>r.label==="Exploração").map(r=>({...r,runId:r.id})),
      }};
      const html = interpretationView(data.report, data.manifest.participant, data.manifest.sessionId, true, data.manifest.endReason);
      showImported(data);
      imported = data; document.getElementById("interpretation").innerHTML = html;
      reportTabs.activate("summary");
      document.getElementById("result-technical").open = false;
      navigate("results");
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (error) { message(`Não foi possível abrir este relatório. Confirme que o arquivo foi baixado pelo Attobrain (botão "Baixar relatório da sessão") e tente de novo. Detalhe: ${error.message}`); }
  });
  try { show(); } catch (error) { message(error.message); }
  loadStudents().then(() => { renderKey = ""; show(); }).catch(error => message(error.message));
  return {
    update(previous) {
      if (!imported && state()?.closed && !previous?.closed) navigate("results");
      if (!["overview", "students"].includes(route())) show();
    },
    isImported: () => !!imported,
    show,
  };
}
