import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Script from "next/script";
import { NavLinks } from "@/components/NavLinks";
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
  // Resolve each page's canonical from its route (avoids duplicates across www and the old vercel.app domain)
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

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-40 border-b border-neutral-800/80 bg-neutral-950/70 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
            <Link
              href="/"
              className="mr-auto flex items-center gap-2 font-semibold tracking-tight"
            >
              {/* Columnar bars — the same motif as the favicon */}
              <svg
                viewBox="0 0 64 64"
                className="h-5 w-5"
                aria-hidden="true"
                focusable="false"
              >
                <rect x="6" y="14" width="11" height="42" rx="3" fill="#38bdf8" />
                <rect x="21" y="24" width="11" height="32" rx="3" fill="#7dd3fc" />
                <rect x="36" y="8" width="11" height="48" rx="3" fill="#0ea5e9" />
                <rect x="51" y="30" width="11" height="26" rx="3" fill="#bae6fd" />
              </svg>
              ParquetKit
            </Link>
            <NavLinks />
          </div>
        </header>
        {children}
        <footer className="border-t border-neutral-200 dark:border-neutral-800/80">
          <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-6 py-8 text-xs text-neutral-500">
            <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1">
              <Link href="/parquet-viewer" className="transition-colors hover:text-sky-400">
                Parquet Viewer
              </Link>
              <Link href="/sql" className="transition-colors hover:text-sky-400">
                SQL Workbench
              </Link>
              <Link href="/convert/parquet-to-csv" className="transition-colors hover:text-sky-400">
                Converters
              </Link>
              <Link href="/docs" className="transition-colors hover:text-sky-400">
                Guides
              </Link>
              <a
                href="https://github.com/XxxKMSxxX/parquetkit"
                rel="noopener"
                className="transition-colors hover:text-sky-400"
              >
                GitHub
              </a>
              <a
                href="https://github.com/sponsors/XxxKMSxxX"
                rel="noopener"
                className="transition-colors hover:text-sky-400"
              >
                Sponsor ♥
              </a>
            </nav>
            <p>
              ParquetKit — every tool runs locally in your browser. Your files
              never leave your device. Open source under the MIT license.
            </p>
          </div>
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
