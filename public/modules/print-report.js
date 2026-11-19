// Relatório impresso: documento simples, em preto e branco, no formato de laudo/relatório.
// Monta uma folha própria só na hora de imprimir; a tela do sistema não é usada na impressão.
import { escape as esc } from "./format.js";
import { runsOf } from "./report-parts.js";
import { summarize, indicators, trendOf, trendText, moments, clock, words } from "./distraction.js";

const motivos = {
  completed: "Sessão concluída",
  "timed-out": "Tempo da atividade esgotado",
  voluntary: "Encerrada pelo profissional",
  technical: "Encerrada por problema técnico",
  "session-limit": "Limite de tempo da sessão",
};
const minutes = (ms) => {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)} min ${String(total % 60).padStart(2, "0")} s`;
};
// A data vem como AAAA-MM-DD; montar à mão evita o erro de um dia por causa do fuso horário.
const dateBr = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value.split("-").reverse().join("/") : "—");
const row = (label, value) => `<tr><th scope="row">${esc(label)}</th><td>${esc(value || "—")}</td></tr>`;

function indicatorTable(runs) {
  const sums = runs.map((r) => summarize(r.result, r.feature));
  const head = `<tr><th scope="col">Indicador</th>${runs.map((r) => `<th scope="col">${esc(r.label)}</th>`).join("")}</tr>`;
  const line = (title, pick) => `<tr><th scope="row">${esc(title)}</th>${sums.map((s) => `<td>${s ? esc(pick(s)) : "—"}</td>`).join("")}</tr>`;
  const body = [
    line(words.activeTime, (s) => minutes(s.active)),
    ...indicators.map((ind) => line(ind.title, (s) => (Number.isFinite(ind.value(s)) ? ind.show(ind.value(s)) : "—"))),
  ].join("");
  return `<table class="pr-table pr-grid"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

// Mesmas regras da tela: a evolução só vale com labirintos equivalentes e atividades concluídas.
function findings(runs, comparable = true) {
  const unica = runs.length < 2 || runs.some((r) => r.label === "Exploração");
  if (unica) {
    const s = summarize(runs[0]?.result, runs[0]?.feature);
    if (!s) return "<p>Não há dados suficientes para a síntese.</p>";
    return `<p>Foram registradas ${s.distractions ?? "—"} distração(ões) em ${minutes(s.active)} de atividade, com ${s.stops ?? "—"} momento(s) parado.</p>`;
  }
  if (!comparable) return "<p>Os labirintos das atividades não são equivalentes; por isso não há comparação entre elas. Veja os indicadores de cada uma abaixo.</p>";
  const concluidas = runs.filter((r) => r.state === "COMPLETED" && r.result);
  if (concluidas.length < 2) return "<p>A evolução entre atividades exige duas ou mais atividades concluídas.</p>";
  const items = ["distractions", "stops", "recovery"].map((key) => {
    const ind = indicators.find((i) => i.key === key);
    const trend = trendOf(concluidas.map((r) => ({ label: r.label, value: ind.value(summarize(r.result, r.feature) ?? {}) })));
    return trend ? `<li><strong>${esc(ind.title)}:</strong> ${esc(trendText(trend, ind))}</li>` : "";
  }).filter(Boolean);
  return items.length ? `<ul>${items.join("")}</ul>` : "<p>Não há dados suficientes para comparar as atividades.</p>";
}

function momentsTable(runs) {
  const rows = runs.flatMap((r) =>
    moments(r.result, r.label).slice(0, 3).map((m) => `<tr><td>${esc(m.label)}</td><td>${esc(clock(m.sessionTime))}</td><td>${esc(m.text)}</td></tr>`),
  );
  if (!rows.length) return "<p>Nenhum momento de distração registrado.</p>";
  return `<table class="pr-table pr-grid pr-left"><thead><tr><th scope="col">Atividade</th><th scope="col">Tempo da sessão</th><th scope="col">Ocorrência</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
}

// s = estado da sessão; aluno = cadastro do aluno (ou null); profissional = nome de quem está logado.
export function reportHtml(s, aluno, profissional, notes, now = new Date()) {
  const runs = runsOf(s.report);
  const mode = s.config?.mode === "single" ? "Atividade livre (exploração)" : "Treino e atividades A, B e C";
  const observacoes = notes?.trim()
    ? `<p class="pr-notes">${esc(notes.trim())}</p>`
    : '<div class="pr-lines"><i></i><i></i><i></i><i></i></div>';
  return `<header class="pr-head"><p class="pr-brand">ATTOBRAIN</p><h1>Relatório de sessão</h1><p class="pr-sub">Atividade de atenção — labirinto</p></header>
<section><h2>Identificação</h2><table class="pr-table"><tbody>${row("Aluno", s.participant?.name)}${row("Data de nascimento", dateBr(aluno?.dataNascimento))}${row("Escola", aluno?.escola)}${row("Turma", aluno?.turma)}${row("Responsável", aluno?.responsavel)}${row("Profissional responsável", profissional)}${row("Data da sessão", now.toLocaleDateString("pt-BR"))}${row("Tipo de sessão", mode)}${row("Tamanho do labirinto", s.config?.level ? `${s.config.level} × ${s.config.level}` : "")}${row("Encerramento", motivos[s.endReason])}</tbody></table></section>
<section><h2>1. Síntese</h2>${findings(runs, s.report?.analysis?.quality?.comparable !== false)}</section>
<section><h2>2. Indicadores por atividade</h2>${indicatorTable(runs)}<p class="pr-note">Distração: vez em que o aluno encostou na parede. Momento parado: período com quase nenhum movimento.</p></section>
<section><h2>3. Momentos de maior distração</h2>${momentsTable(runs)}</section>
<section class="pr-keep"><h2>4. Observações do profissional</h2>${observacoes}</section>
<section class="pr-sign"><div><i></i><span>${esc(profissional || "Profissional responsável")}</span></div><div><i></i><span>Data</span></div></section>
<footer class="pr-foot">Documento gerado pelo sistema Attobrain em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.</footer>`;
}

export async function printReport(s, aluno, notes) {
  let profissional = "";
  try {
    const resposta = await fetch("/api/me", { credentials: "same-origin" });
    if (resposta.ok) profissional = (await resposta.json()).nome ?? "";
  } catch { /* sem o nome, a linha de assinatura fica genérica */ }
  document.getElementById("print-sheet")?.remove();
  const sheet = document.createElement("div");
  sheet.id = "print-sheet";
  sheet.innerHTML = reportHtml(s, aluno, profissional, notes);
  document.body.append(sheet);
  window.addEventListener("afterprint", () => sheet.remove(), { once: true });
  window.print();
}
