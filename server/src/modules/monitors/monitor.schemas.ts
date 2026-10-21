import { z } from "zod";
import { CheckStatus, HttpMethod, WebhookProvider } from "../../generated/prisma/enums.js";

const httpUrl = z.url({ protocol: /^https?$/, error: "Informe uma URL http(s) válida" }).max(2048);

// Campos sem default: reaproveitados no PATCH (onde ausente = "não alterar").
const monitorFields = {
  name: z.string().trim().min(1, "Informe um nome para o monitor").max(120),
  url: httpUrl,
  method: z.enum(HttpMethod),
  intervalSeconds: z.number().int().min(30).max(86_400),
  timeoutMs: z.number().int().min(1_000).max(30_000),
  expectedStatus: z.number().int().min(100).max(599),
  failureThreshold: z.number().int().min(1).max(10),
  isPublic: z.boolean(),
  webhookUrl: httpUrl.nullable(),
  webhookProvider: z.enum(WebhookProvider).nullable(),
};

export const createMonitorSchema = z.object({
  ...monitorFields,
  method: monitorFields.method.default("GET"),
  intervalSeconds: monitorFields.intervalSeconds.default(60),
  timeoutMs: monitorFields.timeoutMs.optional(), // default vem do env
  expectedStatus: monitorFields.expectedStatus.default(200),
  failureThreshold: monitorFields.failureThreshold.default(2),
  isPublic: monitorFields.isPublic.default(false),
  webhookUrl: monitorFields.webhookUrl.default(null),
  webhookProvider: monitorFields.webhookProvider.default(null),
});

export const updateMonitorSchema = z
  .object(monitorFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, "Envie ao menos um campo para atualizar");

export const monitorParamsSchema = z.object({ id: z.uuid("ID de monitor inválido") });

export const listChecksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  /** Cursor: retorna checks anteriores a esta data (paginação por tempo). */
  before: z.coerce.date().optional(),
  status: z.enum(CheckStatus).optional(),
});

export const statsQuerySchema = z.object({
  range: z.enum(["24h", "7d", "30d"]).default("24h"),
});

export const dailyQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(90),
});

export type CreateMonitorInput = z.infer<typeof createMonitorSchema>;
export type UpdateMonitorInput = z.infer<typeof updateMonitorSchema>;
export type ListChecksQuery = z.infer<typeof listChecksQuerySchema>;
