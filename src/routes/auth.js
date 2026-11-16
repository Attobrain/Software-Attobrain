"use strict";
const express = require("express");
const bcrypt = require("bcryptjs");

// Hash de mentira: faz o login demorar igual quando o e-mail não existe.
const HASH_FALSO = "$2b$10$5XDimOSotIlN.zEe7SB5dexPv6q2EKPA.PQVC3cYFxZQkUYOYB6mK";

function rotasAuth(db) {
  const router = express.Router();

  router.post("/login", async (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const senha = String(req.body?.senha ?? "");
    if (!email || !senha) return res.status(400).json({ erro: "Informe e-mail e senha." });
    const [linhas] = await db.query("SELECT id, nome, senha_hash FROM profissionais WHERE email = ?", [email]);
    const profissional = linhas[0];
    const senhaConfere = await bcrypt.compare(senha, profissional?.senha_hash ?? HASH_FALSO);
    if (!profissional || !senhaConfere)
      return res.status(401).json({ erro: "E-mail ou senha incorretos." });
    req.session.regenerate((erro) => {
      if (erro) return res.status(500).json({ erro: "Não foi possível entrar." });
      req.session.profissionalId = profissional.id;
      req.session.nome = profissional.nome;
      res.json({ nome: profissional.nome });
    });
  });

  router.post("/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  router.get("/me", (req, res) => {
    if (!req.session?.profissionalId) return res.status(401).json({ erro: "Não autenticado." });
    res.json({ nome: req.session.nome });
  });

  return router;
}
module.exports = { rotasAuth };
