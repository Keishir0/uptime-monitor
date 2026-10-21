import type { Job } from "bullmq";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { reconcileSchedulers } from "../queues/monitor-scheduler.js";
import type { MaintenanceJobName } from "../queues/queues.js";

export async function processMaintenance(job: Job<unknown, unknown, MaintenanceJobName>) {
  switch (job.name) {
    case "purge-check-logs": {
      const cutoff = new Date(Date.now() - env.CHECK_LOG_RETENTION_DAYS * 86_400_000);
      // Coberto pelo índice BRIN em checked_at.
      const { count } = await prisma.checkLog.deleteMany({ where: { checkedAt: { lt: cutoff } } });
      return { deleted: count, cutoff: cutoff.toISOString() };
    }
    case "reconcile-schedulers":
      return reconcileSchedulers();
    default:
      throw new Error(`Job de manutenção desconhecido: ${String(job.name)}`);
  }
}
