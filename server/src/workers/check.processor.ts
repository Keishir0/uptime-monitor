import type { Job } from "bullmq";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { performHttpCheck } from "../checks/http-check.js";
import { evaluateCheck } from "../checks/evaluate.js";
import { alertQueue, type CheckJobData } from "../queues/queues.js";
import type { AlertEvent } from "../alerts/types.js";

export type CheckJobResult =
  | { skipped: true; reason: string }
  | { skipped: false; status: "UP" | "DOWN"; latencyMs: number | null; alert: string | null };

export async function processCheck(job: Job<CheckJobData>): Promise<CheckJobResult> {
  const { monitorId } = job.data;

  const monitor = await prisma.monitor.findUnique({ where: { id: monitorId } });
  if (!monitor) return { skipped: true, reason: "monitor removido" };
  if (!monitor.isActive) return { skipped: true, reason: "monitor pausado" };

  const result = await performHttpCheck(monitor);
  const transition = evaluateCheck(monitor, result.status);
  const checkedAt = new Date();

  const persisted = await prisma.$transaction(async (tx) => {
    // Condicional em isActive: se o monitor foi pausado/removido durante o check,
    // não sobrescrevemos o estado PAUSED nem gravamos log.
    const { count } = await tx.monitor.updateMany({
      where: { id: monitorId, isActive: true },
      data: {
        status: transition.status,
        consecutiveFailures: transition.consecutiveFailures,
        lastCheckedAt: checkedAt,
        lastLatencyMs: result.latencyMs,
        ...(transition.statusChanged && { lastStatusChangeAt: checkedAt }),
      },
    });
    if (count === 0) return false;

    await tx.checkLog.create({
      data: {
        monitorId,
        status: result.status,
        statusCode: result.statusCode,
        latencyMs: result.latencyMs,
        error: result.error?.slice(0, 1024) ?? null,
        checkedAt,
      },
    });
    return true;
  });

  if (!persisted) return { skipped: true, reason: "monitor pausado durante o check" };

  if (transition.statusChanged) {
    logger.info(
      { monitorId, from: monitor.status, to: transition.status, error: result.error },
      `Monitor "${monitor.name}" mudou de status`,
    );
  }

  // O alerta vai para outra fila: falha no webhook não refaz o check nem duplica o log.
  if (transition.alert && monitor.webhookUrl && monitor.webhookProvider) {
    const event: AlertEvent = {
      type: transition.alert,
      monitor: { id: monitor.id, name: monitor.name, url: monitor.url },
      statusCode: result.statusCode,
      latencyMs: result.latencyMs,
      error: result.error,
      occurredAt: checkedAt.toISOString(),
      downSince: transition.alert === "RECOVERED" ? (monitor.lastStatusChangeAt?.toISOString() ?? null) : null,
    };
    await alertQueue.add(
      transition.alert,
      { webhookUrl: monitor.webhookUrl, provider: monitor.webhookProvider, event },
      // jobId determinístico: se o job de check for reprocessado, o alerta não duplica.
      { jobId: `${monitor.id}-${transition.alert}-${checkedAt.getTime()}` },
    );
  }

  return { skipped: false, status: result.status, latencyMs: result.latencyMs, alert: transition.alert };
}
