"use client";

import { useEffect } from "react";
import { Icon } from "@iconify/react";
import { useAppStore } from "@/store/useAppStore";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useAppStore();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center justify-center p-2 rounded-lg transition-all duration-200 bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] active:scale-95 cursor-pointer shadow-xs"
      title={`Beralih ke Mode ${theme === "dark" ? "Terang" : "Gelap"}`}
      aria-label="Toggle theme"
    >
      <Icon 
        icon={theme === "dark" ? "ph:sun-duotone" : "ph:moon-duotone"} 
        width="18" 
      />
    </button>
  );
}
