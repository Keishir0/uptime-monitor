import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { notFound } from "../../lib/errors.js";
import { statusPageSlugSchema } from "../auth/auth.schemas.js";
import { getDailyBars, overallUptime } from "../stats/stats.service.js";
import type { MonitorStatus } from "../../generated/prisma/enums.js";

const STATUS_PAGE_DAYS = 90;

type OverallStatus = "OPERATIONAL" | "PARTIAL_OUTAGE" | "MAJOR_OUTAGE" | "UNKNOWN";

function computeOverall(statuses: MonitorStatus[]): OverallStatus {
  // PENDING/PAUSED não indicam falha: ficam fora do cálculo.
  const relevant = statuses.filter((s) => s === "UP" || s === "DOWN");
  if (relevant.length === 0) return "UNKNOWN";
  const down = relevant.filter((s) => s === "DOWN").length;
  if (down === 0) return "OPERATIONAL";
  return down === relevant.length ? "MAJOR_OUTAGE" : "PARTIAL_OUTAGE";
}

export async function publicRoutes(app: FastifyInstance) {
  app.get("/status/:slug", async (request, reply) => {
    const parsed = z.object({ slug: statusPageSlugSchema }).safeParse(request.params);
    if (!parsed.success) throw notFound("Página de status não encontrada");

    const owner = await prisma.user.findUnique({
      where: { statusPageSlug: parsed.data.slug },
      select: {
        name: true,
        statusPageSlug: true,
        // Só dados seguros para exibição pública: nada de URL, webhook ou configuração.
        monitors: {
          where: { isPublic: true },
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, status: true, lastCheckedAt: true },
        },
      },
    });
    if (!owner) throw notFound("Página de status não encontrada");

    const bars = await getDailyBars(owner.monitors.map((m) => m.id), STATUS_PAGE_DAYS);

    reply.header("cache-control", "public, max-age=30");
    return {
      data: {
        name: owner.name,
        slug: owner.statusPageSlug,
        overallStatus: computeOverall(owner.monitors.map((m) => m.status)),
        generatedAt: new Date().toISOString(),
        monitors: owner.monitors.map((monitor) => {
          const days = bars.get(monitor.id) ?? [];
          return { ...monitor, uptimePercent: overallUptime(days), days };
        }),
      },
    };
  });
}
