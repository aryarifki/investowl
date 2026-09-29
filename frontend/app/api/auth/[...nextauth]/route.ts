import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, account, user }) {
      if (account && user) {
        try {
          const apiUrl = process.env.INTERNAL_BACKEND_URL || "http://127.0.0.1:8001";
          const res = await fetch(`${apiUrl}/api/users/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user.email,
              name: user.name,
              image: user.image,
              provider: account.provider,
            })
          });
          
          if (res.ok) {
            const data = await res.json();
            token.is_approved = data.is_approved;
            token.role = data.role;
            token.db_id = data.id;
          } else {
            token.is_approved = false;
          }
        } catch (e) {
          console.error("Gagal sinkronisasi user dengan backend:", e);
          token.is_approved = false;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).is_approved = token.is_approved;
        (session.user as any).role = token.role;
        (session.user as any).id = token.db_id;
      }
      return session;
    }
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 hari
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
