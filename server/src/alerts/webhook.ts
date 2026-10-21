import type { WebhookProvider } from "../generated/prisma/enums.js";
import type { AlertEvent } from "./types.js";

const COLORS = { DOWN: 0xdc2626, RECOVERED: 0x16a34a } as const;
const WEBHOOK_TIMEOUT_MS = 10_000;

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`, seconds && `${seconds}s`];
  return parts.filter(Boolean).join(" ") || "0s";
}

function describe(event: AlertEvent) {
  const isDown = event.type === "DOWN";
  const title = isDown ? `🔴 ${event.monitor.name} está FORA DO AR` : `🟢 ${event.monitor.name} voltou ao ar`;

  const fields: { name: string; value: string }[] = [{ name: "URL", value: event.monitor.url }];
  if (isDown) {
    fields.push({ name: "Motivo", value: event.error ?? "Falha desconhecida" });
  } else {
    if (event.downSince) {
      const downtime = Date.parse(event.occurredAt) - Date.parse(event.downSince);
      fields.push({ name: "Tempo fora do ar", value: formatDuration(downtime) });
    }
    if (event.latencyMs !== null) fields.push({ name: "Latência", value: `${event.latencyMs} ms` });
  }

  return { title, fields, color: COLORS[event.type] };
}

export function buildWebhookPayload(provider: WebhookProvider, event: AlertEvent): unknown {
  const { title, fields, color } = describe(event);

  if (provider === "DISCORD") {
    return {
      username: "Uptime Monitor",
      embeds: [
        {
          title,
          color,
          fields: fields.map((f) => ({ ...f, inline: f.name !== "URL" })),
          timestamp: event.occurredAt,
        },
      ],
    };
  }

  return {
    text: title, // fallback para notificações push
    attachments: [
      {
        color: `#${color.toString(16).padStart(6, "0")}`,
        blocks: [
          { type: "header", text: { type: "plain_text", text: title } },
          {
            type: "section",
            fields: fields.map((f) => ({ type: "mrkdwn", text: `*${f.name}*\n${f.value}` })),
          },
          { type: "context", elements: [{ type: "mrkdwn", text: `<!date^${Math.floor(Date.parse(event.occurredAt) / 1000)}^{date_short_pretty} {time_secs}|${event.occurredAt}>` }] },
        ],
      },
    ],
  };
}

/** Lança erro em resposta não-2xx para o BullMQ aplicar retry com backoff. */
export async function sendWebhook(url: string, provider: WebhookProvider, event: AlertEvent): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildWebhookPayload(provider, event)),
    signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Webhook ${provider} respondeu HTTP ${response.status}: ${body.slice(0, 200)}`);
  }
}
