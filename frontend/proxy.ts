import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Proteksi halaman admin hanya untuk akun dengan role admin
    if (path.startsWith("/admin")) {
      if (token?.role !== "admin") {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }

    // Redirect halaman pending ke home karena akses publik terbuka
    if (path === "/pending") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        // Hanya rute admin yang wajib login dan ber-role admin
        if (path.startsWith("/admin")) {
          return !!token && token.role === "admin";
        }
        // Semua rute lainnya terbuka untuk umum (guest) tanpa wajib login
        return true;
      },
    },
  }
);

export const config = {
  // Hanya jalankan middleware untuk proteksi admin dan redirect pending
  matcher: [
    "/admin/:path*",
    "/pending",
  ],
};
