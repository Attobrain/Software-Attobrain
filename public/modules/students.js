import { escape as esc } from "./format.js";

// Alunos vêm do servidor (MySQL). A lista fica em memória para a tela desenhar de forma simples.
let alunos = [];
let carregado = false; // enquanto a primeira busca não termina, a lista mostra "Carregando"

async function chamar(url, opcoes = {}) {
  const resposta = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...opcoes,
  });
  if (resposta.status === 401) { location.href = "/login"; throw Error("Faça login para continuar."); }
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw Error(dados.erro || "Não foi possível concluir a operação.");
  return dados;
}

export async function loadStudents() {
  try {
    alunos = await chamar("/api/alunos");
  } finally {
    carregado = true;
  }
  return alunos;
}
export const readStudents = () => alunos;

export async function saveStudent(valor, id) {
  const salvo = await chamar(id ? `/api/alunos/${id}` : "/api/alunos", { method: id ? "PUT" : "POST", body: JSON.stringify(valor) });
  await loadStudents().catch(() => {}); // o aluno já foi salvo; se a lista não recarregar, a próxima tentativa corrige
  return salvo;
}
export async function removeStudent(id) {
  await chamar(`/api/alunos/${id}`, { method: "DELETE" });
  await loadStudents().catch(() => {});
}
export const loadHistory = (id) => chamar(`/api/alunos/${id}/sessoes`);
export const participantOf = (id) => {
  const aluno = alunos.find(v => String(v.id) === String(id));
  return aluno ? { id: String(aluno.id), name: aluno.nome } : undefined;
};

export function studentForm(a = {}) {
  return `<form id="student-form" class="card student-form"><h2>${a.id ? "Editar" : "Cadastrar"} aluno</h2><label>Nome completo<input name="nome" maxlength="100" required value="${esc(a.nome ?? "")}"></label><label>Data de nascimento<input name="dataNascimento" type="date" value="${esc(a.dataNascimento ?? "")}"></label><label>Escola<input name="escola" maxlength="100" value="${esc(a.escola ?? "")}"></label><label>Turma<input name="turma" maxlength="50" value="${esc(a.turma ?? "")}"></label><label>Responsável<input name="responsavel" maxlength="100" value="${esc(a.responsavel ?? "")}"></label><label>Observações<input name="observacoes" maxlength="500" value="${esc(a.observacoes ?? "")}"></label><div class="controls"><button type="submit">Salvar cadastro</button><button type="button" class="secondary" data-student="cancel">Cancelar</button></div><p class="field-error" role="alert" id="student-error"></p></form>`;
}

export function studentList(lista, selection = false, selected = null) {
  if (!lista.length) return `<p class="empty-state" role="status">${carregado ? "Nenhum aluno encontrado." : "Carregando alunos..."}</p>`;
  const linhas = lista.map(v => {
    const id = esc(String(v.id));
    const acoes = selection
      ? `<button class="${String(selected) === String(v.id) ? "" : "secondary"}" data-student="select" data-id="${id}" aria-label="Selecionar ${esc(v.nome)}">${String(selected) === String(v.id) ? "Selecionado" : "Selecionar"}</button>`
      : `<button class="secondary" data-student="history" data-id="${id}" aria-label="Histórico de ${esc(v.nome)}">Histórico</button><button class="secondary" data-student="edit" data-id="${id}" aria-label="Editar ${esc(v.nome)}">Editar</button><button class="danger" data-student="delete" data-id="${id}" aria-label="Excluir ${esc(v.nome)}">Excluir</button>`;
    return `<tr><td>${esc(v.nome)}</td><td>${esc(v.escola ?? "")}</td><td>${esc(v.turma ?? "")}</td><td><div class="controls">${acoes}</div></td></tr>`;
  }).join("");
  return `<div class="table-wrap"><table class="result-table"><thead><tr><th>Aluno</th><th>Escola</th><th>Turma</th><th>Ações</th></tr></thead><tbody>${linhas}</tbody></table></div>`;
}

const motivos = { completed: "Concluída", "timed-out": "Tempo esgotado", voluntary: "Encerrada pelo profissional", technical: "Problema técnico", "session-limit": "Limite de tempo" };
export function historyPage(aluno, sessoes) {
  const linhas = sessoes.map(s => `<tr><td>${esc(new Date(s.realizadaEm).toLocaleString("pt-BR"))}</td><td>${esc(s.nivel ?? "-")}</td><td>${esc(String(s.fasesConcluidas))}</td><td>${esc(String(s.tempoAtivoSeg))} s</td><td>${esc(String(s.totalColisoes ?? "-"))}</td><td>${esc(motivos[s.motivoFim] ?? "-")}</td></tr>`).join("");
  const tabela = sessoes.length
    ? `<div class="table-wrap"><table class="result-table"><thead><tr><th>Data</th><th>Nível</th><th>Fases concluídas</th><th>Tempo ativo</th><th>Distrações</th><th>Encerramento</th></tr></thead><tbody>${linhas}</tbody></table></div>`
    : '<p class="empty-state" role="status">Este aluno ainda não tem sessões registradas.</p>';
  return `<section class="card"><div class="section-heading"><h2>Histórico de ${esc(aluno?.nome ?? "aluno")}</h2><button class="secondary" data-student="cancel">Voltar</button></div>${tabela}</section>`;
}
