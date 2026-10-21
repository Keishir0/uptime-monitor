import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";

type Theme = "system" | "light" | "dark";

const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Theme, string> = { system: "Tema do sistema", light: "Tema claro", dark: "Tema escuro" };
const ICON = { system: Monitor, light: Sun, dark: Moon };

function readTheme(): Theme {
  const value = document.documentElement.dataset.theme;
  return value === "light" || value === "dark" ? value : "system";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const Icon = ICON[theme];

  function cycle() {
    const next = NEXT[theme];
    if (next === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    try {
      if (next === "system") localStorage.removeItem("uptime.theme");
      else localStorage.setItem("uptime.theme", next);
    } catch {
      /* sem storage: vale só para esta sessão */
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={cycle}
      className="rounded-lg p-2 text-muted transition hover:bg-surface-2 hover:text-fg"
      aria-label={`${LABEL[theme]} (clique para alternar)`}
      title={LABEL[theme]}
    >
      <Icon className="size-4" />
    </button>
  );
}
