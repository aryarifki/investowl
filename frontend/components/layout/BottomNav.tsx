"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@iconify/react";
import { useAppStore } from "@/store/useAppStore";

export default function BottomNav() {
  const pathname = usePathname();
  const { activeTicker } = useAppStore();

  const isHome = pathname === "/";
  const isDashboard = !isHome && !pathname.includes("/foreign") && !pathname.includes("/konglo") && !pathname.includes("/signal") && !pathname.includes("/logs") && !pathname.includes("/admin");
  const isForeign = pathname.includes("/foreign");
  const isKonglo = pathname.includes("/konglo");
  const isSignal = pathname.includes("/signal");
  const isLogs = pathname.includes("/logs");

  const targetDashboardPath = `/${activeTicker || "BBCA"}`;

  const navItemClass = (active: boolean) =>
    `group flex flex-col items-center justify-center w-full h-full py-1 transition-all ${
      active
        ? "text-[var(--md-sys-color-primary)] font-bold"
        : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
    }`;

  const iconWrapper = (active: boolean) =>
    `flex items-center justify-center w-10 h-7 rounded-xl transition-all duration-200 ${
      active
        ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]"
        : "text-[var(--md-sys-color-on-surface-variant)] group-hover:text-[var(--md-sys-color-on-surface)]"
    }`;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-[var(--md-sys-color-surface-container)]/95 backdrop-blur-md border-t border-[var(--md-sys-color-outline-variant)] z-50 transition-colors duration-200">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        <Link href="/" className={navItemClass(isHome)}>
          <div className={iconWrapper(isHome)}>
            <Icon icon={isHome ? "ph:house-fill" : "ph:house-duotone"} width="20" />
          </div>
          <span className="text-[10px] mt-0.5 font-medium tracking-tight">Home</span>
        </Link>

        <Link href={targetDashboardPath} className={navItemClass(isDashboard)}>
          <div className={iconWrapper(isDashboard)}>
            <Icon icon={isDashboard ? "ph:chart-line-up-fill" : "ph:chart-line-up-duotone"} width="20" />
          </div>
          <span className="text-[10px] mt-0.5 font-medium tracking-tight">Detail</span>
        </Link>

        <Link href="/foreign" className={navItemClass(isForeign)}>
          <div className={iconWrapper(isForeign)}>
            <Icon icon={isForeign ? "ph:globe-stand-fill" : "ph:globe-stand-duotone"} width="20" />
          </div>
          <span className="text-[10px] mt-0.5 font-medium tracking-tight">Foreign</span>
        </Link>

        <Link href="/konglo" className={navItemClass(isKonglo)}>
          <div className={iconWrapper(isKonglo)}>
            <Icon icon={isKonglo ? "ph:buildings-fill" : "ph:buildings-duotone"} width="20" />
          </div>
          <span className="text-[10px] mt-0.5 font-medium tracking-tight">Konglo</span>
        </Link>

        <Link href="/signal" className={navItemClass(isSignal)}>
          <div className={iconWrapper(isSignal)}>
            <Icon icon={isSignal ? "ph:lightning-fill" : "ph:lightning-duotone"} width="20" />
          </div>
          <span className="text-[10px] mt-0.5 font-medium tracking-tight">Signal</span>
        </Link>

        <Link href="/logs" className={navItemClass(isLogs)}>
          <div className={iconWrapper(isLogs)}>
            <Icon icon={isLogs ? "ph:terminal-window-fill" : "ph:terminal-window-duotone"} width="20" />
          </div>
          <span className="text-[10px] mt-0.5 font-medium tracking-tight">Logs</span>
        </Link>
      </div>
    </nav>
  );
}
