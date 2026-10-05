import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import AppShell from "@/components/AppShell";
import "./globals.css";

const font = Be_Vietnam_Pro({
  variable: "--font-main",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "IELTS Coach",
  description: "Tự học tiếng Anh và IELTS 20–30 phút mỗi ngày",
  appleWebApp: { capable: true, title: "IELTS Coach", statusBarStyle: "default" },
  icons: { icon: "/icons/192", apple: "/icons/180" },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${font.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
