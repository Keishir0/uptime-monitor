import { execSync } from "node:child_process";
import pg from "pg";
import { env } from "../config/env.js";

/** Cria o banco de teste (se necessário) e aplica as migrations. Idempotente. */
async function main() {
  const url = new URL(env.DATABASE_URL);
  const dbName = url.pathname.replace(/^\//, "");

  // Conecta na base de manutenção "postgres" para poder criar o banco de teste.
  url.pathname = "/postgres";
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();

  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Banco "${dbName}" criado.`);
    } else {
      console.log(`Banco "${dbName}" já existe.`);
    }
  } finally {
    await client.end();
  }

  // process.env já tem o DATABASE_URL de teste (carregado via --env-file=.env.test).
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
