"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NavLinks } from "@/components/NavLinks";

/**
 * Sticky header that hides while scrolling down and reappears on the first
 * scroll up, so it never eats reading space (a single row of it is a third of
 * a phone screen's height).
 */
export function SiteHeader() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      // Hysteresis: trackpads emit sub-pixel scrolls that would flicker
      if (Math.abs(delta) < 8) return;
      setHidden(y > 80 && delta > 0);
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b border-neutral-800/80 bg-neutral-950/70 backdrop-blur transition-transform duration-300 motion-reduce:transition-none ${
        hidden ? "-translate-y-full focus-within:translate-y-0" : ""
      }`}
    >
      {/* Phones get a deliberate two-row layout: brand left + GitHub right on
          the first row, the nav spread across the full second row */}
      <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center gap-y-2 px-6 py-3">
        <Link
          href="/"
          className="group order-1 mr-auto flex items-center gap-2 font-semibold tracking-tight"
        >
          {/* Parquet block mark — the same motif as the favicon */}
          <svg
            viewBox="0 0 64 64"
            className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90 motion-reduce:transition-none"
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
            Parquet<span className="text-sky-400">Kit</span>
          </span>
        </Link>
        <div className="order-3 w-full sm:order-2 sm:ml-auto sm:w-auto">
          <NavLinks />
        </div>
        <span
          aria-hidden="true"
          className="order-4 mx-2 hidden h-4 w-px bg-neutral-200 sm:block dark:bg-neutral-800"
        />
        <a
          href="https://github.com/XxxKMSxxX/parquetkit"
          rel="noopener"
          className="order-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-neutral-600 transition-colors sm:order-5 sm:px-2.5 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-100"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4 fill-current"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
          GitHub
        </a>
      </div>
    </header>
  );
}
