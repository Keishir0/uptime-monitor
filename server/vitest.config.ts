import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Carrega .env.test antes de qualquer outro setup (precisa rodar antes do módulo env.ts ser importado).
    setupFiles: ["./src/test/setup-env.ts", "./src/test/setup.ts"],
    // Os testes de rota compartilham o mesmo Postgres/Redis de teste: evita corrida entre arquivos.
    fileParallelism: false,
  },
});
