import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Link, RouterProvider } from "react-router";
import { AuthProvider } from "./auth/AuthProvider";
import { AppLayout } from "./layouts/AppLayout";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import { DashboardPage } from "./pages/DashboardPage";
import { ApiError } from "./lib/api";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      // Erros 4xx não melhoram com retry (404, 401, validação).
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
      refetchOnWindowFocus: true,
    },
  },
});

function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-center">
      <p className="text-5xl font-semibold tracking-tight">404</p>
      <p className="text-muted">Esta página não existe.</p>
      <Link to="/" className="text-sm font-medium text-accent hover:underline">
        Voltar ao início
      </Link>
    </div>
  );
}

// Rotas carregadas sob demanda: o Recharts (maior dependência) só baixa ao abrir um monitor.
const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/status/:slug", lazy: () => import("./pages/PublicStatusPage").then((m) => ({ Component: m.PublicStatusPage })) },
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "monitors/new", lazy: () => import("./pages/MonitorFormPage").then((m) => ({ Component: m.NewMonitorPage })) },
      { path: "monitors/:id", lazy: () => import("./pages/MonitorDetailPage").then((m) => ({ Component: m.MonitorDetailPage })) },
      { path: "monitors/:id/edit", lazy: () => import("./pages/MonitorFormPage").then((m) => ({ Component: m.EditMonitorPage })) },
      { path: "settings", lazy: () => import("./pages/SettingsPage").then((m) => ({ Component: m.SettingsPage })) },
    ],
  },
  { path: "*", element: <NotFound /> },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
