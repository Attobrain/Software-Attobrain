const http = require("node:http");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

const port = Number(process.env.PORT) || 3000;
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = http.createServer(async (request, response) => {
  if (request.method !== "GET") {
    response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Método não permitido.");
    return;
  }

  let requestedPath;
  try {
    requestedPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400);
    response.end("Endereço inválido.");
    return;
  }

  if (requestedPath === "/") requestedPath = "/index.html";

  const isAllowedFile = ["/index.html", "/styles.css", "/app.js"].includes(requestedPath)
    || requestedPath.startsWith("/assets/");
  if (!isAllowedFile) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Arquivo não encontrado.");
    return;
  }

  const filePath = path.resolve(__dirname, `.${requestedPath}`);
  const relativePath = path.relative(__dirname, filePath);
  const assetRelativePath = path.relative(path.join(__dirname, "assets"), filePath);
  if (requestedPath.startsWith("/assets/")
    && (assetRelativePath === ".." || assetRelativePath.startsWith(`..${path.sep}`) || path.isAbsolute(assetRelativePath))) {
    response.writeHead(403);
    response.end("Acesso negado.");
    return;
  }
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    response.writeHead(403);
    response.end("Acesso negado.");
    return;
  }

  try {
    const file = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": contentTypes[extension] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(file);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Arquivo não encontrado.");
  }
});

server.listen(port, () => {
  console.log(`Attobrain está no ar: http://localhost:${port}`);
});
