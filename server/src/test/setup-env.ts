import { config } from "dotenv";

// Precisa rodar antes de qualquer import que leia process.env (ex: config/env.ts).
config({ path: ".env.test", quiet: true });
