"use strict";
const mysql = require("mysql2/promise");

// Sem DB_HOST configurado o sistema roda sem banco (login desligado).
function criarPool(env = process.env) {
  if (!env.DB_HOST) return null;
  return mysql.createPool({
    host: env.DB_HOST,
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    connectionLimit: 5,
  });
}
module.exports = { criarPool };
