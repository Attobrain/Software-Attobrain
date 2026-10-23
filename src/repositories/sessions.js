"use strict";
const { Session } = require("../domain/session");
class SessionRepository {
  constructor() {
    this.sessions = new Map();
  }
  create(now) {
    this.sweep(now);
    if (this.sessions.size >= 4)
      throw Error(
        "Limite de quatro sessões em memória. Exporte e encerre sessões sem uso.",
      );
    const session = new Session(now);
    this.sessions.set(session.id, session);
    return session;
  }
  sweep(now) {
    for (const [id, s] of this.sessions)
      if (!s.professional && !s.student && now - s.lastConnected >= 1800000) {
        s.worker?.stop();
        this.sessions.delete(id);
      }
  }
  close() {
    return Promise.all(
      [...this.sessions.values()].map((s) => s.worker?.stop()),
    );
  }
}
module.exports = { SessionRepository };
