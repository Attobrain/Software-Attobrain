import { escape as esc } from "./format.js";
import { loadStudents, readStudents, saveStudent, removeStudent, studentForm, studentList, loadHistory, historyPage, participantOf } from "./students.js";
import { drawBoard } from "./board.js";
import { interpretationView } from "./interpretation-view.js";
import { createReportTabs } from "./report-tabs.js";

export function createPlatform({ connect, command, state, credentials, socket, message, timeline, showImported, restoreLive, newSession }) {
  const page = document.getElementById("platform-view"), session = document.getElementById("session-view");
  let historyOf = null, historyRows = [], editId = null, creating = false, selected = null, returnToFlow = false, renderKey = "", previewTimer, pending = false, imported = null, previews = [];
  const technical = document.createElement("details");
  technical.id = "technical-panel"; technical.className = "card technical-panel";
  technical.innerHTML = '<summary>Detalhes da sessão</summary>';
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
  document.getElementById("execution-panel").insertAdjacentHTML("beforeend", '<button class="secondary" data-flow="technical">Detalhes da sessão</button>');
  document.getElementById("result-new").onclick = newSession;
  const heading = (title, description) => `<section class="page-heading"><div><h1 tabindex="-1">${title}</h1><p>${description}</p></div></section>`;
  function route() {
    const value = location.hash.slice(1);
    if (value === "project") {
      history.replaceState(null, "", `${location.pathname}${location.search}#overview`);
      return "overview";
    }
    if (["prepare", "maze", "monitor", "activity-setup", "monitoring"].includes(value)) return "session";
    if (value === "result") return "results";
    return value || "overview";
  }
  function navigate(value) {
    if (location.hash === `#${value}`) { renderKey = ""; show(); }
    else location.hash = value;
  }
  function studentsPage(selection = false) {
    const list = readStudents();
    const continuation = selection ? `<button id="confirm-participant" data-flow="participant" ${list.some(v => String(v.id) === String(selected)) ? "" : "disabled"}>Confirmar aluno e continuar →</button>` : "";
    return `${selection ? "" : heading("Alunos", "Cadastre e consulte os alunos acompanhados por você.")}<section class="card student-picker"><div class="section-heading"><h2>${selection ? "Quem vai participar?" : "Alunos cadastrados"}</h2><button class="secondary" data-student="create">Cadastrar aluno</button></div><label class="student-search">Buscar aluno<input id="student-search" type="search" placeholder="Nome ou escola" autocomplete="off"></label><div id="student-rows">${studentList(list, selection, selected)}</div><p id="student-selected" role="status">${selection ? "Selecione um aluno para continuar." : `${list.length} aluno(s) cadastrado(s).`}</p>${continuation}</section>`;
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
      document.getElementById("preview-description").textContent = `${reply.preview[0].label} · labirinto ${config.level} × ${config.level}. ${config.mode === "protocol" ? "A, B e C usam labirintos fixos." : `Código ${config.seed}, sem comparação entre atividades.`} Prévia: nada foi registrado.`;
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
      page.innerHTML = `${heading("Abrir resultado", "Veja um relatório que você baixou antes.")}<section class="card"><p>Escolha o arquivo salvo no seu computador. É só para consulta e não altera o histórico do aluno. Se recarregar a página, abra o arquivo de novo.</p><button data-flow="import">Abrir relatório salvo</button></section>`;
      return;
    }
    if (platformPage) {
      technical.hidden = true;
      if (current === "overview") page.innerHTML = `${heading("Painel do profissional", "Acesse sessões, alunos e relatórios.")}<section class="home-grid" aria-label="Ações principais"><article class="card home-action-card home-action-primary"><span class="eyebrow">SESSÕES</span><h2>Preparar sessão</h2><p>Selecione um aluno e configure a atividade.</p><a href="#session" class="button">${credentials()?.id ? "Continuar sessão" : "Iniciar sessão"}</a></article><article class="card home-action-card"><span class="eyebrow">CADASTROS</span><h2>Alunos</h2><p>Consulte cadastros e históricos de sessão.</p><a href="#students" class="button secondary">Gerenciar alunos</a></article><article class="card home-action-card"><span class="eyebrow">RELATÓRIOS</span><h2>Relatório salvo</h2><p>Abra um arquivo de relatório para consulta.</p><button class="secondary" data-flow="import">Abrir relatório</button></article></section>`;
      else if (creating || editId) page.innerHTML = `${heading("Cadastro de aluno", "Os dados ficam salvos no sistema e podem ser editados depois.")}${studentForm(editId ? readStudents().find(v => String(v.id) === String(editId)) : {})}`;
      else if (historyOf) page.innerHTML = `${heading("Histórico do aluno", "Resumo das sessões do labirinto já encerradas.")}${historyPage(readStudents().find(v => String(v.id) === String(historyOf)), historyRows)}`;
      else page.innerHTML = studentsPage();
      return;
    }
    if (!s && !imported) {
      document.getElementById("wizard-panel").innerHTML = '<section class="card"><h2>Conectando a sessão</h2><p>Aguardando o servidor…</p><button class="secondary" data-flow="reconnect">Tentar conectar novamente</button><button class="secondary" data-flow="new">Criar outra sessão</button></section>';
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
      document.getElementById("flow-description").textContent = execution ? `${s.participant?.name ?? "Participante demonstrativo"} · O resumo aparece ao final da sessão.` : "Uma etapa por vez.";
      const wizard = document.getElementById("wizard-panel");
      if (w.step === "participant") wizard.innerHTML = studentsPage(true);
      if (config) {
        const form = document.getElementById("configuration");
        for (const [name, value] of Object.entries(s.config)) if (form.elements.namedItem(name)) form.elements.namedItem(name).value = String(value);
        document.getElementById("activity-setup").open = true;
        updatePreview();
      }
      if (w.step === "review") wizard.innerHTML = `<section class="review-grid"><article class="card"><span class="eyebrow">CONFERÊNCIA</span><h2>${esc(s.participant?.name)}</h2><dl class="review-values"><dt>Tipo de sessão</dt><dd>${s.config.mode === "protocol" ? "Treino + atividades A, B e C" : "Uma atividade livre (exploração)"}</dd><dt>Tamanho do labirinto</dt><dd>${s.config.level} × ${s.config.level}</dd><dt>Interação demonstrativa</dt><dd>Controle visual do percurso</dd><dt>Tempo máximo</dt><dd>Treino ${s.config.trainingSeconds} s · cada atividade ${s.config.activitySeconds} s</dd><dt>Intervalo entre atividades</dt><dd>${s.config.intervalSeconds} s</dd></dl><details class="parameters"><summary>Sobre esta demonstração</summary><p>O controle ocular é só visual; a integração com sensores está em desenvolvimento. O sinal neurofisiológico é gerado por software e não entra na análise.</p><p>Sinal sintético: ${s.config.channels} canais · ${s.config.sampleRate} Hz · ${s.config.eegMode === "independent" ? "independente da atividade" : "reação didática à interação"}.</p></details><p>A análise descreve os registros do percurso e não atribui atenção nem atividade cerebral.</p><button class="secondary" data-flow="back" data-step="configuration">Voltar às configurações</button></article><article class="card connection-review"><span class="eyebrow">DUAS JANELAS NO MESMO COMPUTADOR</span><h2>Conecte a tela do aluno</h2><img class="connection-illustration" src="/assets/screens-guide.png" alt="" width="180" height="130"><p>Deixe a janela do aluno visível ao lado deste painel. Trocar de aba pode pausar a atividade.</p><button class="secondary" data-flow="open">Abrir tela do aluno</button><p id="review-connection" role="status"></p><p id="popup-help">Janela bloqueada? Permita pop-ups deste site.</p><button data-flow="begin" id="begin-session">Iniciar sessão →</button></article></section>`;
      if (result) {
        document.getElementById("interpretation").innerHTML = interpretationView(s.report, s.participant, s.id, false, s.endReason);
        reportTabs.activate("summary");
        document.getElementById("result-technical").open = true;
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
    if (chosen) document.getElementById("preview-description").textContent = `${chosen.label} · labirinto ${chosen.maze.cols} × ${chosen.maze.rows} · código ${chosen.seed}. Prévia: nada foi registrado.`;
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
      document.getElementById("result-technical").open = true;
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
