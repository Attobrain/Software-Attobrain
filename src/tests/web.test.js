"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { io } = require("socket.io-client");
const { createApplication } = require("../../index");
const origin = "https://attobrain.example";
const request = (socket, event, data) => new Promise((resolve, reject) => socket.timeout(3000).emit(event, data, (error, reply) => error ? reject(error) : resolve(reply)));

test("web: duas telas de origem autorizada compartilham sessão e exportação autenticada", async () => {
  const app = createApplication({ eeg: false, allowedOrigins: origin });
  await new Promise(resolve => app.server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${app.server.address().port}`;
  const clients = [];
  function connect(from) {
    const socket = io(url, { transports: ["websocket"], extraHeaders: { Origin: from }, forceNew: true, reconnection: false });
    clients.push(socket); return socket;
  }
  try {
    const professional = connect(origin);
    const owner = await request(professional, "join", { create: true });
    assert(owner.id);
    const student = connect(origin);
    const reply = await request(student, "join", { id: owner.id, key: owner.studentKey });
    assert.equal(reply.role, "student");
    assert.equal(reply.id, owner.id);
    const denied = connect("https://untrusted.example");
    await new Promise((resolve, reject) => { denied.once("connect_error", resolve); denied.once("connect", () => reject(Error("Origem indevida aceita"))); });
    const endpoint = `${url}/api/sessions/${owner.id}/export`;
    const preflight = await fetch(endpoint, { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Headers": "authorization,x-attobrain-export" } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), origin);
    const download = await fetch(endpoint, { headers: { Origin: origin, Authorization: `Bearer ${owner.key}` } });
    assert.equal(download.status, 200);
    assert.equal((await download.json()).manifest.sessionId, owner.id);
    assert.equal((await fetch(endpoint, { headers: { Origin: origin } })).status, 403);
    assert.equal((await fetch(endpoint, { method: "OPTIONS", headers: { Origin: "https://untrusted.example" } })).status, 403);
    for (const route of ["/health", "/runtime-config.js", "/vendor/socket.io.min.js"])
      assert.equal((await fetch(url + route)).status, 200);
  } finally { clients.forEach(socket => socket.disconnect()); await app.close(); }
});
