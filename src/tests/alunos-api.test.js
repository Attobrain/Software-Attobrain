"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { io: cliente } = require("socket.io-client");
const { createApplication } = require("../../index");

// Banco falso em memória: responde só às consultas usadas pelas rotas.
function bancoFalso() {
  const profissionais = [{ id: 1, nome: "Prof Teste", email: "prof@teste.com", senha_hash: bcrypt.hashSync("senha123", 4) }];
  let alunos = [];
  let proximoId = 1;
  const visivel = (a) => ({ id: a.id, nome: a.nome, dataNascimento: a.dataNascimento, escola: a.escola, turma: a.turma, responsavel: a.responsavel, observacoes: a.observacoes });
  return {
    async query(sql, p = []) {
      if (sql.includes("FROM profissionais")) return [profissionais.filter((x) => x.email === p[0])];
      if (sql.startsWith("INSERT INTO alunos")) {
        const [profissional_id, nome, dataNascimento, escola, turma, responsavel, observacoes] = p;
        const aluno = { id: proximoId++, profissional_id, nome, dataNascimento, escola, turma, responsavel, observacoes };
        alunos.push(aluno);
        return [{ insertId: aluno.id, affectedRows: 1 }];
      }
      if (sql.startsWith("UPDATE alunos")) {
        const [nome, dataNascimento, escola, turma, responsavel, observacoes, id, profissional_id] = p;
        const aluno = alunos.find((a) => String(a.id) === String(id) && a.profissional_id === profissional_id);
        if (aluno) Object.assign(aluno, { nome, dataNascimento, escola, turma, responsavel, observacoes });
        return [{ affectedRows: aluno ? 1 : 0 }];
      }
      if (sql.startsWith("DELETE FROM alunos")) {
        const antes = alunos.length;
        alunos = alunos.filter((a) => !(String(a.id) === String(p[0]) && a.profissional_id === p[1]));
        return [{ affectedRows: antes - alunos.length }];
      }
      if (sql.includes("WHERE profissional_id = ?")) return [alunos.filter((a) => a.profissional_id === p[0]).map(visivel)];
      if (sql.includes("WHERE id = ? AND profissional_id = ?")) return [alunos.filter((a) => String(a.id) === String(p[0]) && a.profissional_id === p[1]).map(visivel)];
      if (sql.includes("FROM sessoes")) return [[]];
      throw Error(`Consulta não prevista no teste: ${sql}`);
    },
  };
}

async function iniciar(db = bancoFalso()) {
  const app = createApplication({ db, eeg: false });
  await new Promise((resolve) => app.server.listen(0, resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  return { app, base };
}
const json = (corpo, cookie) => ({
  method: "POST",
  headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(corpo),
});

test("API de alunos exige login e faz o CRUD do profissional logado", async () => {
  const { app, base } = await iniciar();
  try {
    assert.equal((await fetch(`${base}/api/alunos`)).status, 401);
    assert.equal((await fetch(`${base}/api/login`, json({ email: "prof@teste.com", senha: "errada" }))).status, 401);

    const login = await fetch(`${base}/api/login`, json({ email: "prof@teste.com", senha: "senha123" }));
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];

    const criado = await fetch(`${base}/api/alunos`, json({ nome: "Ana Souza", escola: "Escola X" }, cookie));
    assert.equal(criado.status, 201);
    const { id } = await criado.json();

    assert.equal((await fetch(`${base}/api/alunos`, json({ nome: "" }, cookie))).status, 400);

    const lista = await (await fetch(`${base}/api/alunos`, { headers: { cookie } })).json();
    assert.deepEqual(lista.map((a) => a.nome), ["Ana Souza"]);

    const editado = await fetch(`${base}/api/alunos/${id}`, { ...json({ nome: "Ana Souza Lima" }, cookie), method: "PUT" });
    assert.equal(editado.status, 200);
    const um = await (await fetch(`${base}/api/alunos/${id}`, { headers: { cookie } })).json();
    assert.equal(um.nome, "Ana Souza Lima");

    const excluido = await fetch(`${base}/api/alunos/${id}`, { method: "DELETE", headers: { cookie } });
    assert.equal(excluido.status, 200);
    assert.equal((await fetch(`${base}/api/alunos/${id}`, { headers: { cookie } })).status, 404);
  } finally {
    await app.close();
  }
});

test("/profissional redireciona para o login e /aluno continua aberto", async () => {
  const { app, base } = await iniciar();
  try {
    const pagina = await fetch(`${base}/profissional`, { redirect: "manual" });
    assert.equal(pagina.status, 302);
    assert.equal(pagina.headers.get("location"), "/login");
    assert.equal((await fetch(`${base}/login`)).status, 200);
    assert.equal((await fetch(`${base}/aluno`)).status, 200);
  } finally {
    await app.close();
  }
});

test("só profissional logado consegue criar sessão do labirinto", async () => {
  const { app, base } = await iniciar();
  const abrir = (cookie) => new Promise((resolve) => {
    const socket = cliente(base, { transports: ["websocket"], extraHeaders: cookie ? { cookie } : {} });
    socket.on("connect", () => socket.emit("join", { create: true }, (resposta) => { socket.close(); resolve(resposta); }));
  });
  try {
    assert.ok((await abrir()).error, "sem login deve recusar");
    const login = await fetch(`${base}/api/login`, json({ email: "prof@teste.com", senha: "senha123" }));
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const resposta = await abrir(cookie);
    assert.equal(resposta.role, "professional");
  } finally {
    await app.close();
  }
});

test("ao encerrar a sessão, o resumo do aluno é gravado em sessoes", async () => {
  const db = bancoFalso();
  const gravacoes = [];
  const consultaOriginal = db.query.bind(db);
  db.query = async (sql, p) => {
    if (sql.includes("INSERT INTO sessoes")) { gravacoes.push(p); return [{ affectedRows: 1 }]; }
    return consultaOriginal(sql, p);
  };
  const { app, base } = await iniciar(db);
  try {
    const login = await fetch(`${base}/api/login`, json({ email: "prof@teste.com", senha: "senha123" }));
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const socket = cliente(base, { transports: ["websocket"], extraHeaders: { cookie } });
    let revisao = 0;
    socket.on("snapshot", (s) => { if (s.workflow) revisao = s.workflow.controlRevision; });
    const emitir = (evento, dados) => new Promise((resolve) => socket.emit(evento, dados, resolve));
    await new Promise((resolve) => socket.on("connect", resolve));
    const entrada = await emitir("join", { create: true });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const enviar = (type, extra) => emitir("command", { id: entrada.id, commandId: `${type}-${Math.random()}`, type, expectedRevision: revisao, ...extra });
    assert.equal((await enviar("select-participant", { participant: { id: "7", name: "Ana" } })).error, undefined);
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal((await enviar("end-session", { reason: "voluntary" })).error, undefined);
    await new Promise((resolve) => setTimeout(resolve, 100));
    socket.close();
    assert.equal(gravacoes.length, 1);
    const p = gravacoes[0];
    assert.equal(p[p.length - 2], 7, "aluno_id");
    assert.equal(p[p.length - 1], 1, "profissional_id");
    assert.equal(p[4], "voluntary", "motivo_fim");
  } finally {
    await app.close();
  }
});
