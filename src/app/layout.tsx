import type { Metadata } from "next";
import { connection } from "next/server";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import { APP_NAME, APP_SUBTITLE } from "@/lib/config";

export const metadata: Metadata = {
  title: { default: `${APP_NAME} | ${APP_SUBTITLE}`, template: `%s | ${APP_NAME}` },
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Semua halaman dirender secara dinamik supaya nonce CSP dapat dipasang.
  await connection();
  return (
    <html lang="ms">
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
