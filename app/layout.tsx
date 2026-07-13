import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Script from "next/script";
import { SiteHeader } from "@/components/SiteHeader";
import { version } from "../package.json";
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
    types: {
      "application/rss+xml": "/feed.xml",
    },
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
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-sky-600 focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <SiteHeader />
        {children}
        <footer className="border-t border-neutral-200 dark:border-neutral-800/80">
          <div className="mx-auto w-full max-w-[1800px] px-6 py-12">
            <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
              <div className="flex max-w-md flex-col gap-3">
                <p className="flex items-center gap-2 font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                  <svg
                    viewBox="0 0 64 64"
                    className="h-5 w-5"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <g transform="translate(32,32) rotate(45)">
                      <rect x="-21" y="-21" width="19" height="19" rx="3.5" fill="#7dd3fc" />
                      <rect x="2" y="-21" width="19" height="19" rx="3.5" fill="#38bdf8" />
                      <rect x="-21" y="2" width="19" height="19" rx="3.5" fill="#0ea5e9" />
                      <rect x="2" y="2" width="19" height="19" rx="3.5" fill="#0369a1" />
                    </g>
                  </svg>
                  <span>
                    Parquet<span className="text-sky-600 dark:text-sky-400">Kit</span>
                  </span>
                </p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Every tool runs locally in your browser. Your files never
                  leave your device — there is no server to send them to.
                </p>
              </div>
              <nav
                aria-label="Footer"
                className="grid grid-cols-2 gap-x-16 gap-y-2 text-sm sm:gap-x-24"
              >
                <div className="flex flex-col gap-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    Tools
                  </p>
                  <Link href="/parquet-viewer" className="text-neutral-600 transition-colors hover:text-sky-600 dark:text-neutral-400 dark:hover:text-sky-400">
                    Parquet Viewer
                  </Link>
                  <Link href="/sql" className="text-neutral-600 transition-colors hover:text-sky-600 dark:text-neutral-400 dark:hover:text-sky-400">
                    SQL Workbench
                  </Link>
                  <Link href="/convert/parquet-to-csv" className="text-neutral-600 transition-colors hover:text-sky-600 dark:text-neutral-400 dark:hover:text-sky-400">
                    Converters
                  </Link>
                </div>
                <div className="flex flex-col gap-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    Resources
                  </p>
                  <Link href="/docs" className="text-neutral-600 transition-colors hover:text-sky-600 dark:text-neutral-400 dark:hover:text-sky-400">
                    Guides
                  </Link>
                  <a href="/feed.xml" className="text-neutral-600 transition-colors hover:text-sky-600 dark:text-neutral-400 dark:hover:text-sky-400">
                    RSS feed
                  </a>
                  <a
                    href="https://github.com/XxxKMSxxX/parquetkit"
                    rel="noopener"
                    className="text-neutral-600 transition-colors hover:text-sky-600 dark:text-neutral-400 dark:hover:text-sky-400"
                  >
                    GitHub
                  </a>
                  <a
                    href="https://github.com/sponsors/XxxKMSxxX"
                    rel="noopener"
                    className="text-neutral-600 transition-colors hover:text-sky-600 dark:text-neutral-400 dark:hover:text-sky-400"
                  >
                    Sponsor ♥
                  </a>
                  <a
                    href="mailto:contact@parquetkit.com"
                    className="text-neutral-600 transition-colors hover:text-sky-600 dark:text-neutral-400 dark:hover:text-sky-400"
                  >
                    Contact
                  </a>
                </div>
              </nav>
            </div>
            <div className="mt-10 flex flex-col gap-2 border-t border-neutral-200 pt-6 text-xs text-neutral-400 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 dark:border-neutral-800/80">
              <p>MIT © 2026 ParquetKit</p>
              <p>
                Built with{" "}
                <a
                  href="https://github.com/hyparam/hyparquet"
                  rel="noopener"
                  className="underline decoration-neutral-700 transition-colors hover:text-sky-600 dark:hover:text-sky-400"
                >
                  hyparquet
                </a>{" "}
                &amp;{" "}
                <a
                  href="https://duckdb.org/docs/api/wasm/overview"
                  rel="noopener"
                  className="underline decoration-neutral-700 transition-colors hover:text-sky-600 dark:hover:text-sky-400"
                >
                  DuckDB-WASM
                </a>
              </p>
              <a
                href="https://github.com/XxxKMSxxX/parquetkit/releases"
                rel="noopener"
                className="font-mono transition-colors hover:text-sky-600 sm:ml-auto dark:hover:text-sky-400"
              >
                v{version}
              </a>
              <p className="w-full text-[11px]">
                Apache Parquet is a trademark of the Apache Software
                Foundation. ParquetKit is an independent project, not
                affiliated with or endorsed by the ASF.
              </p>
            </div>
          </div>
        </footer>
        {/* Cloudflare Web Analytics: cookieless page-view beacon (the token is
            public by design — it only identifies the site, not an account) */}
        <Script
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "9e2ab6392b8c4253982c56efd5e1ed8a"}'
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
