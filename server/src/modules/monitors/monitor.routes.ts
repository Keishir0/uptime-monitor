import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../http/auth-guard.js";
import {
  createMonitorSchema,
  dailyQuerySchema,
  listChecksQuerySchema,
  monitorParamsSchema,
  statsQuerySchema,
  updateMonitorSchema,
} from "./monitor.schemas.js";
import * as monitorService from "./monitor.service.js";

export async function monitorRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/", async (request) => {
    return { data: await monitorService.listMonitors(request.user.sub) };
  });

  app.post("/", async (request, reply) => {
    const input = createMonitorSchema.parse(request.body);
    const monitor = await monitorService.createMonitor(request.user.sub, input);
    return reply.status(201).send({ data: monitor });
  });

  app.get("/:id", async (request) => {
    const { id } = monitorParamsSchema.parse(request.params);
    return { data: await monitorService.getMonitor(request.user.sub, id) };
  });

  app.patch("/:id", async (request) => {
    const { id } = monitorParamsSchema.parse(request.params);
    const input = updateMonitorSchema.parse(request.body);
    return { data: await monitorService.updateMonitor(request.user.sub, id, input) };
  });

  app.delete("/:id", async (request, reply) => {
    const { id } = monitorParamsSchema.parse(request.params);
    await monitorService.deleteMonitor(request.user.sub, id);
    return reply.status(204).send();
  });

  app.post("/:id/pause", async (request) => {
    const { id } = monitorParamsSchema.parse(request.params);
    return { data: await monitorService.pauseMonitor(request.user.sub, id) };
  });

  app.post("/:id/resume", async (request) => {
    const { id } = monitorParamsSchema.parse(request.params);
    return { data: await monitorService.resumeMonitor(request.user.sub, id) };
  });

  app.get("/:id/checks", async (request) => {
    const { id } = monitorParamsSchema.parse(request.params);
    const query = listChecksQuerySchema.parse(request.query);
    return monitorService.listChecks(request.user.sub, id, query);
  });

  app.get("/:id/stats", async (request) => {
    const { id } = monitorParamsSchema.parse(request.params);
    const { range } = statsQuerySchema.parse(request.query);
    return { data: await monitorService.getStats(request.user.sub, id, range) };
  });

  app.get("/:id/daily", async (request) => {
    const { id } = monitorParamsSchema.parse(request.params);
    const { days } = dailyQuerySchema.parse(request.query);
    return { data: await monitorService.getDaily(request.user.sub, id, days) };
  });
}
