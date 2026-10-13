"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Icon } from "@iconify/react";
import BottomNav from "./BottomNav";
import RefreshButton from "./RefreshButton";
import Sidebar from "./Sidebar";
import ThemeToggle from "./ThemeToggle";
import LogoutButton from "./LogoutButton";
import CacheLoadingOverlay from "@/components/ui/CacheLoadingOverlay";
import { useAppStore } from "@/store/useAppStore";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { activeTicker, sidebarOpen, setSidebarOpen } = useAppStore();
  const isAuthPage = pathname === "/login" || pathname === "/pending";

  const isHome = pathname === "/";
  const isSignal = pathname.includes("/signal");
  const isDetail = !isHome && !isSignal && !pathname.includes("/foreign") && !pathname.includes("/konglo") && !pathname.includes("/whales") && !pathname.includes("/backtest") && !pathname.includes("/nyangkut") && !pathname.includes("/admin");
  const isForeign = pathname.includes("/foreign");
  const isKonglo = pathname.includes("/konglo");
  const isWhales = pathname.includes("/whales");
  const isBacktest = pathname.includes("/backtest");
  const isNyangkut = pathname.includes("/nyangkut");

  const detailPath = `/${activeTicker || "BBCA"}`;

  const desktopNavLinkClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all duration-150 ${
      active
        ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] shadow-2xs font-bold"
        : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-high)]"
    }`;

  return (
    <>
      {/* GLOBAL CACHE LOADING TRANSPARENT OVERLAY */}
      <CacheLoadingOverlay />

      {/* GLOBAL TOP NAVIGATION */}
      <header className="sticky top-0 z-40 w-full border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)]/90 backdrop-blur-md transition-colors duration-200">
        <div className="flex items-center justify-between px-3 sm:px-6 h-14 max-w-7xl mx-auto">
          {/* LEFT: BRAND & SIDEBAR TRIGGER */}
          <div className="flex items-center gap-3">
            {!isAuthPage && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-1.5 rounded-lg bg-[var(--md-sys-color-surface-container-high)] hover:bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] transition-all cursor-pointer shadow-2xs"
                title="Buka Panel Parameter & Model"
                aria-label="Toggle Controls Panel"
              >
                <Icon icon="ph:sliders-horizontal-duotone" width="18" />
              </button>
            )}

            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 relative flex-shrink-0">
                <Image
                  src="/logo.png"
                  alt="Investowl Logo"
                  fill
                  sizes="28px"
                  className="object-contain"
                  priority
                />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-[var(--md-sys-color-on-surface)] group-hover:text-[var(--md-sys-color-primary)] transition-colors">
                  Investowl
                </span>
                <span className="hidden sm:inline-block text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-primary)] border border-[var(--md-sys-color-outline-variant)] uppercase tracking-wider">
                  Quant
                </span>
              </div>
            </Link>
          </div>

          {/* CENTER: DESKTOP NAVIGATION MENU */}
          {!isAuthPage && (
            <nav className="hidden md:flex items-center gap-1">
              <Link href="/" className={desktopNavLinkClass(isHome)}>
                <Icon icon={isHome ? "ph:house-fill" : "ph:house-duotone"} width="15" />
                <span>Home</span>
              </Link>
              <Link href={detailPath} className={desktopNavLinkClass(isDetail)}>
                <Icon icon={isDetail ? "ph:chart-line-up-fill" : "ph:chart-line-up-duotone"} width="15" />
                <span>Emiten</span>
              </Link>
              <Link href="/signal" className={desktopNavLinkClass(isSignal)}>
                <Icon icon={isSignal ? "ph:broadcast-fill" : "ph:broadcast-duotone"} width="15" />
                <span>Signal</span>
              </Link>
              <Link href="/foreign" className={desktopNavLinkClass(isForeign)}>
                <Icon icon={isForeign ? "ph:globe-stand-fill" : "ph:globe-stand-duotone"} width="15" />
                <span>Foreign</span>
              </Link>
              <Link href="/konglo" className={desktopNavLinkClass(isKonglo)}>
                <Icon icon={isKonglo ? "ph:buildings-fill" : "ph:buildings-duotone"} width="15" />
                <span>Konglo</span>
              </Link>
              <Link href="/whales" className={desktopNavLinkClass(isWhales)}>
                <Icon icon={isWhales ? "ph:fish-simple-fill" : "ph:fish-simple-duotone"} width="15" />
                <span>Whales</span>
              </Link>
              <Link href="/backtest" className={desktopNavLinkClass(isBacktest)}>
                <Icon icon={isBacktest ? "ph:chart-polar-fill" : "ph:chart-polar-duotone"} width="15" />
                <span>Backtest</span>
              </Link>
              <Link href="/nyangkut" className={desktopNavLinkClass(isNyangkut)}>
                <Icon icon={isNyangkut ? "ph:lifebuoy-fill" : "ph:lifebuoy-duotone"} width="15" />
                <span>Nyangkut</span>
              </Link>
            </nav>
          )}

          {/* RIGHT: ACTIONS & THEME */}
          <div className="flex items-center gap-2">
            {!isAuthPage && <RefreshButton />}
            <ThemeToggle />
            {!isAuthPage && <LogoutButton />}
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <div className="flex min-h-[calc(100vh-3.5rem)] pb-20 md:pb-8">
        {!isAuthPage && <Sidebar />}
        <div className="flex-1 min-w-0">{children}</div>
      </div>

      {/* MOBILE BOTTOM NAVIGATION */}
      {!isAuthPage && <BottomNav />}
    </>
  );
}
