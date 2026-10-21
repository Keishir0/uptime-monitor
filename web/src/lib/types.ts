// Espelho dos contratos da API (server/src/modules/*).

export type MonitorStatus = "PENDING" | "UP" | "DOWN" | "PAUSED";
export type CheckStatus = "UP" | "DOWN";
export type HttpMethod = "GET" | "HEAD" | "POST";
export type WebhookProvider = "DISCORD" | "SLACK";
export type StatsRange = "24h" | "7d" | "30d";

export type User = {
  id: string;
  name: string;
  email: string;
  statusPageSlug: string | null;
  createdAt: string;
};

export type Monitor = {
  id: string;
  name: string;
  url: string;
  method: HttpMethod;
  intervalSeconds: number;
  timeoutMs: number;
  expectedStatus: number;
  isActive: boolean;
  isPublic: boolean;
  webhookUrl: string | null;
  webhookProvider: WebhookProvider | null;
  failureThreshold: number;
  status: MonitorStatus;
  consecutiveFailures: number;
  lastCheckedAt: string | null;
  lastStatusChangeAt: string | null;
  lastLatencyMs: number | null;
  createdAt: string;
  updatedAt: string;
};

export type MonitorWithStats = Monitor & {
  last24h: { uptimePercent: number | null; avgLatencyMs: number | null };
};

export type MonitorInput = {
  name: string;
  url: string;
  method: HttpMethod;
  intervalSeconds: number;
  timeoutMs: number;
  expectedStatus: number;
  failureThreshold: number;
  isPublic: boolean;
  webhookUrl: string | null;
  webhookProvider: WebhookProvider | null;
};

export type CheckLog = {
  id: string;
  monitorId: string;
  status: CheckStatus;
  statusCode: number | null;
  latencyMs: number | null;
  error: string | null;
  checkedAt: string;
};

export type Paginated<T> = { data: T[]; nextCursor: string | null };

export type StatsPoint = {
  bucket: string;
  total: number;
  failed: number;
  avgLatencyMs: number | null;
  maxLatencyMs: number | null;
};

export type MonitorStats = {
  range: StatsRange;
  from: string;
  bucketMinutes: number;
  summary: {
    totalChecks: number;
    failedChecks: number;
    uptimePercent: number | null;
    avgLatencyMs: number | null;
    p95LatencyMs: number | null;
  };
  series: StatsPoint[];
};

export type DailyBar = {
  date: string;
  total: number;
  failed: number;
  uptimePercent: number | null;
};

export type DailyUptime = { uptimePercent: number | null; days: DailyBar[] };

export type OverallStatus = "OPERATIONAL" | "PARTIAL_OUTAGE" | "MAJOR_OUTAGE" | "UNKNOWN";

export type PublicStatusPage = {
  name: string;
  slug: string;
  overallStatus: OverallStatus;
  generatedAt: string;
  monitors: {
    id: string;
    name: string;
    status: MonitorStatus;
    lastCheckedAt: string | null;
    uptimePercent: number | null;
    days: DailyBar[];
  }[];
};
