"use strict";
const { Session } = require("../domain/session");
class SessionRepository {
  constructor() {
    this.sessions = new Map();
    this.creations = new Map();
  }
  create(now, token, guided = false) {
    this.sweep(now);
    if (token !== undefined && (typeof token !== "string" || !/^[a-f0-9-]{36}$/.test(token))) throw Error("Identificador de criação inválido.");
    if (token && this.creations.has(token)) return this.sessions.get(this.creations.get(token));
    // Cheio: libera a sessão mais antiga que ninguém está usando (sem profissional nem aluno conectado).
    if (this.sessions.size >= 4) {
      // Primeiro uma sessão sem ninguém conectado; senão uma já encerrada (o resumo já foi salvo).
      const todas = [...this.sessions];
      const livre = todas.find(([, s]) => !s.professional && !s.student) ?? todas.find(([, s]) => s.closed);
      if (livre) this.remove(livre[0]);
    }
    if (this.sessions.size >= 4)
      throw Error(
        "Limite de quatro sessões em memória. Exporte e encerre sessões sem uso.",
      );
    const session = new Session(now);
    session.guided = guided;
    this.sessions.set(session.id, session);
    if (token) this.creations.set(token, session.id);
    return session;
  }
  sweep(now) {
    for (const [id, s] of this.sessions)
      if (!s.professional && !s.student && now - s.lastConnected >= 1800000) this.remove(id);
  }
  remove(id) {
    this.sessions.get(id)?.worker?.stop();
    this.sessions.delete(id);
    for (const [token, sessionId] of this.creations) if (sessionId === id) this.creations.delete(token);
  }
  close() {
    return Promise.all(
      [...this.sessions.values()].map((s) => s.worker?.stop()),
    );
  }
}
module.exports = { SessionRepository };
