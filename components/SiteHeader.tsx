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
      <div className="mx-auto flex w-full max-w-[1800px] items-center gap-x-3 px-6 py-3 sm:gap-x-6">
        <Link
          href="/"
          className="group mr-auto flex items-center gap-2 font-semibold tracking-tight"
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
          {/* The wordmark yields to the nav on phone widths */}
          <span className="hidden sm:inline">
            Parquet<span className="text-sky-400">Kit</span>
          </span>
        </Link>
        <NavLinks />
      </div>
    </header>
  );
}
