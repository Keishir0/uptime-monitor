import { prisma } from "../lib/prisma.js";
import { checkQueue } from "./queues.js";
import type { Monitor } from "../generated/prisma/client.js";

type SchedulableMonitor = Pick<Monitor, "id" | "intervalSeconds" | "isActive">;

// Um Job Scheduler por monitor: o id é o próprio monitorId, então upsert é idempotente.
// (sem ":" no id, que o BullMQ usa como separador das chaves no Redis)
const schedulerId = (monitorId: string) => `monitor-${monitorId}`;

/** Cria/atualiza o agendamento do monitor (ou remove, se estiver pausado). */
export async function scheduleMonitor(monitor: SchedulableMonitor): Promise<void> {
  if (!monitor.isActive) {
    await unscheduleMonitor(monitor.id);
    return;
  }

  await checkQueue.upsertJobScheduler(
    schedulerId(monitor.id),
    { every: monitor.intervalSeconds * 1000 },
    { name: "check", data: { monitorId: monitor.id } },
  );
}

export async function unscheduleMonitor(monitorId: string): Promise<void> {
  await checkQueue.removeJobScheduler(schedulerId(monitorId));
}

/**
 * Garante que o Redis reflete o banco: agenda todo monitor ativo e remove
 * schedulers órfãos. Roda no boot do worker e periodicamente, cobrindo falhas
 * entre a escrita no Postgres e a chamada ao Redis feita pela API.
 */
export async function reconcileSchedulers(): Promise<{ scheduled: number; removed: number }> {
  const active = await prisma.monitor.findMany({
    where: { isActive: true },
    select: { id: true, intervalSeconds: true, isActive: true },
  });
  const expected = new Set(active.map((m) => schedulerId(m.id)));

  const existing = await checkQueue.getJobSchedulers(0, -1);
  const byId = new Map(existing.map((s) => [s.key, s]));

  let scheduled = 0;
  for (const monitor of active) {
    // Só faz upsert se faltar ou se o intervalo mudou, evitando checks extras a cada boot.
    if (byId.get(schedulerId(monitor.id))?.every !== monitor.intervalSeconds * 1000) {
      await scheduleMonitor(monitor);
      scheduled++;
    }
  }

  let removed = 0;
  for (const scheduler of existing) {
    if (!expected.has(scheduler.key)) {
      await checkQueue.removeJobScheduler(scheduler.key);
      removed++;
    }
  }

  return { scheduled, removed };
}
