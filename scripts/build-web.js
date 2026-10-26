"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");

async function build() {
  const root = path.resolve(__dirname, "..");
  const output = path.join(root, "dist");
  const raw = process.env.ATTOBRAIN_SERVER_URL || "";
  let serverUrl = "";
  if (raw) {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash)
      throw Error("ATTOBRAIN_SERVER_URL deve ser uma origem HTTPS, sem caminho ou credenciais.");
    serverUrl = url.origin;
  } else if (process.env.VERCEL) {
    throw Error("Configure ATTOBRAIN_SERVER_URL na Vercel antes de publicar.");
  }
  if (path.dirname(output) !== root) throw Error("Diretório de build fora do projeto.");
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output, { recursive: true });
  // Lista explícita: fontes do servidor, testes, documentos e arquivos pessoais não são publicados.
  for (const file of ["live.html", "live.js", "live.css", "styles.css", "navigation.js", "assets", "public/modules"])
    await fs.cp(path.join(root, file), path.join(output, file), { recursive: true });
  await fs.mkdir(path.join(output, "vendor"), { recursive: true });
  await fs.copyFile(path.join(root, "node_modules/socket.io/client-dist/socket.io.min.js"), path.join(output, "vendor/socket.io.min.js"));
  await fs.writeFile(path.join(output, "runtime-config.js"), `window.ATTOBRAIN_CONFIG = ${JSON.stringify({ serverUrl })};\n`);
  console.log(`Frontend pronto em dist. Servidor: ${serverUrl || "mesma origem (desenvolvimento)"}`);
}
build().catch(error => { console.error(error.message); process.exitCode = 1; });
