import { escape as esc } from "./format.js";
const samples = [
  { id: "victor", name: "Victor Gabriel Ferreira Theodoro", institution: "FATEC Registro", course: "DSM — Projeto Integrador I" },
  { id: "laura", name: "Laura Julia Mathias Amaral", institution: "FATEC Registro", course: "Desenvolvimento de Software Multiplataforma" },
  { id: "luiz", name: "Luiz Henrique Severo Cubas", institution: "FATEC Registro", course: "Desenvolvimento de Software Multiplataforma" },
  { id: "millie", name: "Millie Zanon Morelli Santos", institution: "FATEC Registro", course: "Desenvolvimento de Software Multiplataforma" },
  { id: "mario", name: "Mario Armando Takahashi Martins Dias", institution: "FATEC Registro", course: "Desenvolvimento de Software Multiplataforma" },
];
const key = "attobrain-students";
export function readStudents() {
  const raw = localStorage.getItem(key);
  if (raw === null) { localStorage.setItem(key, JSON.stringify(samples)); return samples.map(v => ({...v})); }
  const values = JSON.parse(raw);
  if (!Array.isArray(values) || values.some(v => !v || typeof v.id !== "string" || typeof v.name !== "string" || typeof v.institution !== "string" || (v.course !== undefined && typeof v.course !== "string"))) throw Error("Cadastros locais inválidos. Os dados originais foram preservados.");
  return values;
}
export function saveStudent(value, id) {
  const student = {};
  for (const [key, max] of [["name",100],["institution",100],["course",120]]) {
    student[key] = String(value[key] ?? "").trim();
    if (student[key].length > max) throw Error("Campo acima do limite permitido.");
  }
  if (!student.name || !student.institution) throw Error("Informe nome e instituição.");
  const list = readStudents();
  student.id = id || crypto.randomUUID();
  if (id && !list.some(v => v.id === id)) throw Error("Cadastro não encontrado.");
  localStorage.setItem(key, JSON.stringify(id ? list.map(v => v.id === id ? student : v) : [...list,student]));
  return student;
}
export function removeStudent(id) {
  localStorage.setItem(key, JSON.stringify(readStudents().filter(v => v.id !== id)));
}
export function studentForm(student = {}) {
  return `<form id="student-form" class="card student-form"><h2>${student.id ? "Editar" : "Cadastrar"} aluno demonstrativo</h2><label>Nome completo<input name="name" maxlength="100" required value="${esc(student.name ?? "")}"></label><label>Instituição<input name="institution" maxlength="100" required value="${esc(student.institution ?? "FATEC Registro")}"></label><label>Curso<input name="course" maxlength="120" value="${esc(student.course ?? "")}"></label><p>Dados demonstrativos, salvos somente neste navegador.</p><div class="controls"><button type="submit">Salvar cadastro</button><button type="button" class="secondary" data-student="cancel">Cancelar</button></div><p class="field-error" role="alert" id="student-error"></p></form>`;
}
export function studentList(list, selection = false, selected = null) {
  return list.length ? `<div class="table-wrap"><table class="result-table"><thead><tr><th>Aluno</th><th>Instituição</th><th>Ações</th></tr></thead><tbody>${list.map(v => `<tr><td>${esc(v.name)}</td><td>${esc(v.institution)}</td><td><div class="controls">${selection ? `<button class="${selected === v.id ? "" : "secondary"}" data-student="select" data-id="${esc(v.id)}">${selected === v.id ? "Selecionado" : "Selecionar"}</button>` : `<button class="secondary" data-student="edit" data-id="${esc(v.id)}">Editar</button><button class="secondary" data-student="delete" data-id="${esc(v.id)}" aria-label="Excluir ${esc(v.name)}">Excluir</button>`}</div></td></tr>`).join("")}</tbody></table></div>` : '<p class="empty-state">Nenhum aluno encontrado.</p>';
}
