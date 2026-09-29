"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { Icon } from "@iconify/react";
import { usePathname } from "next/navigation";

export default function LogoutButton() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  // Sembunyikan di halaman otentikasi login/pending
  if (pathname === "/login" || pathname === "/pending") return null;

  if (status === "loading") {
    return (
      <button
        onClick={() => signIn("google", { callbackUrl: "/" })}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] border border-[var(--md-sys-color-outline-variant)]/60 text-xs font-semibold shadow-2xs cursor-pointer opacity-90"
        title="Masuk dengan Akun Google untuk menyimpan data Anda"
      >
        <Icon icon="logos:google-icon" width="15" />
        <span className="hidden sm:inline">Masuk</span>
      </button>
    );
  }

  // Jika user BELUM login: Tampilkan tombol Login Google
  if (!session) {
    return (
      <button
        onClick={() => signIn("google", { callbackUrl: "/" })}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--md-sys-color-primary-container)] hover:bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary-container)] hover:text-[var(--md-sys-color-on-primary)] border border-[var(--md-sys-color-outline-variant)]/60 text-xs font-semibold transition-all duration-150 shadow-2xs cursor-pointer active:scale-95"
        title="Masuk dengan Akun Google untuk menyimpan data Anda"
      >
        <Icon icon="logos:google-icon" width="15" />
        <span className="hidden sm:inline">Masuk</span>
      </button>
    );
  }

  // Jika user SUDAH login: Tampilkan info akun & tombol Logout
  const initial = session.user?.name ? session.user.name.charAt(0).toUpperCase() : "U";

  return (
    <div className="flex items-center gap-1.5 pl-1">
      {session.user?.image ? (
        <img
          src={session.user.image}
          alt={session.user.name || "Akun Google"}
          className="w-7 h-7 rounded-full object-cover border border-[var(--md-sys-color-outline-variant)]/60"
          referrerPolicy="no-referrer"
          title={`${session.user.name || session.user.email} (Tersinkronisasi)`}
        />
      ) : (
        <div
          className="w-7 h-7 rounded-full bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] flex items-center justify-center text-xs font-bold border border-[var(--md-sys-color-outline-variant)]/60"
          title={`${session.user?.name || session.user?.email} (Tersinkronisasi)`}
        >
          {initial}
        </div>
      )}

      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="p-1.5 rounded-full hover:bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface-variant)] hover:text-red-500 transition-colors duration-200 cursor-pointer"
        title="Keluar (Sign Out)"
        aria-label="Keluar dari akun"
      >
        <Icon icon="ph:sign-out-bold" width="18" />
      </button>
    </div>
  );
}
