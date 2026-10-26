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
  const server = http.createServer(async (req, res) => {
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
      const allowed =
        [
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
  });
  const io = new Server(server, {
    cors: { origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)), methods: ["GET", "POST"] },
    maxHttpBufferSize: 16384,
    allowRequest: (req, callback) => {
      callback(null, originAllowed(req));
    },
  });
  const stop = attach(io, { repository, ...options });
  return {
    server,
    io,
    repository,
    close: async () => {
      await stop();
      await new Promise((resolve) => io.close(resolve));
    },
  };
}
if (require.main === module) {
  const app = createApplication({ logger: record => console.log(JSON.stringify(record)) });
  const port = Number(process.env.PORT) || 3000;
  app.server.listen(port, () =>
    console.log(`Attobrain: http://localhost:${port}/profissional`),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => app.close().then(() => process.exit(0)));
}
module.exports = { createApplication };
