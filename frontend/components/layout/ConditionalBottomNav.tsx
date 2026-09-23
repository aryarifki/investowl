"use client";

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";

export default function ConditionalBottomNav() {
  const pathname = usePathname();
  
  // Sembunyikan navigasi di halaman login dan pending
  if (pathname === "/login" || pathname === "/pending") return null;
  
  return <BottomNav />;
}
