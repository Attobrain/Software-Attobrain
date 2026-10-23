"use strict";
const http = require("node:http");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { streamExport } = require("./src/services/export");
const { inspection } = require("./src/services/inspection");
const { Server } = require("socket.io");
const { attach } = require("./realtime");
const { SessionRepository } = require("./src/repositories/sessions");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
function createApplication(options = {}) {
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
      if (req.method !== "GET") {
        res.writeHead(405);
        res.end("Método não permitido.");
        return;
      }
      let route = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
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
          "/live.html",
          "/live.js",
          "/live.css",
          "/index.html",
          "/styles.css",
          "/app.js",
          "/maze.js",
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
    maxHttpBufferSize: 16384,
    allowRequest: (req, callback) => {
      const origin = req.headers.origin;
      let allowed = !origin;
      try {
        allowed ||= new URL(origin).host === req.headers.host;
      } catch {}
      callback(null, allowed);
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
  const app = createApplication();
  const port = Number(process.env.PORT) || 3000;
  app.server.listen(port, () =>
    console.log(`Attobrain: http://localhost:${port}/profissional`),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => app.close().then(() => process.exit(0)));
}
module.exports = { createApplication };
