import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { pingRedis } from "./queues/queues.js";
import { errorHandler } from "./http/error-handler.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { monitorRoutes } from "./modules/monitors/monitor.routes.js";
import { publicRoutes } from "./modules/public/public.routes.js";

export async function buildApp() {
  const app = Fastify({ loggerInstance: logger });

  app.setErrorHandler(errorHandler);

  await app.register(helmet);
  await app.register(cors, {
    origin: env.WEB_ORIGIN,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  await app.register(jwt, { secret: env.JWT_SECRET, sign: { expiresIn: env.JWT_EXPIRES_IN } });

  app.get("/health", { config: { rateLimit: false } }, async (_request, reply) => {
    const [db, redis] = await Promise.allSettled([prisma.$queryRaw`SELECT 1`, pingRedis()]);
    const status = {
      database: db.status === "fulfilled" ? "up" : "down",
      redis: redis.status === "fulfilled" ? "up" : "down",
    };
    const healthy = Object.values(status).every((s) => s === "up");
    return reply.status(healthy ? 200 : 503).send({ status: healthy ? "ok" : "degraded", ...status });
  });

  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(monitorRoutes, { prefix: "/monitors" });
  await app.register(publicRoutes, { prefix: "/public" });

  return app;
}
