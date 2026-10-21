import type { WebhookProvider } from "../generated/prisma/enums.js";

export type AlertType = "DOWN" | "RECOVERED";

/** Snapshot do evento no momento da transição; o alerta não relê o banco. */
export type AlertEvent = {
  type: AlertType;
  monitor: { id: string; name: string; url: string };
  statusCode: number | null;
  latencyMs: number | null;
  error: string | null;
  occurredAt: string;
  /** Para RECOVERED: quando o monitor caiu (calcula o tempo de indisponibilidade). */
  downSince: string | null;
};

export type AlertJobData = {
  webhookUrl: string;
  provider: WebhookProvider;
  event: AlertEvent;
};
