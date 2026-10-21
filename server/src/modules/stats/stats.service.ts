import { prisma } from "../../lib/prisma.js";

/** Janela de análise → tamanho do bucket do gráfico (~60–120 pontos por série). */
export const STATS_RANGES = {
  "24h": { hours: 24, bucketMinutes: 15 },
  "7d": { hours: 24 * 7, bucketMinutes: 120 },
  "30d": { hours: 24 * 30, bucketMinutes: 360 },
} as const;

export type StatsRange = keyof typeof STATS_RANGES;

export type DailyBar = {
  date: string; // YYYY-MM-DD (UTC)
  total: number;
  failed: number;
  uptimePercent: number | null; // null = sem dados no dia
};

export function uptimePercent(total: number, failed: number): number | null {
  if (total === 0) return null;
  return Math.round(((total - failed) / total) * 100_000) / 1000; // 3 casas decimais
}

type SummaryRow = { total: number; failed: number; avg_latency: number | null; p95_latency: number | null };
type BucketRow = { bucket: Date; total: number; failed: number; avg_latency: number | null; max_latency: number | null };

export async function getMonitorStats(monitorId: string, range: StatsRange) {
  const { hours, bucketMinutes } = STATS_RANGES[range];
  const bucketMs = bucketMinutes * 60_000;
  // Alinha o início ao bucket para que as fronteiras sejam estáveis entre requisições.
  const from = new Date(Math.floor((Date.now() - hours * 3_600_000) / bucketMs) * bucketMs);
  const bucketInterval = `${bucketMinutes} minutes`;

  // Os dois agregados usam o índice (monitor_id, checked_at DESC).
  const [summaryRows, bucketRows] = await Promise.all([
    prisma.$queryRaw<SummaryRow[]>`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE status = 'DOWN')::int AS failed,
        round(avg(latency_ms) FILTER (WHERE status = 'UP'))::int AS avg_latency,
        round(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE status = 'UP'))::int AS p95_latency
      FROM check_logs
      WHERE monitor_id = ${monitorId}::uuid AND checked_at >= ${from}`,
    prisma.$queryRaw<BucketRow[]>`
      SELECT
        date_bin(${bucketInterval}::interval, checked_at, ${from}::timestamptz) AS bucket,
        count(*)::int AS total,
        count(*) FILTER (WHERE status = 'DOWN')::int AS failed,
        round(avg(latency_ms) FILTER (WHERE status = 'UP'))::int AS avg_latency,
        max(latency_ms) FILTER (WHERE status = 'UP') AS max_latency
      FROM check_logs
      WHERE monitor_id = ${monitorId}::uuid AND checked_at >= ${from}
      GROUP BY 1
      ORDER BY 1`,
  ]);

  const summary = summaryRows[0] ?? { total: 0, failed: 0, avg_latency: null, p95_latency: null };

  // Preenche buckets vazios com null: o gráfico mostra a lacuna em vez de ligar os pontos.
  const byTime = new Map(bucketRows.map((row) => [row.bucket.getTime(), row]));
  const series = [];
  for (let t = from.getTime(); t <= Date.now(); t += bucketMs) {
    const row = byTime.get(t);
    series.push({
      bucket: new Date(t).toISOString(),
      total: row?.total ?? 0,
      failed: row?.failed ?? 0,
      avgLatencyMs: row?.avg_latency ?? null,
      maxLatencyMs: row?.max_latency ?? null,
    });
  }

  return {
    range,
    from: from.toISOString(),
    bucketMinutes,
    summary: {
      totalChecks: summary.total,
      failedChecks: summary.failed,
      uptimePercent: uptimePercent(summary.total, summary.failed),
      avgLatencyMs: summary.avg_latency,
      p95LatencyMs: summary.p95_latency,
    },
    series,
  };
}

type DailyRow = { monitor_id: string; day: string; total: number; failed: number };

/** Barras diárias (UTC) estilo Statuspage para vários monitores em uma única query. */
export async function getDailyBars(monitorIds: string[], days: number): Promise<Map<string, DailyBar[]>> {
  const result = new Map<string, DailyBar[]>();
  if (monitorIds.length === 0) return result;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const from = new Date(today.getTime() - (days - 1) * 86_400_000);

  const rows = await prisma.$queryRaw<DailyRow[]>`
    SELECT
      monitor_id::text AS monitor_id,
      to_char(checked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
      count(*)::int AS total,
      count(*) FILTER (WHERE status = 'DOWN')::int AS failed
    FROM check_logs
    WHERE monitor_id = ANY(${monitorIds}::uuid[]) AND checked_at >= ${from}
    GROUP BY 1, 2`;

  const byKey = new Map(rows.map((row) => [`${row.monitor_id}|${row.day}`, row]));

  for (const id of monitorIds) {
    const bars: DailyBar[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(from.getTime() + i * 86_400_000).toISOString().slice(0, 10);
      const row = byKey.get(`${id}|${date}`);
      const total = row?.total ?? 0;
      const failed = row?.failed ?? 0;
      bars.push({ date, total, failed, uptimePercent: uptimePercent(total, failed) });
    }
    result.set(id, bars);
  }
  return result;
}

/** Soma as barras diárias em um único percentual para o período inteiro. */
export function overallUptime(bars: DailyBar[]): number | null {
  const total = bars.reduce((sum, bar) => sum + bar.total, 0);
  const failed = bars.reduce((sum, bar) => sum + bar.failed, 0);
  return uptimePercent(total, failed);
}

type Last24hRow = { monitor_id: string; total: number; failed: number; avg_latency: number | null };

/** Uptime e latência média das últimas 24h por monitor (cards do dashboard). */
export async function getLast24hStats(monitorIds: string[]) {
  const result = new Map<string, { uptimePercent: number | null; avgLatencyMs: number | null }>();
  if (monitorIds.length === 0) return result;

  const from = new Date(Date.now() - 24 * 3_600_000);
  const rows = await prisma.$queryRaw<Last24hRow[]>`
    SELECT
      monitor_id::text AS monitor_id,
      count(*)::int AS total,
      count(*) FILTER (WHERE status = 'DOWN')::int AS failed,
      round(avg(latency_ms) FILTER (WHERE status = 'UP'))::int AS avg_latency
    FROM check_logs
    WHERE monitor_id = ANY(${monitorIds}::uuid[]) AND checked_at >= ${from}
    GROUP BY 1`;

  for (const row of rows) {
    result.set(row.monitor_id, {
      uptimePercent: uptimePercent(row.total, row.failed),
      avgLatencyMs: row.avg_latency,
    });
  }
  return result;
}
