import { z } from "zod";

// Mensagens padrão de validação em português (chegam ao usuário via issues da API).
// Fica aqui porque este módulo é o primeiro carregado pela API, pelo worker e pelos scripts.
z.config(z.locales.ptBR());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),

  JWT_SECRET: z.string().min(32, "JWT_SECRET deve ter pelo menos 32 caracteres"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),

  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(500).default(20),
  CHECK_DEFAULT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(10000),
  CHECK_LOG_RETENTION_DAYS: z.coerce.number().int().min(1).default(90),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variáveis de ambiente inválidas:\n" + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export const isDev = env.NODE_ENV === "development";
