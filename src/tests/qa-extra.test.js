"use strict";
// Testes extras de QA: ownership, validação, 404, login, falha de banco e resumo da sessão.
// Banco falso em memória, com 2 profissionais. Dados 100% sintéticos.
const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { io: cliente } = require("socket.io-client");
const { createApplication } = require("../../index");
const { resumoSessao } = require("../services/resumo-sessao");

function bancoFalso({ falharEm = null } = {}) {
  const profissionais = [
    { id: 1, nome: "Prof A", email: "a@teste.com", senha_hash: bcrypt.hashSync("senhaA123", 4) },
    { id: 2, nome: "Prof B", email: "b@teste.com", senha_hash: bcrypt.hashSync("senhaB123", 4) },
  ];
  let alunos = [];
  const sessoes = [];
  let proximoId = 1;
  const visivel = (a) => ({ id: a.id, nome: a.nome, dataNascimento: a.dataNascimento, escola: a.escola, turma: a.turma, responsavel: a.responsavel, observacoes: a.observacoes });
  const mesmo = (a, id) => String(a.id) === String(id);
  return {
    sessoes,
    alunos: () => alunos,
    async query(sql, p = []) {
      if (falharEm && sql.includes(falharEm)) throw Error("banco indisponivel");
      if (sql.includes("FROM profissionais")) return [profissionais.filter((x) => x.email === p[0])];
      if (sql.startsWith("INSERT INTO alunos")) {
        const [profissional_id, nome, dataNascimento, escola, turma, responsavel, observacoes] = p;
        const aluno = { id: proximoId++, profissional_id, nome, dataNascimento, escola, turma, responsavel, observacoes };
        alunos.push(aluno);
        return [{ insertId: aluno.id, affectedRows: 1 }];
      }
      if (sql.includes("INSERT INTO sessoes")) {
        // INSERT ... SELECT ... FROM alunos WHERE id = ? AND profissional_id = ?: só grava se o aluno for do profissional.
        const dono = alunos.find((a) => mesmo(a, p[6]) && a.profissional_id === p[7]);
        if (dono) sessoes.push({ aluno_id: dono.id, profissional_id: dono.profissional_id, params: p });
        return [{ affectedRows: dono ? 1 : 0 }];
      }
      if (sql.startsWith("UPDATE alunos")) {
        const [nome, dataNascimento, escola, turma, responsavel, observacoes, id, profissional_id] = p;
        const aluno = alunos.find((a) => mesmo(a, id) && a.profissional_id === profissional_id);
        if (aluno) Object.assign(aluno, { nome, dataNascimento, escola, turma, responsavel, observacoes });
        return [{ affectedRows: aluno ? 1 : 0 }];
      }
      if (sql.startsWith("DELETE FROM alunos")) {
        const antes = alunos.length;
        alunos = alunos.filter((a) => !(mesmo(a, p[0]) && a.profissional_id === p[1]));
        return [{ affectedRows: antes - alunos.length }];
      }
      if (sql.includes("FROM sessoes")) {
        const [alunoId, profId] = p;
        const dono = alunos.find((a) => mesmo(a, alunoId) && a.profissional_id === profId);
        return [dono ? sessoes.filter((s) => s.aluno_id === dono.id).map((s) => ({ id: 1 })) : []];
      }
      if (sql.includes("WHERE profissional_id = ?")) return [alunos.filter((a) => a.profissional_id === p[0]).map(visivel)];
      if (sql.includes("WHERE id = ? AND profissional_id = ?")) return [alunos.filter((a) => mesmo(a, p[0]) && a.profissional_id === p[1]).map(visivel)];
      throw Error(`Consulta não prevista no teste: ${sql}`);
    },
  };
}

async function iniciar(db = bancoFalso()) {
  const app = createApplication({ db, eeg: false });
  await new Promise((resolve) => app.server.listen(0, resolve));
  return { app, db, base: `http://127.0.0.1:${app.server.address().port}` };
}
const req = (metodo, corpo, cookie) => ({
  method: metodo,
  headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
  ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
});
async function entrar(base, email, senha) {
  const r = await fetch(`${base}/api/login`, req("POST", { email, senha }));
  assert.equal(r.status, 200);
  return r.headers.get("set-cookie").split(";")[0];
}
const entrarA = (base) => entrar(base, "a@teste.com", "senhaA123");
const entrarB = (base) => entrar(base, "b@teste.com", "senhaB123");
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const comApp = (nome, fn, db) => test(nome, async () => {
  const ctx = await iniciar(db ?? bancoFalso());
  try { await fn(ctx); } finally { await ctx.app.close(); }
});

// ---------- Ownership ----------
comApp("ownership: profissional B não lê, edita, apaga nem lista o aluno do A", async ({ base }) => {
  const a = await entrarA(base);
  const b = await entrarB(base);
  const { id } = await (await fetch(`${base}/api/alunos`, req("POST", { nome: "Aluno do A" }, a))).json();

  assert.equal((await fetch(`${base}/api/alunos/${id}`, { headers: { cookie: b } })).status, 404);
  assert.equal((await fetch(`${base}/api/alunos/${id}`, req("PUT", { nome: "Invadido" }, b))).status, 404);
  assert.equal((await fetch(`${base}/api/alunos/${id}`, req("DELETE", undefined, b))).status, 404);
  assert.deepEqual(await (await fetch(`${base}/api/alunos`, { headers: { cookie: b } })).json(), []);
  assert.deepEqual(await (await fetch(`${base}/api/alunos/${id}/sessoes`, { headers: { cookie: b } })).json(), []);

  const intacto = await (await fetch(`${base}/api/alunos/${id}`, { headers: { cookie: a } })).json();
  assert.equal(intacto.nome, "Aluno do A", "aluno do A não pode ter sido alterado nem apagado");
});

// ---------- Validação ----------
comApp("validação: nome vazio, só espaços, 101 caracteres e campos longos viram 400; 100 caracteres passa", async ({ base }) => {
  const a = await entrarA(base);
  const post = (corpo) => fetch(`${base}/api/alunos`, req("POST", corpo, a));
  assert.equal((await post({ nome: "   " })).status, 400);
  assert.equal((await post({})).status, 400);
  assert.equal((await post({ nome: "x".repeat(101) })).status, 400);
  assert.equal((await post({ nome: "x".repeat(100) })).status, 201);
  assert.equal((await post({ nome: "Ana", turma: "t".repeat(51) })).status, 400);
  assert.equal((await post({ nome: "Ana", observacoes: "o".repeat(501) })).status, 400);
});

comApp("validação: formato de data inválido vira 400", async ({ base }) => {
  const a = await entrarA(base);
  for (const d of ["31/12/2015", "2015-1-1", "abc", "2015-12-31T00:00:00Z"]) {
    const r = await fetch(`${base}/api/alunos`, req("POST", { nome: "Ana", dataNascimento: d }, a));
    assert.equal(r.status, 400, `data ${d} deveria ser recusada`);
  }
  assert.equal((await fetch(`${base}/api/alunos`, req("POST", { nome: "Ana", dataNascimento: "2015-12-31" }, a))).status, 201);
});

comApp("validação: data impossível (2015-13-45 / 2015-02-31) deveria ser 400", async ({ base }) => {
  const a = await entrarA(base);
  for (const d of ["2015-13-45", "2015-02-31", "0000-00-00"]) {
    const r = await fetch(`${base}/api/alunos`, req("POST", { nome: "Ana", dataNascimento: d }, a));
    assert.equal(r.status, 400, `data impossível ${d} não pode ser aceita (MySQL estrito daria 500)`);
  }
});

comApp("validação: data de nascimento no futuro deveria ser recusada", async ({ base }) => {
  const a = await entrarA(base);
  const r = await fetch(`${base}/api/alunos`, req("POST", { nome: "Ana", dataNascimento: "2999-01-01" }, a));
  assert.equal(r.status, 400);
});

comApp("validação: nome enviado como objeto/array não vira o texto '[object Object]'", async ({ base }) => {
  const a = await entrarA(base);
  const r = await fetch(`${base}/api/alunos`, req("POST", { nome: { x: 1 } }, a));
  assert.equal(r.status, 400);
});

comApp("validação: JSON malformado em /api devolve 400 (não 500)", async ({ base }) => {
  const a = await entrarA(base);
  const r = await fetch(`${base}/api/alunos`, { method: "POST", headers: { "Content-Type": "application/json", cookie: a }, body: "{quebrado" });
  assert.equal(r.status, 400);
});

// ---------- PUT/DELETE inexistente ----------
comApp("PUT e DELETE de id inexistente ou não numérico devolvem 404", async ({ base }) => {
  const a = await entrarA(base);
  for (const id of ["9999", "abc", "-1"]) {
    assert.equal((await fetch(`${base}/api/alunos/${id}`, req("PUT", { nome: "X" }, a))).status, 404, `PUT ${id}`);
    assert.equal((await fetch(`${base}/api/alunos/${id}`, req("DELETE", undefined, a))).status, 404, `DELETE ${id}`);
    assert.equal((await fetch(`${base}/api/alunos/${id}`, { headers: { cookie: a } })).status, 404, `GET ${id}`);
  }
});

comApp("PUT com corpo inválido num id inexistente responde 400 (validação antes do banco)", async ({ base }) => {
  const a = await entrarA(base);
  assert.equal((await fetch(`${base}/api/alunos/9999`, req("PUT", { nome: "" }, a))).status, 400);
});

// ---------- Login ----------
comApp("login: e-mail vazio, senha vazia e corpo ausente devolvem 400", async ({ base }) => {
  const post = (corpo) => fetch(`${base}/api/login`, req("POST", corpo));
  assert.equal((await post({ email: "", senha: "senhaA123" })).status, 400);
  assert.equal((await post({ email: "a@teste.com", senha: "" })).status, 400);
  assert.equal((await post({ email: "   ", senha: "x" })).status, 400);
  assert.equal((await post({})).status, 400);
  assert.equal((await fetch(`${base}/api/login`, { method: "POST" })).status, 400);
});

comApp("login: e-mail desconhecido = 401 com a mesma mensagem da senha errada; e-mail ignora maiúsculas e espaços", async ({ base }) => {
  const desconhecido = await fetch(`${base}/api/login`, req("POST", { email: "x@teste.com", senha: "qualquer" }));
  const errada = await fetch(`${base}/api/login`, req("POST", { email: "a@teste.com", senha: "errada" }));
  assert.equal(desconhecido.status, 401);
  assert.equal(errada.status, 401);
  assert.deepEqual(await desconhecido.json(), await errada.json(), "não pode revelar se o e-mail existe");
  const ok = await fetch(`${base}/api/login`, req("POST", { email: "  A@Teste.COM ", senha: "senhaA123" }));
  assert.equal(ok.status, 200);
});

comApp("logout encerra a sessão: depois dele /api/alunos volta a 401", async ({ base }) => {
  const a = await entrarA(base);
  assert.equal((await fetch(`${base}/api/alunos`, { headers: { cookie: a } })).status, 200);
  assert.equal((await fetch(`${base}/api/logout`, req("POST", undefined, a))).status, 200);
  assert.equal((await fetch(`${base}/api/alunos`, { headers: { cookie: a } })).status, 401);
  assert.equal((await fetch(`${base}/api/me`, { headers: { cookie: a } })).status, 401);
});

comApp("login não devolve o hash da senha", async ({ base }) => {
  const r = await fetch(`${base}/api/login`, req("POST", { email: "a@teste.com", senha: "senhaA123" }));
  const texto = await r.text();
  assert.ok(!texto.includes("senha_hash") && !texto.includes("$2"), texto);
});

// ---------- Falha do banco ----------
test("falha do banco no INSERT de aluno devolve 500 genérico, sem vazar detalhe, e o servidor segue de pé", async () => {
  const db = bancoFalso({ falharEm: "INSERT INTO alunos" });
  const { app, base } = await iniciar(db);
  try {
    const a = await entrarA(base);
    const r = await fetch(`${base}/api/alunos`, req("POST", { nome: "Ana" }, a));
    assert.equal(r.status, 500);
    const texto = await r.text();
    assert.ok(!texto.includes("banco indisponivel"), "não pode vazar a mensagem interna");
    assert.equal((await fetch(`${base}/api/alunos`, { headers: { cookie: a } })).status, 200);
  } finally { await app.close(); }
});

test("falha do banco no login devolve 500 e não cria sessão", async () => {
  const db = bancoFalso({ falharEm: "FROM profissionais" });
  const { app, base } = await iniciar(db);
  try {
    const r = await fetch(`${base}/api/login`, req("POST", { email: "a@teste.com", senha: "senhaA123" }));
    assert.equal(r.status, 500);
    assert.equal(r.headers.get("set-cookie"), null);
  } finally { await app.close(); }
});

// ---------- Sessão do labirinto ----------
async function abrirSessao(base, cookie) {
  const socket = cliente(base, { transports: ["websocket"], extraHeaders: { cookie } });
  let revisao = 0;
  socket.on("snapshot", (s) => { if (s.workflow) revisao = s.workflow.controlRevision; });
  const emitir = (evento, dados) => new Promise((resolve) => socket.emit(evento, dados, resolve));
  await new Promise((resolve) => socket.on("connect", resolve));
  const entrada = await emitir("join", { create: true });
  await esperar(100);
  const enviar = (type, extra) => emitir("command", { id: entrada.id, commandId: `${type}-${Math.random()}`, type, expectedRevision: revisao, ...extra });
  return { socket, enviar };
}

test("sessão do labirinto sem aluno selecionado: não grava em sessoes", async () => {
  const db = bancoFalso();
  const { app, base } = await iniciar(db);
  try {
    const { socket, enviar } = await abrirSessao(base, await entrarA(base));
    await enviar("end-session", { reason: "voluntary" });
    await esperar(150);
    socket.close();
    assert.equal(db.sessoes.length, 0);
  } finally { await app.close(); }
});

test("sessão com aluno de id não numérico (demonstração) não grava em sessoes", async () => {
  const db = bancoFalso();
  const { app, base } = await iniciar(db);
  try {
    const { socket, enviar } = await abrirSessao(base, await entrarA(base));
    assert.equal((await enviar("select-participant", { participant: { id: "demo", name: "Demonstração" } })).error, undefined);
    await esperar(100);
    await enviar("end-session", { reason: "voluntary" });
    await esperar(150);
    socket.close();
    assert.equal(db.sessoes.length, 0);
  } finally { await app.close(); }
});

test("ownership na gravação: aluno de outro profissional não recebe sessão, mesmo selecionado por id", async () => {
  const db = bancoFalso();
  const { app, base } = await iniciar(db);
  try {
    const b = await entrarB(base);
    const { id: alunoDeB } = await (await fetch(`${base}/api/alunos`, req("POST", { nome: "Aluno do B" }, b))).json();
    const { socket, enviar } = await abrirSessao(base, await entrarA(base));
    await enviar("select-participant", { participant: { id: String(alunoDeB), name: "Aluno do B" } });
    await esperar(100);
    await enviar("end-session", { reason: "voluntary" });
    await esperar(150);
    socket.close();
    assert.equal(db.sessoes.length, 0, "profissional A não pode gravar sessão em aluno de B");
  } finally { await app.close(); }
});

test("gravação feliz: aluno do próprio profissional recebe exatamente 1 sessão (sem duplicar)", async () => {
  const db = bancoFalso();
  const { app, base } = await iniciar(db);
  try {
    const a = await entrarA(base);
    const { id } = await (await fetch(`${base}/api/alunos`, req("POST", { nome: "Aluno do A" }, a))).json();
    const { socket, enviar } = await abrirSessao(base, a);
    await enviar("select-participant", { participant: { id: String(id), name: "Aluno do A" } });
    await esperar(100);
    await enviar("end-session", { reason: "voluntary" });
    await enviar("end-session", { reason: "voluntary" }); // segundo encerramento não pode duplicar
    await esperar(150);
    socket.close();
    assert.equal(db.sessoes.length, 1);
    const historico = await (await fetch(`${base}/api/alunos/${id}/sessoes`, { headers: { cookie: a } })).json();
    assert.equal(historico.length, 1);
  } finally { await app.close(); }
});

test("falha do banco no INSERT da sessão não derruba o encerramento nem o servidor", async () => {
  const db = bancoFalso({ falharEm: "INSERT INTO sessoes" });
  const { app, base } = await iniciar(db);
  try {
    const a = await entrarA(base);
    const { id } = await (await fetch(`${base}/api/alunos`, req("POST", { nome: "Aluno do A" }, a))).json();
    const { socket, enviar } = await abrirSessao(base, a);
    await enviar("select-participant", { participant: { id: String(id), name: "Aluno do A" } });
    await esperar(100);
    assert.equal((await enviar("end-session", { reason: "voluntary" })).error, undefined);
    await esperar(150);
    socket.close();
    assert.equal((await fetch(`${base}/health`)).status, 200);
  } finally { await app.close(); }
});

// ---------- resumoSessao ----------
test("resumo: sessão só com treino ou sem corridas zera tudo", () => {
  const soTreino = resumoSessao({ runs: [{ label: "Treinamento", state: "COMPLETED", result: { activeMs: 5000, collisionEpisodeCount: 4 } }] });
  assert.equal(soTreino.fasesConcluidas, 0);
  assert.equal(soTreino.tempoAtivoSeg, 0);
  assert.equal(soTreino.totalColisoes, 0);
  assert.equal(resumoSessao({ runs: [] }).motivoFim, null);
});

test("resumo: corrida sem result, estados não concluídos e arredondamento", () => {
  const r = resumoSessao({
    config: { level: 0 },
    runs: [
      { label: "A", state: "TIMED_OUT" },
      { label: "B", state: "ABORTED", result: { activeMs: 1499, collisionEpisodeCount: 0 } },
      { label: "C", state: "COMPLETED", result: { activeMs: 1501 } },
    ],
  });
  assert.equal(r.fasesConcluidas, 1);
  assert.equal(r.tempoAtivoSeg, 3, "(1499+1501)/1000 = 3");
  assert.equal(r.totalColisoes, 0);
  assert.equal(r.nivel, null, "nível 0 vira null (falsy) — conferir se 0 é nível válido");
});

test("resumo: observações são cortadas em 4000 caracteres", () => {
  const r = resumoSessao({ runs: [], notes: "n".repeat(5000) });
  assert.equal(r.observacoes.length, 4000);
});

test("resumo: sessão sem a lista runs não deve lançar exceção", () => {
  assert.doesNotThrow(() => resumoSessao({}));
});
