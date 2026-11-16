"use strict";
function exigirLogin(req, res, next) {
  if (!req.session?.profissionalId) return res.status(401).json({ erro: "Faça login para continuar." });
  next();
}
module.exports = { exigirLogin };
