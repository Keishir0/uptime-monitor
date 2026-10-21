const LOCALE = "pt-BR";

export function formatUptime(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return "—";
  // 100% fica sem casas; 99,999 não pode arredondar para "100,00%".
  if (value === 100) return "100%";
  const factor = 10 ** digits;
  const floored = Math.floor(value * factor) / factor;
  return `${floored.toLocaleString(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

export function formatLatency(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms >= 1000) return `${(ms / 1000).toLocaleString(LOCALE, { maximumFractionDigits: 2 })} s`;
  return `${Math.round(ms).toLocaleString(LOCALE)} ms`;
}

export function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${seconds / 60} min`;
  return `${seconds / 3600} h`;
}

const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });

export function formatRelative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "nunca";
  const diffSeconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 45) return "agora";
  if (abs < 3600) return relative.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86_400) return relative.format(Math.round(diffSeconds / 3600), "hour");
  return relative.format(Math.round(diffSeconds / 86_400), "day");
}

/** "há 2 h 15 min" — duração desde uma data, para "fora do ar há ..." */
export function formatSince(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "menos de 1 min";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return hours > 0 ? `${days} d ${hours} h` : `${days} d`;
  if (hours > 0) return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`;
  return `${mins} min`;
}

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(LOCALE, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });

/** Datas das barras diárias são dias UTC (YYYY-MM-DD): formatar em UTC para não "voltar um dia". */
export const formatDay = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(LOCALE, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

export const formatShortDay = (iso: string) =>
  new Date(iso).toLocaleDateString(LOCALE, { day: "2-digit", month: "short" });
