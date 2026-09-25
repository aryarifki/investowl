"use client";

import React from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { Icon } from "@iconify/react";

interface AdminUser {
  id: number;
  name?: string;
  email: string;
  role: string;
  is_approved: boolean;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AdminDashboard() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

  const { data: users = [], isLoading, mutate: refreshUsers } = useSWR<AdminUser[]>(
    isAdmin ? "/api/users/" : null,
    fetcher
  );

  const toggleApproval = async (id: number, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/users/${id}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_approved: !currentStatus }),
      });
      if (res.ok) {
        refreshUsers(); // Segarkan data setelah berhasil
      }
    } catch (e) {
      console.error("Gagal mengubah status", e);
    }
  };

  // Proteksi Halaman Khusus Admin
  if (!session || (session.user as { role?: string }).role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-[var(--md-sys-color-error)]">
        <Icon icon="ph:shield-warning-duotone" width="64" className="mb-4" />
        <h1 className="text-xl font-bold">Akses Ditolak</h1>
        <p className="text-sm">Halaman ini khusus untuk Administrator.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] flex items-center justify-center shadow-sm">
          <Icon icon="ph:users-three-duotone" width="28" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--md-sys-color-on-surface)] tracking-tight">User Management</h1>
          <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] mt-1">Kelola akses masuk Terminal InvestOwl.</p>
        </div>
      </div>

      <div className="bg-[var(--md-sys-color-surface-container)] rounded-[24px] border border-[var(--md-sys-color-outline-variant)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] text-sm">
                <th className="p-4 font-semibold whitespace-nowrap">Pengguna</th>
                <th className="p-4 font-semibold text-center whitespace-nowrap">Role</th>
                <th className="p-4 font-semibold text-center whitespace-nowrap">Status Akses</th>
                <th className="p-4 font-semibold text-right whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-[var(--md-sys-color-on-surface-variant)]">
                    <Icon icon="eos-icons:loading" width="24" className="mx-auto" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-[var(--md-sys-color-on-surface-variant)]">Belum ada pengguna terdaftar.</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors">
                    <td className="p-4">
                      <div className="flex flex-col">
                        <div className="font-semibold text-[var(--md-sys-color-on-surface)] whitespace-nowrap">{user.name || "Tanpa Nama"}</div>
                        <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] whitespace-nowrap">{user.email}</div>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${user.role === 'admin' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'}`}>
                        {user.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${user.is_approved ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                        <span className={`w-2 h-2 rounded-full ${user.is_approved ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                        {user.is_approved ? 'DISETUJUI' : 'PENDING'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {user.email !== session?.user?.email && (
                        <button
                          onClick={() => toggleApproval(user.id, user.is_approved)}
                          className={`px-4 py-2 rounded-full text-sm font-semibold transition-all active:scale-95 whitespace-nowrap ${
                            user.is_approved 
                              ? 'bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)] hover:bg-[var(--md-sys-color-error)] hover:text-[var(--md-sys-color-on-error)]' 
                              : 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] hover:opacity-90 shadow-sm'
                          }`}
                        >
                          {user.is_approved ? 'Cabut Akses' : 'Izinkan'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
