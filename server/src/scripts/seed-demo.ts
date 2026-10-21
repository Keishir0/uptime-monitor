/**
 * Popula o banco com uma conta de demonstração e 90 dias de histórico sintético,
 * para o dashboard e a página pública já nascerem com gráficos.
 *
 *   npm run db:seed
 *
 * Idempotente: recria a conta demo a cada execução.
 */
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { closeQueues } from "../queues/queues.js";
import { reconcileSchedulers } from "../queues/monitor-scheduler.js";
import type { Prisma } from "../generated/prisma/client.js";

export const DEMO_USER = { name: "Demo", email: "demo@example.com", password: "demo12345", slug: "demo" };

const HISTORY_DAYS = 90;
const SAMPLE_EVERY_MIN = 10;

type Incident = { daysAgo: number; durationMin: number; error: string; statusCode?: number };

type DemoMonitor = {
  name: string;
  url: string;
  isPublic: boolean;
  isActive?: boolean;
  baseLatency: number;
  jitter: number;
  incidents: Incident[];
  /** Se definido, o monitor está fora do ar há esta quantidade de minutos. */
  downForMin?: number;
};

const TIMEOUT = "Timeout após 10000ms";

const MONITORS: DemoMonitor[] = [
  {
    name: "Site institucional",
    url: "https://www.google.com",
    isPublic: true,
    baseLatency: 110,
    jitter: 40,
    incidents: [{ daysAgo: 12.4, durationMin: 20, error: "HTTP 502 (esperado 200)", statusCode: 502 }],
  },
  {
    name: "Status do GitHub",
    url: "https://www.githubstatus.com",
    isPublic: true,
    baseLatency: 240,
    jitter: 90,
    incidents: [
      { daysAgo: 3.2, durationMin: 70, error: "HTTP 503 (esperado 200)", statusCode: 503 },
      { daysAgo: 41.6, durationMin: 30, error: TIMEOUT },
    ],
  },
  {
    name: "CDN",
    url: "https://www.cloudflare.com",
    isPublic: true,
    baseLatency: 45,
    jitter: 12,
    incidents: [],
  },
  {
    name: "API legada",
    url: "https://api-legada.invalid/health",
    isPublic: true,
    baseLatency: 380,
    jitter: 160,
    incidents: [
      { daysAgo: 8.7, durationMin: 240, error: "ENOTFOUND: getaddrinfo ENOTFOUND api-legada.invalid" },
      { daysAgo: 27.1, durationMin: 50, error: TIMEOUT },
      { daysAgo: 63.5, durationMin: 600, error: "HTTP 500 (esperado 200)", statusCode: 500 },
    ],
    downForMin: 95,
  },
  {
    name: "Painel interno (pausado)",
    url: "https://example.com",
    isPublic: false,
    isActive: false,
    baseLatency: 160,
    jitter: 50,
    incidents: [],
  },
];

// PRNG determinístico: o mesmo seed gera sempre o mesmo histórico.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildHistory(monitorId: string, spec: DemoMonitor, now: number, random: () => number) {
  const stepMs = SAMPLE_EVERY_MIN * 60_000;
  const start = now - HISTORY_DAYS * 86_400_000;
  const windows = spec.incidents.map((i) => {
    const from = now - i.daysAgo * 86_400_000;
    return { ...i, from, to: from + i.durationMin * 60_000 };
  });
  if (spec.downForMin) {
    windows.push({ daysAgo: 0, durationMin: spec.downForMin, error: "ENOTFOUND: getaddrinfo ENOTFOUND api-legada.invalid", from: now - spec.downForMin * 60_000, to: now + 1 });
  }

  const rows: Prisma.CheckLogCreateManyInput[] = [];
  for (let t = start; t <= now; t += stepMs) {
    const incident = windows.find((w) => t >= w.from && t < w.to);
    const checkedAt = new Date(t);

    if (incident) {
      rows.push({
        monitorId,
        checkedAt,
        status: "DOWN",
        statusCode: incident.statusCode ?? null,
        latencyMs: incident.statusCode ? Math.round(spec.baseLatency * 1.5) : null,
        error: incident.error,
      });
      continue;
    }

    // Padrão diário (pico de tráfego à tarde, UTC) + ruído + picos raros.
    const hour = checkedAt.getUTCHours() + checkedAt.getUTCMinutes() / 60;
    const daily = Math.sin(((hour - 8) / 24) * 2 * Math.PI) * spec.jitter * 0.6;
    const noise = (random() - 0.5) * spec.jitter;
    const spike = random() < 0.01 ? spec.baseLatency * (1 + random() * 2) : 0;
    const latencyMs = Math.max(5, Math.round(spec.baseLatency + daily + noise + spike));
    rows.push({ monitorId, checkedAt, status: "UP", statusCode: 200, latencyMs, error: null });
  }
  return rows;
}

async function main() {
  const random = mulberry32(42);
  const now = Date.now();

  await prisma.user.deleteMany({ where: { email: DEMO_USER.email } }); // cascata limpa monitores e logs

  const user = await prisma.user.create({
    data: {
      name: DEMO_USER.name,
      email: DEMO_USER.email,
      passwordHash: await bcrypt.hash(DEMO_USER.password, 12),
      statusPageSlug: DEMO_USER.slug,
    },
  });

  for (const spec of MONITORS) {
    const isActive = spec.isActive ?? true;
    const monitor = await prisma.monitor.create({
      data: {
        userId: user.id,
        name: spec.name,
        url: spec.url,
        isPublic: spec.isPublic,
        isActive,
        intervalSeconds: 60,
        timeoutMs: 10_000,
      },
    });

    const rows = buildHistory(monitor.id, spec, now, random);
    for (let i = 0; i < rows.length; i += 5_000) {
      await prisma.checkLog.createMany({ data: rows.slice(i, i + 5_000) });
    }

    // Estado atual coerente com o último check do histórico.
    const last = rows.at(-1)!;
    const isDown = last.status === "DOWN";
    const lastChange = isDown
      ? new Date(now - (spec.downForMin ?? 0) * 60_000)
      : new Date(Math.max(now - HISTORY_DAYS * 86_400_000, ...spec.incidents.map((i) => now - i.daysAgo * 86_400_000 + i.durationMin * 60_000)));

    await prisma.monitor.update({
      where: { id: monitor.id },
      data: {
        status: !isActive ? "PAUSED" : isDown ? "DOWN" : "UP",
        consecutiveFailures: isDown ? Math.round((spec.downForMin ?? 0) / SAMPLE_EVERY_MIN) : 0,
        lastCheckedAt: last.checkedAt,
        lastLatencyMs: last.latencyMs ?? null,
        lastStatusChangeAt: lastChange,
      },
    });

    console.log(`  ✓ ${spec.name}: ${rows.length.toLocaleString("pt-BR")} checks`);
  }

  const scheduled = await reconcileSchedulers();
  console.log(`\nSchedulers sincronizados: ${JSON.stringify(scheduled)}`);
  console.log(`\nConta demo → ${DEMO_USER.email} / ${DEMO_USER.password}`);
  console.log(`Página pública → /status/${DEMO_USER.slug}`);
}

try {
  await main();
} finally {
  await closeQueues();
  await prisma.$disconnect();
}
