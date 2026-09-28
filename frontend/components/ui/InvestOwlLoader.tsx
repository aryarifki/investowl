"use client";

import React from "react";
import { Icon } from "@iconify/react";

interface LoaderProps {
  title?: string;
  subtitle?: string;
  fullScreen?: boolean;
}

export default function InvestOwlLoader({
  title = "MEMUAT DATA",
  subtitle,
  fullScreen = false,
}: LoaderProps) {
  return (
    <div
      className={`flex items-center justify-center transition-colors duration-300 ${
        fullScreen
          ? "fixed inset-0 z-50 bg-[var(--md-sys-color-surface)] p-4"
          : "w-full py-10 px-4"
      }`}
    >
      <div className="p-8 border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] rounded-2xl flex items-center justify-center gap-3 text-[var(--md-sys-color-on-surface-variant)] shadow-sm animate-pulse max-w-md w-full">
        <Icon
          icon="ph:spinner-gap-bold"
          className="animate-spin text-[var(--md-sys-color-primary)] shrink-0"
          width="24"
          height="24"
        />
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-wide text-[var(--md-sys-color-on-surface)]">
            {title}
          </span>
          {subtitle && (
            <span className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-0.5">
              {subtitle}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
