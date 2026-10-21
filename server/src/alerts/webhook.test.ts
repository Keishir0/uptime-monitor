import { describe, expect, it } from "vitest";
import { buildWebhookPayload, formatDuration } from "./webhook.js";
import type { AlertEvent } from "./types.js";

const downEvent: AlertEvent = {
  type: "DOWN",
  monitor: { id: "m1", name: "API", url: "https://api.example.com/health" },
  statusCode: 503,
  latencyMs: 120,
  error: "HTTP 503 (esperado 200)",
  occurredAt: "2026-10-21T12:00:00.000Z",
  downSince: null,
};

const recoveredEvent: AlertEvent = {
  ...downEvent,
  type: "RECOVERED",
  statusCode: 200,
  error: null,
  occurredAt: "2026-10-21T13:05:30.000Z",
  downSince: "2026-10-21T12:00:00.000Z",
};

describe("formatDuration", () => {
  it.each([
    [0, "0s"],
    [45_000, "45s"],
    [3_930_000, "1h 5m 30s"],
    [90_061_000, "1d 1h 1m 1s"],
  ])("%i ms → %s", (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});

describe("buildWebhookPayload", () => {
  it("Discord: embed vermelho com o motivo da queda", () => {
    const payload = buildWebhookPayload("DISCORD", downEvent) as any;
    const embed = payload.embeds[0];

    expect(embed.title).toContain("FORA DO AR");
    expect(embed.color).toBe(0xdc2626);
    expect(embed.timestamp).toBe(downEvent.occurredAt);
    expect(embed.fields).toContainEqual({ name: "Motivo", value: "HTTP 503 (esperado 200)", inline: true });
  });

  it("Discord: recuperação informa o tempo fora do ar", () => {
    const embed = (buildWebhookPayload("DISCORD", recoveredEvent) as any).embeds[0];

    expect(embed.color).toBe(0x16a34a);
    expect(embed.fields).toContainEqual({ name: "Tempo fora do ar", value: "1h 5m 30s", inline: true });
  });

  it("Slack: texto de fallback e cor em hexadecimal", () => {
    const payload = buildWebhookPayload("SLACK", downEvent) as any;

    expect(payload.text).toContain("API");
    expect(payload.attachments[0].color).toBe("#dc2626");
    expect(payload.attachments[0].blocks[1].fields[1].text).toBe("*Motivo*\nHTTP 503 (esperado 200)");
  });
});
