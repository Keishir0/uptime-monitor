import { existsSync } from "node:fs";
import { config } from "dotenv";

// .env.test não é versionado (pode ter credenciais); o modelo é o .env.test.example.
if (!existsSync(".env.test")) {
  throw new Error("Arquivo .env.test não encontrado. Crie com: cp .env.test.example .env.test");
}

// Precisa rodar antes de qualquer import que leia process.env (ex: config/env.ts).
config({ path: ".env.test", quiet: true });
