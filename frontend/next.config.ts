import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN' 
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains' 
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff' 
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()' 
  },
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' data: https:; connect-src 'self' https://api.iconify.design;" 
  }
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    const backendUrl = process.env.INTERNAL_BACKEND_URL || "http://127.0.0.1:8001";
    return [
      {
        source: "/api/bandar/:path*",
        destination: `${backendUrl}/api/bandar/:path*`,
      },
      {
        source: "/api/broker-flow/:path*",
        destination: `${backendUrl}/api/broker-flow/:path*`,
      },
      {
        source: "/api/stocks/:path*",
        destination: `${backendUrl}/api/stocks/:path*`,
      },
      {
        source: "/api/foreign-flow/:path*",
        destination: `${backendUrl}/api/foreign-flow/:path*`,
      },
      {
        source: "/api/signal/:path*",
        destination: `${backendUrl}/api/signal/:path*`,
      },
      {
        source: "/api/logs/:path*",
        destination: `${backendUrl}/api/logs/:path*`,
      },
      {
        source: "/api/health",
        destination: `${backendUrl}/api/health`,
      },
      {
        source: "/api/users/:path*",
        destination: `${backendUrl}/api/users/:path*`,
      },
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
      {
        source: "/api/nyangkut/:path*",
        destination: `${backendUrl}/api/nyangkut/:path*`,
      },
      {
        source: "/api/forensic/:path*",
        destination: `${backendUrl}/api/forensic/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
