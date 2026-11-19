"use strict";
const http = require("node:http");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { streamExport } = require("./src/services/export");
const { inspection } = require("./src/services/inspection");
const { Server } = require("socket.io");
const { attach } = require("./realtime");
const { SessionRepository } = require("./src/repositories/sessions");
const { protocolDescription } = require("./src/types/protocol");
const express = require("express");
const session = require("express-session");
const { criarPool } = require("./src/db");
const { prepararBanco } = require("./src/banco-inicial");
const { rotasAuth } = require("./src/routes/auth");
const { rotasAlunos } = require("./src/routes/alunos");
const { resumoSessao } = require("./src/services/resumo-sessao");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
function createApplication(options = {}) {
  const allowedOrigins = new Set((options.allowedOrigins ?? process.env.ALLOWED_ORIGINS ?? "").split(",").map(value => value.trim()).filter(Boolean));
  function originAllowed(req) {
    const origin = req.headers.origin;
    if (!origin) return true;
    try { return allowedOrigins.has(origin) || new URL(origin).host === req.headers.host; }
    catch { return false; }
  }
  const repository = options.repository ?? new SessionRepository();
  const db = options.db !== undefined ? options.db : criarPool();
  const handler = async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; connect-src 'self' ws: wss:; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
    );
    try {
      if (req.headers.origin && !originAllowed(req)) {
        res.writeHead(403); res.end("Origem não autorizada."); return;
      }
      if (req.headers.origin) {
        res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Authorization, X-Attobrain-Export");
        res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, X-Attobrain-Export");
      }
      if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
      if (req.method !== "GET") {
        res.writeHead(405);
        res.end("Método não permitido.");
        return;
      }
      let route = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (route === "/health") {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true })); return;
      }
      if (route === "/vendor/socket.io.min.js") {
        res.setHeader("Content-Type", MIME[".js"]);
        res.end(await readFile(path.join(__dirname, "node_modules/socket.io/client-dist/socket.io.min.js"))); return;
      }
      if (route === "/api/protocol") {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify(protocolDescription()));
        return;
      }
      if (
        route.startsWith("/api/sessions/") &&
        (route.endsWith("/export") || route.endsWith("/inspect"))
      ) {
        const id = route.split("/")[3],
          s = repository.sessions.get(id),
          token = req.headers.authorization?.replace(/^Bearer /, "");
        if (!s || token !== s.professionalKey) {
          res.writeHead(403);
          res.end("Sem permissão.");
          return;
        }
        if (route.endsWith("/inspect")) {
          const instant = Number(
            new URL(req.url, "http://localhost").searchParams.get("time"),
          );
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(inspection(s, instant)));
        } else await streamExport(s, req, res);
        return;
      }
      if (["/", "/profissional", "/aluno"].includes(route))
        route = "/live.html";
      if (route === "/legado") route = "/index.html";
      if (route === "/login") route = "/login.html";
      const allowed =
        [
          "/login.html",
          "/navigation.js",
          "/runtime-config.js",
          "/live.html",
          "/live.js",
          "/live.css",
          "/index.html",
          "/styles.css",
          "/app.js",
        ].includes(route) ||
        route.startsWith("/assets/") ||
        route.startsWith("/public/modules/");
      if (!allowed) {
        res.writeHead(404);
        res.end("Não encontrado.");
        return;
      }
      const file = path.resolve(__dirname, `.${route}`),
        relative = path.relative(__dirname, file);
      const allowedRoot = route.startsWith("/assets/")
        ? "assets"
        : route.startsWith("/public/modules/")
          ? "public/modules"
          : null;
      const within = allowedRoot
        ? path.relative(path.join(__dirname, allowedRoot), file)
        : relative;
      if (
        within.startsWith("..") ||
        path.isAbsolute(within) ||
        relative.startsWith("..")
      ) {
        res.writeHead(403);
        res.end("Acesso negado.");
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream",
      });
      res.end(body);
    } catch (error) {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      res.writeHead(error.code === "ENOENT" ? 404 : 400);
      res.end("Requisição inválida.");
    }
  };
  const app = express();
  app.disable("x-powered-by");
  const segredo = options.sessionSecret ?? process.env.SESSION_SECRET;
  if (db && !segredo && process.env.NODE_ENV === "production") throw Error("Defina SESSION_SECRET para usar o login em produção.");
  const sessaoLogin = session({
    secret: segredo ?? "attobrain-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", maxAge: 8 * 60 * 60 * 1000 },
  });
  if (db) {
    app.use(sessaoLogin);
    app.use("/api", (req, res, next) => {
      if (req.headers.origin && !originAllowed(req)) return res.status(403).json({ erro: "Origem não autorizada." });
      next();
    });
    app.use("/api", express.json({ limit: "10kb" }));
    app.use("/api", rotasAuth(db));
    app.use("/api/alunos", rotasAlunos(db));
    app.use("/api", (erro, req, res, next) => {
      if (res.headersSent) return next(erro);
      if (erro.type === "entity.parse.failed") return res.status(400).json({ erro: "JSON inválido." });
      console.log(JSON.stringify({ level: "error", event: "erro-api", reason: erro.message }));
      res.status(500).json({ erro: "Erro interno. Tente novamente." });
    });
    app.use((req, res, next) => {
      const rota = req.path;
      if (req.method === "GET" && (rota === "/" || rota === "/profissional") && !req.session.profissionalId) return res.redirect("/login");
      next();
    });
  }
  app.use(handler);
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)), methods: ["GET", "POST"] },
    maxHttpBufferSize: 16384,
    allowRequest: (req, callback) => {
      callback(null, originAllowed(req));
    },
  });
  if (db) io.engine.use(sessaoLogin);
  // Grava o resumo da sessão em "sessoes". Se as observações mudarem depois (a sessão já
  // salva), apenas atualiza a linha existente. As chamadas entram numa fila para não duplicar.
  const gravarSessao = async (s) => {
    const alunoId = Number(s.participant?.id);
    if (!s.profissionalId || !Number.isInteger(alunoId)) return;
    try {
      const r = resumoSessao(s);
      if (s.sessaoId) {
        await db.query("UPDATE sessoes SET observacoes = ? WHERE id = ? AND profissional_id = ?", [r.observacoes, s.sessaoId, s.profissionalId]);
        return;
      }
      const [resultado] = await db.query(
        `INSERT INTO sessoes (aluno_id, profissional_id, nivel, fases_concluidas, tempo_ativo_seg, total_colisoes, motivo_fim, observacoes)
         SELECT id, profissional_id, ?, ?, ?, ?, ?, ? FROM alunos WHERE id = ? AND profissional_id = ?`,
        [r.nivel, r.fasesConcluidas, r.tempoAtivoSeg, r.totalColisoes, r.motivoFim, r.observacoes, alunoId, s.profissionalId],
      );
      if (!resultado.affectedRows) console.log(JSON.stringify({ level: "warn", event: "sessao-sem-aluno", alunoId }));
      else s.sessaoId = resultado.insertId;
    } catch (erro) {
      console.log(JSON.stringify({ level: "error", event: "salvar-sessao-falhou", reason: erro.message }));
    }
  };
  const salvarSessao = (s) => {
    if (!db) return;
    s.filaGravacao = (s.filaGravacao ?? Promise.resolve()).then(() => gravarSessao(s));
  };
  const stop = attach(io, { repository, requireLogin: !!db, onSessionEnd: salvarSessao, ...options });
  return {
    server,
    io,
    repository,
    close: async () => {
      await stop();
      await new Promise((resolve) => io.close(resolve));
      if (db && options.db === undefined) await db.end();
    },
  };
}
if (require.main === module) {
  (async () => {
    // O MySQL do XAMPP pode levar alguns segundos para aceitar conexões: tenta de novo antes de desistir.
    for (let tentativa = 1; tentativa <= 15; tentativa++) {
      try {
        const situacao = await prepararBanco();
        if (situacao === "criado") console.log("Banco attobrain criado com os dados de demonstração.");
        break;
      } catch (erro) {
        console.log(JSON.stringify({ level: "error", event: "preparar-banco-falhou", tentativa, reason: erro.message || erro.code }));
        if (tentativa < 15) await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    const app = createApplication({ logger: record => console.log(JSON.stringify(record)) });
    const port = Number(process.env.PORT) || 3000;
    app.server.listen(port, () =>
      console.log(`Attobrain: http://localhost:${port}/profissional`),
    );
    for (const signal of ["SIGINT", "SIGTERM"])
      process.on(signal, () => app.close().then(() => process.exit(0)));
  })();
}
module.exports = { createApplication };
