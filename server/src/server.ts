import { env } from "./config/env.js";
import { buildApp } from "./app.js";
import { prisma } from "./lib/prisma.js";
import { closeQueues } from "./queues/queues.js";

const app = await buildApp();

async function shutdown(signal: string) {
  app.log.info({ signal }, "Encerrando API");
  await app.close();
  await Promise.allSettled([closeQueues(), prisma.$disconnect()]);
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  app.log.fatal(err);
  process.exit(1);
}
