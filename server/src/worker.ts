import { Worker } from "bullmq";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { createRedisConnection } from "./lib/redis.js";
import { reconcileSchedulers } from "./queues/monitor-scheduler.js";
import { ALERT_QUEUE, CHECK_QUEUE, MAINTENANCE_QUEUE, closeQueues, maintenanceQueue } from "./queues/queues.js";
import { processCheck } from "./workers/check.processor.js";
import { processAlert } from "./workers/alert.processor.js";
import { processMaintenance } from "./workers/maintenance.processor.js";

const connection = createRedisConnection("uptime:worker");

const workers = [
  // Checks são I/O-bound: alta concorrência num único processo.
  new Worker(CHECK_QUEUE, processCheck, { connection, concurrency: env.WORKER_CONCURRENCY }),
  new Worker(ALERT_QUEUE, processAlert, { connection, concurrency: 5 }),
  new Worker(MAINTENANCE_QUEUE, processMaintenance, { connection, concurrency: 1 }),
];

for (const worker of workers) {
  const log = logger.child({ queue: worker.name });

  worker.on("completed", (job, result) => log.debug({ jobId: job.id, result }, "Job concluído"));
  worker.on("failed", (job, err) => {
    log.warn({ jobId: job?.id, attempt: job?.attemptsMade, err: err.message }, "Job falhou");
  });
  worker.on("error", (err) => log.error({ err }, "Erro no worker"));
}

const reconciled = await reconcileSchedulers();
logger.info(reconciled, "Schedulers de monitores sincronizados com o banco");

await maintenanceQueue.upsertJobScheduler("purge-check-logs", { pattern: "0 3 * * *" }, { name: "purge-check-logs" });
await maintenanceQueue.upsertJobScheduler("reconcile-schedulers", { every: 5 * 60_000 }, { name: "reconcile-schedulers" });

logger.info({ concurrency: env.WORKER_CONCURRENCY }, "Worker em execução");

async function shutdown(signal: string) {
  logger.info({ signal }, "Encerrando worker (aguardando jobs em andamento)");
  await Promise.all(workers.map((w) => w.close()));
  await Promise.allSettled([closeQueues(), connection.quit(), prisma.$disconnect()]);
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
