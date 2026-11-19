"use strict";
// Prepara o banco na primeira execução: se as tabelas ainda não existem
// (por exemplo, num computador novo com o XAMPP recém-ligado), roda os scripts da pasta sql/.
// Se o banco já existe, não mexe em nada.
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

async function prepararBanco(env = process.env, pastaSql = path.join(__dirname, "..", "sql")) {
  if (!env.DB_HOST) return "sem-banco";
  const conexao = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    multipleStatements: true,
  });
  try {
    const nome = env.DB_NAME || "attobrain";
    const [tabelas] = await conexao.query(
      "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = ? AND table_name = 'profissionais'",
      [nome],
    );
    if (tabelas[0].total > 0) return "ja-existe";
    // Os scripts criam e usam o banco "attobrain".
    for (const arquivo of ["attobrain.sql", "dados-demonstracao.sql"]) {
      await conexao.query(fs.readFileSync(path.join(pastaSql, arquivo), "utf8"));
    }
    return "criado";
  } finally {
    await conexao.end();
  }
}
module.exports = { prepararBanco };
