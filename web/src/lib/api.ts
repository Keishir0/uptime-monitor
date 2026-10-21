const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";
const TOKEN_KEY = "uptime.token";

export type FieldIssue = { path: string; message: string };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues: FieldIssue[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Mensagem do campo para exibir no formulário (vinda do zod no backend). */
  fieldError(path: string): string | undefined {
    return this.issues.find((issue) => issue.path === path)?.message;
  }
}

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* modo privado: a sessão dura só enquanto a aba estiver aberta */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

/** Disparado quando a API recusa o token: o AuthProvider escuta e desloga. */
export const UNAUTHORIZED_EVENT = "uptime:unauthorized";

type RequestOptions = { method?: string; body?: unknown; auth?: boolean; signal?: AbortSignal };

export async function api<T>(path: string, { method = "GET", body, auth = true, signal }: RequestOptions = {}): Promise<T> {
  const token = auth ? tokenStore.get() : null;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(BASE_URL + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK_ERROR", "Não foi possível conectar à API. Ela está rodando?");
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && token) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    // 502/503/504 sem corpo JSON = a API não respondeu (proxy do Vite ou gateway em produção).
    if (!payload && response.status >= 502 && response.status <= 504) {
      throw new ApiError(response.status, "API_UNAVAILABLE", "A API está indisponível no momento. Tente novamente em instantes.");
    }
    throw new ApiError(
      response.status,
      payload?.error ?? "HTTP_ERROR",
      payload?.message ?? `Erro ${response.status}`,
      payload?.issues ?? [],
    );
  }
  return payload as T;
}
