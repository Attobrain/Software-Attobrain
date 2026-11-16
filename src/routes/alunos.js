"use strict";
const express = require("express");
const { exigirLogin } = require("../middlewares/auth");

const CAMPOS = [
  ["nome", 100],
  ["escola", 100],
  ["turma", 50],
  ["responsavel", 100],
  ["observacoes", 500],
];

// Aceita só datas reais (AAAA-MM-DD) que não estejam no futuro.
function dataValida(texto) {
  const data = new Date(`${texto}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(texto) && !isNaN(data) && data.toISOString().slice(0, 10) === texto && data <= new Date();
}

function lerAluno(corpo) {
  const aluno = {};
  for (const [campo, max] of CAMPOS) {
    const bruto = corpo?.[campo] ?? "";
    if (typeof bruto !== "string") throw Error(`O campo ${campo} é inválido.`);
    const valor = bruto.trim();
    if (valor.length > max) throw Error(`O campo ${campo} passou do limite de ${max} caracteres.`);
    aluno[campo] = valor || null;
  }
  if (!aluno.nome) throw Error("Informe o nome do aluno.");
  const nascimento = String(corpo?.dataNascimento ?? "").trim();
  if (nascimento && !dataValida(nascimento)) throw Error("Data de nascimento inválida.");
  aluno.dataNascimento = nascimento || null;
  return aluno;
}

function rotasAlunos(db) {
  const router = express.Router();
  router.use(exigirLogin);

  const SELECT = "SELECT id, nome, DATE_FORMAT(data_nascimento, '%Y-%m-%d') AS dataNascimento, escola, turma, responsavel, observacoes FROM alunos";

  router.get("/", async (req, res) => {
    const [linhas] = await db.query(`${SELECT} WHERE profissional_id = ? ORDER BY nome`, [req.session.profissionalId]);
    res.json(linhas);
  });

  router.get("/:id", async (req, res) => {
    const [linhas] = await db.query(`${SELECT} WHERE id = ? AND profissional_id = ?`, [req.params.id, req.session.profissionalId]);
    if (!linhas[0]) return res.status(404).json({ erro: "Aluno não encontrado." });
    res.json(linhas[0]);
  });

  router.post("/", async (req, res) => {
    let a;
    try { a = lerAluno(req.body); } catch (erro) { return res.status(400).json({ erro: erro.message }); }
    const [resultado] = await db.query(
      "INSERT INTO alunos (profissional_id, nome, data_nascimento, escola, turma, responsavel, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [req.session.profissionalId, a.nome, a.dataNascimento, a.escola, a.turma, a.responsavel, a.observacoes],
    );
    res.status(201).json({ id: resultado.insertId, ...a });
  });

  router.put("/:id", async (req, res) => {
    let a;
    try { a = lerAluno(req.body); } catch (erro) { return res.status(400).json({ erro: erro.message }); }
    const [resultado] = await db.query(
      "UPDATE alunos SET nome = ?, data_nascimento = ?, escola = ?, turma = ?, responsavel = ?, observacoes = ? WHERE id = ? AND profissional_id = ?",
      [a.nome, a.dataNascimento, a.escola, a.turma, a.responsavel, a.observacoes, req.params.id, req.session.profissionalId],
    );
    if (!resultado.affectedRows) return res.status(404).json({ erro: "Aluno não encontrado." });
    res.json({ id: Number(req.params.id), ...a });
  });

  router.delete("/:id", async (req, res) => {
    const [resultado] = await db.query("DELETE FROM alunos WHERE id = ? AND profissional_id = ?", [req.params.id, req.session.profissionalId]);
    if (!resultado.affectedRows) return res.status(404).json({ erro: "Aluno não encontrado." });
    res.json({ ok: true });
  });

  router.get("/:id/sessoes", async (req, res) => {
    const [linhas] = await db.query(
      `SELECT s.id, s.realizada_em AS realizadaEm, s.nivel, s.fases_concluidas AS fasesConcluidas,
              s.tempo_ativo_seg AS tempoAtivoSeg, s.total_colisoes AS totalColisoes, s.motivo_fim AS motivoFim
         FROM sessoes s JOIN alunos a ON a.id = s.aluno_id
        WHERE s.aluno_id = ? AND a.profissional_id = ? ORDER BY s.realizada_em DESC`,
      [req.params.id, req.session.profissionalId],
    );
    res.json(linhas);
  });

  return router;
}
module.exports = { rotasAlunos };
