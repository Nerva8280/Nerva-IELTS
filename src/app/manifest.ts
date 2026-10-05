import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "IELTS Coach – Tự học tiếng Anh",
    short_name: "IELTS Coach",
    description: "Tự học tiếng Anh và IELTS 20–30 phút mỗi ngày",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7fb",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
