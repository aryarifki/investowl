"use client";
import { useState, ReactNode } from "react";

export default function Tabs({ labels, children }: { labels: string[]; children: ReactNode[] }) {
  const [active, setActive] = useState(0);
  return (
    <div>
      <div className="flex gap-1 border-b border-[var(--line)] overflow-x-auto">
        {labels.map((l, i) => (
          <button
            key={l}
            onClick={() => setActive(i)}
            className={`px-3 py-2 text-[0.78rem] font-semibold whitespace-nowrap border-b-2 transition-colors ${
              active === i
                ? "border-[var(--blue)] text-[var(--strong)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="fade-in pt-3">{children[active]}</div>
    </div>
  );
}
