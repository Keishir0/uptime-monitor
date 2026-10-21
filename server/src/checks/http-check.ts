import type { CheckStatus, HttpMethod } from "../generated/prisma/enums.js";

export type HttpCheckTarget = {
  url: string;
  method: HttpMethod;
  timeoutMs: number;
  expectedStatus: number;
};

export type HttpCheckResult = {
  status: CheckStatus;
  statusCode: number | null;
  /** Tempo até receber os headers da resposta (TTFB), em ms. */
  latencyMs: number | null;
  error: string | null;
};

const USER_AGENT = "UptimeMonitor/1.0 (+health-check)";

export async function performHttpCheck(target: HttpCheckTarget): Promise<HttpCheckResult> {
  const startedAt = performance.now();

  try {
    const response = await fetch(target.url, {
      method: target.method,
      redirect: "follow",
      signal: AbortSignal.timeout(target.timeoutMs),
      headers: { "user-agent": USER_AGENT, accept: "*/*" },
    });
    const latencyMs = Math.round(performance.now() - startedAt);

    // Não precisamos do corpo: cancelar libera o socket sem baixar o payload.
    await response.body?.cancel().catch(() => {});

    if (response.status === target.expectedStatus) {
      return { status: "UP", statusCode: response.status, latencyMs, error: null };
    }
    return {
      status: "DOWN",
      statusCode: response.status,
      latencyMs,
      error: `HTTP ${response.status} (esperado ${target.expectedStatus})`,
    };
  } catch (err) {
    return { status: "DOWN", statusCode: null, latencyMs: null, error: describeFetchError(err, target.timeoutMs) };
  }
}

function describeFetchError(err: unknown, timeoutMs: number): string {
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return `Timeout após ${timeoutMs}ms`;
  }
  if (err instanceof Error) {
    // undici encapsula o erro de rede real em `cause` (ECONNREFUSED, ENOTFOUND, certificado...).
    // Com IPv4+IPv6 a causa pode ser um AggregateError com uma tentativa por endereço.
    const cause = err.cause as { code?: string; message?: string; errors?: { code?: string }[] } | undefined;
    const code = cause?.code ?? cause?.errors?.find((e) => e.code)?.code;
    if (code) return `${code}: ${cause?.message || err.message}`;
    return cause?.message || err.message;
  }
  return "Erro desconhecido";
}
