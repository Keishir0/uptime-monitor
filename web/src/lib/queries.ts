import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type {
  CheckLog,
  CheckStatus,
  DailyUptime,
  Monitor,
  MonitorInput,
  MonitorStats,
  MonitorWithStats,
  Paginated,
  PublicStatusPage,
  StatsRange,
  User,
} from "./types";

// O worker grava um check por intervalo: 15s de polling deixa o painel "ao vivo" sem martelar a API.
const LIVE_REFETCH_MS = 15_000;

export const queryKeys = {
  me: ["me"] as const,
  monitors: ["monitors"] as const,
  monitor: (id: string) => ["monitors", id] as const,
  stats: (id: string, range: StatsRange) => ["monitors", id, "stats", range] as const,
  daily: (id: string) => ["monitors", id, "daily"] as const,
  checks: (id: string, status?: CheckStatus) => ["monitors", id, "checks", status ?? "all"] as const,
  publicStatus: (slug: string) => ["public-status", slug] as const,
};

// ─── Leitura ──────────────────────────────────────────

export function useMonitors() {
  return useQuery({
    queryKey: queryKeys.monitors,
    queryFn: () => api<{ data: MonitorWithStats[] }>("/monitors").then((r) => r.data),
    refetchInterval: LIVE_REFETCH_MS,
  });
}

export function useMonitor(id: string) {
  return useQuery({
    queryKey: queryKeys.monitor(id),
    queryFn: () => api<{ data: Monitor }>(`/monitors/${id}`).then((r) => r.data),
    refetchInterval: LIVE_REFETCH_MS,
  });
}

export function useMonitorStats(id: string, range: StatsRange) {
  return useQuery({
    queryKey: queryKeys.stats(id, range),
    queryFn: () => api<{ data: MonitorStats }>(`/monitors/${id}/stats?range=${range}`).then((r) => r.data),
    refetchInterval: LIVE_REFETCH_MS * 2,
    // Ao trocar de período, mantém o gráfico anterior até o novo chegar (sem "piscar").
    placeholderData: keepPreviousData,
  });
}

export function useMonitorDaily(id: string) {
  return useQuery({
    queryKey: queryKeys.daily(id),
    queryFn: () => api<{ data: DailyUptime }>(`/monitors/${id}/daily?days=90`).then((r) => r.data),
    refetchInterval: 60_000,
  });
}

export function useChecks(id: string, status?: CheckStatus) {
  return useQuery({
    queryKey: queryKeys.checks(id, status),
    queryFn: () =>
      api<Paginated<CheckLog>>(`/monitors/${id}/checks?limit=15${status ? `&status=${status}` : ""}`),
    refetchInterval: LIVE_REFETCH_MS,
    placeholderData: keepPreviousData,
  });
}

export function usePublicStatus(slug: string) {
  return useQuery({
    queryKey: queryKeys.publicStatus(slug),
    queryFn: () => api<{ data: PublicStatusPage }>(`/public/status/${slug}`, { auth: false }).then((r) => r.data),
    refetchInterval: 60_000,
    retry: (count, error) => (error as { status?: number }).status !== 404 && count < 2,
  });
}

// ─── Escrita ──────────────────────────────────────────

export function useCreateMonitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MonitorInput) =>
      api<{ data: Monitor }>("/monitors", { method: "POST", body: input }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.monitors }),
  });
}

export function useUpdateMonitor(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<MonitorInput>) =>
      api<{ data: Monitor }>(`/monitors/${id}`, { method: "PATCH", body: input }).then((r) => r.data),
    onSuccess: (monitor) => {
      qc.setQueryData(queryKeys.monitor(id), monitor);
      qc.invalidateQueries({ queryKey: queryKeys.monitors });
    },
  });
}

export function useToggleMonitor(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: "pause" | "resume") =>
      api<{ data: Monitor }>(`/monitors/${id}/${action}`, { method: "POST" }).then((r) => r.data),
    onSuccess: (monitor) => {
      qc.setQueryData(queryKeys.monitor(id), monitor);
      qc.invalidateQueries({ queryKey: queryKeys.monitors });
    },
  });
}

export function useDeleteMonitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/monitors/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: queryKeys.monitor(id) });
      qc.invalidateQueries({ queryKey: queryKeys.monitors });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name?: string; statusPageSlug?: string | null }) =>
      api<{ user: User }>("/auth/me", { method: "PATCH", body: input }).then((r) => r.user),
    onSuccess: (user) => qc.setQueryData(queryKeys.me, user),
  });
}
