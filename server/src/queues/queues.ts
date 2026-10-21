import { Queue } from "bullmq";
import { createRedisConnection } from "../lib/redis.js";
import type { AlertJobData } from "../alerts/types.js";

export const CHECK_QUEUE = "monitor-checks";
export const ALERT_QUEUE = "alerts";
export const MAINTENANCE_QUEUE = "maintenance";

export type CheckJobData = { monitorId: string };
export type MaintenanceJobName = "purge-check-logs" | "reconcile-schedulers";

const connection = createRedisConnection("uptime:queues");

export const checkQueue = new Queue<CheckJobData>(CHECK_QUEUE, {
  connection,
  defaultJobOptions: {
    // Sem retry: a próxima execução agendada já é a "nova tentativa".
    attempts: 1,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 1000 },
  },
});

export const alertQueue = new Queue<AlertJobData>(ALERT_QUEUE, {
  connection,
  defaultJobOptions: {
    // Webhooks externos falham (rate limit, instabilidade): retry com backoff.
    attempts: 5,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});

export const maintenanceQueue = new Queue(MAINTENANCE_QUEUE, {
  connection,
  defaultJobOptions: { removeOnComplete: { count: 50 }, removeOnFail: { count: 50 } },
});

export async function pingRedis(): Promise<void> {
  await connection.ping();
}

export async function closeQueues(): Promise<void> {
  await Promise.all([checkQueue.close(), alertQueue.close(), maintenanceQueue.close()]);
  await connection.quit();
}
