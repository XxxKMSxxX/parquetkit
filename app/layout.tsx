import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  // 各ページの正規URLを現在のルートで解決(www/旧vercel.appドメインとの重複対策)
  alternates: {
    canonical: "./",
  },
  title: {
    default: "ParquetKit — View, Query & Convert Parquet Files in Your Browser",
    template: "%s | ParquetKit",
  },
  description:
    "Free online Parquet viewer, SQL workbench and converter. Everything runs locally in your browser — your files never leave your device.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <footer className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-2 px-6 py-8 text-xs text-neutral-500">
          <p>
            ParquetKit — every tool runs locally in your browser. Your files
            never leave your device.
          </p>
          <a
            href="https://github.com/XxxKMSxxX/parquetkit"
            rel="noopener"
            className="underline"
          >
            Open source on GitHub
          </a>
        </footer>
        {/* Cloudflare Web Analytics: cookieless page-view beacon (the token is
            public by design — it only identifies the site, not an account) */}
        <Script
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "9e2ab6392b8c4253982c56efd5e1ed8a"}'
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
