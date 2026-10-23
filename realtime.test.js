"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { io: client } = require("socket.io-client");
const { randomUUID } = require("node:crypto");
const { createApplication } = require("./index");
const { SessionRepository } = require("./src/repositories/sessions");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function request(socket, event, data) {
  return new Promise((resolve, reject) =>
    socket
      .timeout(3000)
      .emit(event, data, (error, value) =>
        error ? reject(error) : resolve(value),
      ),
  );
}
async function setup(options = {}) {
  const app = createApplication(options);
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${app.server.address().port}`,
    clients = [];
  const connect = () => {
    const socket = client(url, { transports: ["websocket"], forceNew: true });
    clients.push(socket);
    return socket;
  };
  return {
    ...app,
    url,
    connect,
    cleanup: async () => {
      clients.forEach((c) => c.disconnect());
      await app.close();
    },
  };
}
test("duas telas: autorização, idempotência, incrementos, pausa, reconexão, exportação HTTP e parcial", async () => {
  const app = await setup({ eeg: false }),
    p = app.connect();
  let professional, student;
  p.on("snapshot", (s) => (professional = s));
  try {
    const owner = await request(p, "join", { create: true }),
      s = app.connect();
    s.on("snapshot", (v) => (student = v));
    assert.equal(
      (await request(s, "join", { id: owner.id, key: owner.studentKey })).role,
      "student",
    );
    const command = (type, extra = {}) =>
      request(p, "command", {
        id: owner.id,
        commandId: randomUUID(),
        expectedRevision: app.repository.sessions.get(owner.id).controlRevision,
        type,
        ...extra,
      });
    assert(
      (
        await request(s, "command", {
          id: owner.id,
          commandId: randomUUID(),
          type: "prepare",
        })
      ).error,
    );
    await command("select-participant", { participant: { id: "demo", name: "Demonstração" } });
    await command("configure", { config: {} });
    s.emit("presence", { visible: true });
    await delay(20);
    const id = randomUUID(),
      prepare = { id: owner.id, commandId: id, type: "begin", expectedRevision: app.repository.sessions.get(owner.id).controlRevision };
    assert.equal((await request(p, "command", prepare)).ok, true);
    assert.equal((await request(p, "command", prepare)).ok, true);
    assert.equal(app.repository.sessions.get(owner.id).runs.length, 1);
    assert.equal((await command("start")).ok, true);
    let seq = 0;
    const input = setInterval(
      () =>
        s.emit("input", {
          runId: professional.runId,
          seq: ++seq,
          inside: true,
          hidden: false,
          x: 0.08,
          y: 0.08,
          clientTime: performance.now(),
        }),
      50,
    );
    await delay(250);
    assert.equal(professional.full, false);
    assert(!professional.maze);
    assert(professional.active > 0);
    assert.equal(student.metrics, undefined);
    assert.equal(student.notes, undefined);
    assert.equal(student.report, undefined);
    assert.equal(
      (await command("notes", { value: "Observação privada" })).ok,
      true,
    );
    await delay(50);
    assert(!JSON.stringify(student).includes("Observação privada"));
    assert.equal((await command("pause")).ok, true);
    const active = app.repository.sessions.get(owner.id).current.active;
    await delay(100);
    assert.equal(app.repository.sessions.get(owner.id).current.active, active);
    assert.equal((await command("resume")).ok, true);
    clearInterval(input);
    s.disconnect();
    await delay(80);
    assert.equal(app.repository.sessions.get(owner.id).current.state, "PAUSED");
    const again = app.connect();
    assert.equal(
      (await request(again, "join", { id: owner.id, key: owner.studentKey }))
        .role,
      "student",
    );
    again.emit("presence", { visible: true });
    await delay(20);
    assert.equal((await command("resume")).ok, true);
    const current = app.repository.sessions.get(owner.id).current,
      beforeInputs = current.inputs.length;
    again.emit("input", {
      runId: current.id,
      seq: 1,
      inside: true,
      hidden: false,
      x: 0.07,
      y: 0.07,
      clientTime: 1,
    });
    await delay(60);
    assert.equal(current.inputs.length, beforeInputs + 1);
    assert.equal((await command("abort")).ok, true);
    assert.equal((await command("next")).ok, true);
    assert.equal((await command("end-session")).ok, true);
    const route = `${app.url}/api/sessions/${owner.id}/export`;
    const inspectRoute = `${app.url}/api/sessions/${owner.id}/inspect?time=100`;
    assert.equal((await fetch(inspectRoute)).status, 403);
    const inspected = await (
      await fetch(inspectRoute, {
        headers: { Authorization: `Bearer ${owner.key}` },
      })
    ).json();
    assert.equal(inspected.schemaVersion, 2);
    assert.equal(inspected.runs[0].steps, undefined);
    assert.equal((await fetch(route)).status, 403);
    assert.equal(
      (
        await fetch(route, {
          headers: { Authorization: `Bearer ${owner.studentKey}` },
        })
      ).status,
      403,
    );
    const response = await fetch(route, {
      headers: {
        Authorization: `Bearer ${owner.key}`,
        "X-Attobrain-Export": "true",
      },
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.schemaVersion, 3);
    assert.equal(data.report.evaluations[1].state, "NOT_PERFORMED");
    assert.equal(data.notes, "Observação privada");
    assert(!JSON.stringify(data).includes(owner.key));
    assert(!JSON.stringify(data).includes(owner.studentKey));
    assert.equal(
      app.repository.sessions.get(owner.id).exportedRevision,
      app.repository.sessions.get(owner.id).revision,
    );
    p.emit(
      "command",
      { id: owner.id, type: "notes", commandId: "bad", value: 2 },
      "callback inválido",
    );
    p.emit("join", null, "callback inválido");
    await delay(20);
    assert((await request(p, "ping-clock", { clientTime: 1 })).serverTime >= 0);
  } finally {
    await app.cleanup();
  }
});
test("HTTP estático protegido, módulos ES, origem e limite de sessões", async () => {
  const app = await setup({ eeg: false });
  try {
    for (const route of [
      "/profissional",
      "/aluno",
      "/legado",
      "/live.js",
      "/public/modules/layout.js",
    ])
      assert.equal((await fetch(app.url + route)).status, 200);
    assert.equal((await fetch(app.url + "/package.json")).status, 404);
    assert.equal(
      (await fetch(app.url + "/assets/%2e%2e%5cpackage.json")).status,
      403,
    );
    assert.equal(
      (await fetch(app.url + "/profissional", { method: "POST" })).status,
      405,
    );
    assert(
      (await fetch(app.url + "/profissional")).headers.get(
        "content-security-policy",
      ),
    );
    const outsider = client(app.url, {
      transports: ["websocket"],
      extraHeaders: { Origin: "http://other.example" },
      reconnection: false,
    });
    await new Promise((resolve) => outsider.on("connect_error", resolve));
    outsider.disconnect();
    for (let i = 0; i < 4; i++)
      assert((await request(app.connect(), "join", { create: true })).id);
    assert(
      (await request(app.connect(), "join", { create: true })).error.includes(
        "quatro",
      ),
    );
  } finally {
    await app.cleanup();
  }
});
test("retenção em memória libera sessões sem conexão após 30 minutos", () => {
  const repository = new SessionRepository();
  const s = repository.create(0);
  repository.sweep(1799999);
  assert.equal(repository.sessions.size, 1);
  repository.sweep(1800000);
  assert.equal(repository.sessions.size, 0);
  assert(s.id);
});

test("fluxo guiado Socket.IO: criação idempotente, prévia pura, revisão, presença e recuperação", async () => {
  const app = await setup({ eeg: false }), p = app.connect();
  try {
    await fetch(`${app.url}/`);
    assert.equal(app.repository.sessions.size, 0);
    const token = randomUUID(), owner = await request(p, "join", { create: true, creationToken: token });
    assert.equal((await request(p, "join", { create: true, creationToken: token })).id, owner.id);
    assert.equal(app.repository.sessions.size, 1);
    const session = app.repository.sessions.get(owner.id);
    const command = (type, extra = {}) => request(p, "command", { id: owner.id, commandId: randomUUID(), expectedRevision: session.controlRevision, type, ...extra });
    assert((await command("prepare", { config: {} })).error);
    assert((await command("configure", { config: {} })).error);
    assert((await command("select-participant", { participant: { id: "test", name: "Teste" } })).ok);
    const revision = session.revision;
    assert.equal((await request(p, "preview", { config: {} })).preview.length, 4);
    assert.equal(session.revision, revision); assert.equal(session.runs.length, 0);
    assert((await command("configure", { config: {} })).ok);
    assert((await command("begin")).error);
    const student = app.connect();
    let studentView;
    student.on("snapshot", value => { studentView = value; });
    await request(student, "join", { id: owner.id, key: owner.studentKey });
    assert((await command("begin")).error);
    student.emit("presence", { visible: true }); await delay(20);
    assert((await command("begin")).ok);
    assert.equal(session.runs.length, 1);
    const old = session.controlRevision;
    assert((await command("start")).ok);
    assert((await command("pause", { expectedRevision: old })).error);
    student.emit("presence", { visible: false }); await delay(20);
    assert.equal(session.current.state, "PAUSED");
    p.disconnect(); await delay(30);
    const recovered = app.connect();
    assert.equal((await request(recovered, "join", { id: owner.id, key: owner.key })).id, owner.id);
    assert.equal(session.runs.length, 1);
    await request(recovered, "command", { id: owner.id, commandId: randomUUID(), expectedRevision: session.controlRevision, type: "end-session", reason: "technical" });
    await delay(30);
    assert.equal(studentView.closed, true);
    for (const name of ["participant", "workflow", "report", "metrics", "presence"]) assert.equal(studentView[name], undefined);
    assert.equal(session.report().analysis.quality.completed, 0);
  } finally { await app.cleanup(); }
});
test("worker multicanal contínuo durante pausa; espectro e índices íntegros", async () => {
  const app = await setup(),
    p = app.connect();
  let eegBlocks = 0,
    spectral = false,
    lastIndex = null;
  let spectralTimeout;
  const spectralReady = new Promise((resolve, reject) => {
    spectralTimeout = setTimeout(() => reject(Error("Espectro válido não recebido em 12 s.")), 12000);
    p.on("spectrum", value => { if (value.channels[0].valid) { clearTimeout(spectralTimeout); resolve(); } });
  });
  p.on("eeg", (b) => {
    lastIndex ??= b.startIndex;
    assert.equal(b.startIndex, lastIndex);
    lastIndex += b.count;
    assert.equal(b.channels.length, 8);
    assert.equal(b.channels[0].length, b.count);
    eegBlocks++;
  });
  p.on("spectrum", (s) => {
    if (s.channels[0].valid) spectral = true;
  });
  try {
    const owner = await request(p, "join", { create: true });
    const s = app.connect();
    await request(s, "join", { id: owner.id, key: owner.studentKey });
    const command = (type, extra = {}) => request(p, "command", { id: owner.id, commandId: randomUUID(), expectedRevision: app.repository.sessions.get(owner.id).controlRevision, type, ...extra });
    assert((await command("select-participant", { participant: { id: "demo", name: "Demonstração" } })).ok);
    assert((await command("configure", { config: {} })).ok);
    const session = app.repository.sessions.get(owner.id);
    assert.equal(session.worker, undefined);
    assert.equal(session.eeg.samples, 0);
    s.emit("presence", { visible: true });
    await delay(20);
    assert((await command("begin")).ok);
    await request(p, "command", {
      id: owner.id,
      commandId: randomUUID(),
      expectedRevision: session.controlRevision,
      type: "start",
    });
    await delay(150);
    await request(p, "command", {
      id: owner.id,
      commandId: randomUUID(),
      expectedRevision: session.controlRevision,
      type: "pause",
    });
    const before = lastIndex;
    await spectralReady;
    assert(lastIndex > before + 1900);
    assert(eegBlocks > 60);
    assert(spectral);
    assert.equal(session.eeg.gaps.filter(g => g.reason !== "preparation-not-collected").length, 0);
    assert.equal(session.eeg.blocks[0].startIndex, session.eeg.startIndex);
    assert.equal(session.current.state, "PAUSED");
    await request(p, "command", {
      id: owner.id,
      commandId: randomUUID(),
      expectedRevision: session.controlRevision,
      type: "end-session",
    });
    const response = await fetch(`${app.url}/api/sessions/${owner.id}/export`, {
      headers: { Authorization: `Bearer ${owner.key}` },
    });
    const data = await response.json();
    assert.equal(
      data.eeg.samples,
      data.eeg.startIndex + data.eeg.blocks.reduce((v, b) => v + b.count, 0),
    );
    assert(data.eeg.samples >= before + 1900);
    assert.equal(data.runs[0].state, "ABORTED");
  } finally {
    clearTimeout(spectralTimeout);
    await app.cleanup();
  }
});
