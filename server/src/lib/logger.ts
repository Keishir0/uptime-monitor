import { pino } from "pino";
import { env, isDev } from "../config/env.js";

/** Logger compartilhado entre API (Fastify) e worker. */
export const logger = pino({
  level: env.LOG_LEVEL,
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" },
    },
  }),
});
