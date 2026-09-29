"use client";

import { signIn } from "next-auth/react";
import { Icon } from "@iconify/react";
import Image from "next/image";

export default function LoginPage() {
  const handleWhatsApp = () => {
    window.open(
      "https://wa.me/6287882725845?text=Halo%20Admin,%20saya%20ingin%20request%20akses%20untuk%20The%20Investowl.",
      "_blank"
    );
  };

  return (
    <div className="min-h-[92vh] flex flex-col items-center justify-center p-4 relative">
      {/* Background Subtle Ambience */}
      <div className="absolute inset-0 bg-terminal-grid pointer-events-none opacity-40"></div>

      <div className="w-full max-w-lg flex flex-col gap-6 relative z-10 my-8">
        {/* KARTU UTAMA LOGIN */}
        <div className="bg-[var(--md-sys-color-surface-container)] rounded-3xl p-7 sm:p-9 shadow-md border border-[var(--md-sys-color-outline-variant)]/60 relative overflow-hidden backdrop-blur-xs">
          {/* Header Brand */}
          <div className="flex flex-col items-center text-center mb-8 mt-2">
            <div className="w-16 h-16 mb-4 relative drop-shadow-sm">
              <Image
                src="/logo.png"
                alt="The Investowl Logo"
                fill
                sizes="64px"
                className="object-contain"
                priority
              />
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] text-[10px] font-mono font-bold tracking-wider uppercase mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Quantitative Engine v2.0
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">
              Investowl Terminal
            </h1>
            <p className="text-xs sm:text-sm font-medium text-[var(--md-sys-color-on-surface-variant)] mt-1.5 max-w-sm">
              Sistem analitik bandarmologi dan arus modal institusi Bursa Efek Indonesia.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3.5">
            <button
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="w-full flex items-center justify-center gap-3 bg-[var(--md-sys-color-surface-container-high)] hover:bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface)] border border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-primary)] rounded-xl px-5 py-3.5 text-sm font-bold transition-all active:scale-[0.99] shadow-xs cursor-pointer"
            >
              <Icon icon="logos:google-icon" width="20" />
              <span>Masuk dengan Google</span>
            </button>

            <div className="flex items-center py-1">
              <div className="flex-grow border-t border-[var(--md-sys-color-outline-variant)]"></div>
              <span className="flex-shrink-0 mx-3 text-[10px] font-mono font-bold tracking-[0.2em] text-[var(--md-sys-color-on-surface-variant)] uppercase">
                Atau
              </span>
              <div className="flex-grow border-t border-[var(--md-sys-color-outline-variant)]"></div>
            </div>

            <button
              onClick={handleWhatsApp}
              className="w-full flex items-center justify-center gap-2.5 bg-[#0F766E] hover:bg-[#115E59] text-white rounded-xl px-5 py-3.5 text-sm font-bold transition-all active:scale-[0.99] shadow-xs cursor-pointer"
            >
              <Icon icon="ph:whatsapp-logo-fill" width="20" />
              <span>Request Akses Akun via WhatsApp</span>
            </button>
          </div>

          {/* PERBAIKAN TATA LETAK DISCLAIMER */}
          <div className="mt-8 pt-6 border-t border-[var(--md-sys-color-outline-variant)]">
            <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2 text-amber-500 font-semibold text-xs uppercase tracking-wider">
                <Icon icon="ph:shield-warning-duotone" width="16" />
                <span>Disclaimer Edukasi & Riset</span>
              </div>
              <p className="text-[11px] leading-relaxed text-[var(--md-sys-color-on-surface-variant)] text-justify">
                Platform ini dibangun untuk tujuan edukasi serta riset kuantitatif data science. Bukan merupakan saran atau rekomendasi investasi finansial. Klasifikasi perilaku partisipan (&quot;Smart Money&quot;, &quot;Retail&quot;, dsb.) adalah estimasi heuristik matematika berbasis pola data transaksi historis, bukan identitas kepemilikan resmi. Segala keputusan transaksi pasar modal sepenuhnya berada di bawah tanggung jawab pengguna.
              </p>
            </div>
          </div>
        </div>

        {/* FOOTER: COPYRIGHT & KONTAK AUTHOR */}
        <footer className="text-center space-y-2 py-2">
          <div className="flex items-center justify-center gap-4 text-xs font-medium text-[var(--md-sys-color-on-surface-variant)]">
            <a
              href="mailto:adryanrifky716@gmail.com"
              className="flex items-center gap-1.5 hover:text-[var(--md-sys-color-primary)] transition-colors"
            >
              <Icon icon="ph:envelope-simple-duotone" width="16" />
              <span>adryanrifky716@gmail.com</span>
            </a>
            <span className="opacity-30">•</span>
            <a
              href="https://www.instagram.com/rifqiaarya?stkn=dzl1d2RpczIyd2ts"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-pink-500 transition-colors"
            >
              <Icon icon="ph:instagram-logo-duotone" width="16" />
              <span>@rifqiaarya</span>
            </a>
          </div>

          <div className="text-[11px] font-mono text-[var(--md-sys-color-on-surface-variant)] opacity-80">
            copyright &copy; 2026 Adryan Rifky. All rights reserved.
          </div>
        </footer>
      </div>
    </div>
  );
}
