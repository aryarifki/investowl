import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "InvestOwl Quantitative Terminal",
    short_name: "InvestOwl",
    description: "Platform Analitik Bandarmologi & Smart Money Bursa Efek Indonesia",
    start_url: "/",
    display: "standalone",
    background_color: "#F9EDE1",
    theme_color: "#8C5000",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
