"use strict";
const { performance } = require("node:perf_hooks");
const { SessionRepository } = require("../repositories/sessions");
const { startEEG } = require("../services/eeg");
function attach(
  io,
  {
    repository = new SessionRepository(),
    clock = () => performance.now(),
    eeg = true,
  } = {},
) {
  const cursors = new Map(),
    limits = new Map();
  const sendFull = (socket, s, role) => {
    socket.emit("snapshot", { ...s.view(role, true), full: true });
    if (role === "professional")
      socket.emit(
        "eeg-history",
        s.eeg.blocks.slice(-90).map((b) => ({
          ...b,
          channels: b.channels.map((a) => Array.from(a)),
        })),
      );
  };
  const full = (s) => {
    for (const role of ["professional", "student"]) {
      const socket = io.sockets.sockets.get(s[role]);
      if (socket) sendFull(socket, s, role);
    }
    cursors.set(s.id, {
      runId: s.current?.id,
      state: s.current?.state,
      trajectory: s.current?.trajectory.length ?? 0,
      events: s.events.length,
      metrics: s.time,
    });
  };
  io.on("connection", (socket) => {
    let session, role;
    const commandTimes = [];
    const safe = (event, handler) =>
      socket.on(event, (request, reply) => {
        const ack = typeof reply === "function" ? reply : () => {};
        try {
          handler(request, ack);
        } catch (error) {
          ack({ error: error.message });
        }
      });
    safe("join", (request, reply) => {
      if (session) throw Error("Já associado.");
      if (!request || typeof request !== "object")
        throw Error("Requisição inválida.");
      if (request.create === true) {
        const address = socket.handshake.address,
          now = clock(),
          times = (limits.get(address) || []).filter((t) => now - t < 60000);
        if (times.length >= 8)
          throw Error("Muitas criações. Aguarde um minuto.");
        times.push(now);
        limits.set(address, times);
        session = repository.create(now);
        role = "professional";
      } else {
        const candidate = repository.sessions.get(request.id);
        if (!candidate) throw Error("Sessão não encontrada. Crie outra.");
        role =
          request.key === candidate.professionalKey
            ? "professional"
            : request.key === candidate.studentKey
              ? "student"
              : null;
        if (!role || candidate[role])
          throw Error("Credencial inválida ou tela já conectada.");
        session = candidate;
      }
      session[role] = socket.id;
      session.lastConnected = clock();
      if (role === "student" && session.current) {
        session.current.lastSeq = -1;
        session.current.lastAccepted = -Infinity;
      }
      reply({
        id: session.id,
        key:
          role === "professional"
            ? session.professionalKey
            : session.studentKey,
        ...(role === "professional" ? { studentKey: session.studentKey } : {}),
        role,
      });
      full(session);
    });
    safe("command", (request, reply) => {
      if (!session || role !== "professional") throw Error("Sem permissão.");
      if (
        !request ||
        request.id !== session.id ||
        typeof request.commandId !== "string" ||
        request.commandId.length > 80
      )
        throw Error("Comando inválido.");
      if (session.commands.has(request.commandId))
        return reply(session.commands.get(request.commandId));
      const now = clock();
      while (commandTimes.length && now - commandTimes[0] > 1000)
        commandTimes.shift();
      if (commandTimes.length >= 15) throw Error("Limite de comandos.");
      commandTimes.push(now);
      session.tick(now);
      let result;
      try {
        if (request.type === "reset")
          throw Error(
            "Crie nova sessão para preservar resultados e credenciais.",
          );
        result = session.execute(request);
        if (request.type === "prepare" && eeg)
          session.worker = startEEG(session, (type, data) => {
            if (session.professional)
              io.to(session.professional).emit(
                type,
                type === "eeg"
                  ? {
                      ...data,
                      channels: data.channels.map((a) => Array.from(a)),
                    }
                  : data,
              );
          });
      } catch (error) {
        result = { error: error.message };
      }
      session.commands.set(request.commandId, result);
      if (session.commands.size > 256)
        session.commands.delete(session.commands.keys().next().value);
      reply(result);
      full(session);
    });
    socket.on("input", (request) => {
      if (session && role === "student") session.input(request);
    });
    safe("ping-clock", (request, reply) =>
      reply({
        serverTime: session?.time ?? 0,
        clientTime: request?.clientTime,
      }),
    );
    socket.on("disconnect", () => {
      if (!session) return;
      session[role] = null;
      session.lastConnected = clock();
      session.pause("disconnected");
      full(session);
    });
  });
  let lastBroadcast = 0;
  const timer = setInterval(() => {
    const now = clock();
    repository.sweep(now);
    for (const id of cursors.keys())
      if (!repository.sessions.has(id)) cursors.delete(id);
    for (const s of repository.sessions.values()) {
      const before = s.events.length;
      s.tick(now);
      if (s.closed && s.worker && !s.eegFinishing) {
        s.eegFinishing = true;
        s.worker.finish(s.time);
      }
      if (s.config.eegMode === "interactive" && s.worker)
        for (const event of s.events.slice(before))
          if (event.type === "contact") s.worker.modulate(event);
      const cursor = cursors.get(s.id);
      if (
        !cursor ||
        cursor.runId !== s.current?.id ||
        cursor.state !== s.current?.state
      ) {
        full(s);
        continue;
      }
      if (now - lastBroadcast < 49) continue;
      const trajectory = s.current?.trajectory.slice(cursor.trajectory) ?? [],
        events = s.events.slice(cursor.events);
      for (const role of ["professional", "student"])
        if (s[role]) {
          let view;
          if (role === "professional" && s.time - cursor.metrics < 249) {
            view = { ...s.view("student"), trajectory, events };
          } else
            view = {
              ...s.view(role),
              ...(role === "professional" ? { trajectory, events } : {}),
            };
          io.to(s[role]).emit("snapshot", { ...view, full: false });
        }
      cursor.trajectory = s.current?.trajectory.length ?? 0;
      cursor.events = s.events.length;
      if (s.time - cursor.metrics >= 249) cursor.metrics = s.time;
    }
    if (now - lastBroadcast >= 49) lastBroadcast = now;
    for (const [address, times] of limits)
      if (!times.some((t) => now - t < 60000)) limits.delete(address);
  }, 1000 / 60);
  const stop = async () => {
    clearInterval(timer);
    await repository.close();
  };
  stop.repository = repository;
  return stop;
}
module.exports = { attach };
