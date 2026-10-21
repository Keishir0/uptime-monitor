import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { fieldError, notFound } from "../../lib/errors.js";
import { scheduleMonitor, unscheduleMonitor } from "../../queues/monitor-scheduler.js";
import type { Monitor } from "../../generated/prisma/client.js";
import type { CreateMonitorInput, ListChecksQuery, UpdateMonitorInput } from "./monitor.schemas.js";
import {
  getDailyBars,
  getLast24hStats,
  getMonitorStats,
  overallUptime,
  type StatsRange,
} from "../stats/stats.service.js";

type MonitorConfig = Pick<Monitor, "intervalSeconds" | "timeoutMs" | "webhookUrl" | "webhookProvider">;

/** Regras que envolvem mais de um campo; valem tanto para criação quanto para PATCH (valores mesclados). */
function assertConsistentConfig(config: MonitorConfig): void {
  if (config.timeoutMs >= config.intervalSeconds * 1000) {
    throw fieldError("timeoutMs", "O timeout deve ser menor que o intervalo entre checks");
  }
  if (config.webhookProvider && !config.webhookUrl) {
    throw fieldError("webhookUrl", "Informe a URL do webhook");
  }
  if (config.webhookUrl && !config.webhookProvider) {
    throw fieldError("webhookProvider", "Escolha o tipo do webhook (Discord ou Slack)");
  }
}

async function findOwnedMonitor(userId: string, id: string): Promise<Monitor> {
  // Filtra por userId: monitor de outro usuário responde 404, sem revelar que existe.
  const monitor = await prisma.monitor.findFirst({ where: { id, userId } });
  if (!monitor) throw notFound("Monitor não encontrado");
  return monitor;
}

export async function listMonitors(userId: string) {
  const monitors = await prisma.monitor.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  const stats = await getLast24hStats(monitors.map((m) => m.id));
  const empty = { uptimePercent: null, avgLatencyMs: null };
  return monitors.map((monitor) => ({ ...monitor, last24h: stats.get(monitor.id) ?? empty }));
}

export async function getMonitor(userId: string, id: string) {
  return findOwnedMonitor(userId, id);
}

export async function getStats(userId: string, id: string, range: StatsRange) {
  await findOwnedMonitor(userId, id);
  return getMonitorStats(id, range);
}

export async function getDaily(userId: string, id: string, days: number) {
  await findOwnedMonitor(userId, id);
  const bars = (await getDailyBars([id], days)).get(id) ?? [];
  return { uptimePercent: overallUptime(bars), days: bars };
}

export async function createMonitor(userId: string, input: CreateMonitorInput) {
  const data = { ...input, timeoutMs: input.timeoutMs ?? env.CHECK_DEFAULT_TIMEOUT_MS };
  assertConsistentConfig(data);

  const monitor = await prisma.monitor.create({ data: { ...data, userId } });
  await scheduleMonitor(monitor);
  return monitor;
}

export async function updateMonitor(userId: string, id: string, input: UpdateMonitorInput) {
  const current = await findOwnedMonitor(userId, id);
  assertConsistentConfig({ ...current, ...input });

  // Mudou o alvo do check: o estado anterior não vale mais para o novo endpoint.
  const targetChanged =
    (input.url !== undefined && input.url !== current.url) ||
    (input.method !== undefined && input.method !== current.method) ||
    (input.expectedStatus !== undefined && input.expectedStatus !== current.expectedStatus);

  const monitor = await prisma.monitor.update({
    where: { id },
    data: {
      ...input,
      ...(targetChanged && current.isActive && { status: "PENDING", consecutiveFailures: 0 }),
    },
  });

  if (monitor.intervalSeconds !== current.intervalSeconds) {
    await scheduleMonitor(monitor);
  }
  return monitor;
}

export async function deleteMonitor(userId: string, id: string): Promise<void> {
  await findOwnedMonitor(userId, id);
  await prisma.monitor.delete({ where: { id } }); // CheckLogs caem em cascata
  await unscheduleMonitor(id);
}

export async function pauseMonitor(userId: string, id: string) {
  await findOwnedMonitor(userId, id);
  const monitor = await prisma.monitor.update({
    where: { id },
    data: { isActive: false, status: "PAUSED", consecutiveFailures: 0, lastStatusChangeAt: new Date() },
  });
  await unscheduleMonitor(id);
  return monitor;
}

export async function resumeMonitor(userId: string, id: string) {
  const current = await findOwnedMonitor(userId, id);
  if (current.isActive) return current;

  const monitor = await prisma.monitor.update({
    where: { id },
    data: { isActive: true, status: "PENDING", consecutiveFailures: 0, lastStatusChangeAt: new Date() },
  });
  await scheduleMonitor(monitor);
  return monitor;
}

export async function listChecks(userId: string, monitorId: string, query: ListChecksQuery) {
  await findOwnedMonitor(userId, monitorId);

  // Usa o índice (monitor_id, checked_at DESC) — ou (monitor_id, status, checked_at DESC) com filtro de status.
  const checks = await prisma.checkLog.findMany({
    where: {
      monitorId,
      ...(query.status && { status: query.status }),
      ...(query.before && { checkedAt: { lt: query.before } }),
    },
    orderBy: { checkedAt: "desc" },
    take: query.limit,
  });

  const last = checks.at(-1);
  return {
    // BigInt não é serializável em JSON
    data: checks.map((check) => ({ ...check, id: check.id.toString() })),
    nextCursor: checks.length === query.limit && last ? last.checkedAt.toISOString() : null,
  };
}
