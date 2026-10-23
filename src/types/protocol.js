"use strict";
const { DEFAULTS } = require("../validators/config");
const COMMANDS = Object.freeze({
  "select-participant": ["participant"], configure: ["config"], back: ["step"], begin: [], start: [], pause: [], resume: [], abort: ["reason"], next: [], "repeat-training": [], "end-session": ["reason"], notes: ["value"], reanalyze: [],
});
function protocolDescription() {
  return {
    version: 3,
    transport: "Socket.IO same-origin",
    events: { join: { create: { create: true, creationToken: "UUID mantido até confirmação" }, restore: { id: "sessionId", key: "credencial do papel" } }, presence: { visible: true }, preview: { config: DEFAULTS }, input: { runId: "runId", seq: 1, inside: true, hidden: false, x: .1, y: .1, clientTime: 0 } },
    command: { required: ["id", "commandId", "expectedRevision", "type"], types: COMMANDS, defaults: DEFAULTS },
    responses: { success: { ok: true }, invalid: { error: "Descrição da validação" }, conflict: { error: "O estado mudou. Confira a etapa atual e tente novamente." }, expired: { error: "Sessão não encontrada. Crie outra." } },
    http: [ { method: "GET", path: "/api/protocol", authorization: "public" }, { method: "GET", path: "/api/sessions/:id/export", authorization: "Bearer professionalKey", response: "JSON v3; X-Attobrain-Export: true confirma exportação" }, { method: "GET", path: "/api/sessions/:id/inspect?time=milliseconds", authorization: "Bearer professionalKey", response: "Projeção somente leitura, EEG limitado a quatro segundos" } ],
    retention: { maximumSessions: 4, durationMs: 1800000, disconnectedTtlMs: 1800000 },
  };
}
module.exports = { COMMANDS, protocolDescription };
