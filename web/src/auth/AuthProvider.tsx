import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, tokenStore, UNAUTHORIZED_EVENT } from "../lib/api";
import { queryKeys } from "../lib/queries";
import type { User } from "../lib/types";

type AuthResponse = { token: string; user: User };

type AuthContextValue = {
  user: User | null;
  /** true enquanto valida um token salvo (evita redirecionar para o login à toa). */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState(() => tokenStore.get());

  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api<{ user: User }>("/auth/me").then((r) => r.user),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
  });

  const logout = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    queryClient.clear(); // nada do usuário anterior fica em cache
  }, [queryClient]);

  // Token expirado/revogado em qualquer request → sai da sessão.
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout);
  }, [logout]);

  const startSession = useCallback(
    ({ token, user }: AuthResponse) => {
      tokenStore.set(token);
      queryClient.setQueryData(queryKeys.me, user);
      setToken(token);
    },
    [queryClient],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      startSession(await api<AuthResponse>("/auth/login", { method: "POST", body: { email, password }, auth: false }));
    },
    [startSession],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      startSession(
        await api<AuthResponse>("/auth/register", { method: "POST", body: { name, email, password }, auth: false }),
      );
    },
    [startSession],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: token ? (me.data ?? null) : null,
      isLoading: Boolean(token) && me.isPending,
      login,
      register,
      logout,
    }),
    [token, me.data, me.isPending, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
