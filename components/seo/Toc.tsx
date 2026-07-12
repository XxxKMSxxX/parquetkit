"use client";

import { useEffect, useState } from "react";

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

/** Sticky "On this page" rail with scroll-position highlighting. */
export function Toc({ items, testId = "toc" }: { items: TocItem[]; testId?: string }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    const update = () => {
      const line = 96; // reading line just below the sticky header
      const doc = document.documentElement;
      const maxScroll = doc.scrollHeight - window.innerHeight;
      const scrollY = window.scrollY;
      const tops = headings.map((el) => el.getBoundingClientRect().top + scrollY);

      // Headings in the last screenful can never rise above the reading line.
      // Spread the remaining scroll distance evenly across them so the
      // highlight still walks through every section and ends on the last one.
      const firstStuck = tops.findIndex((top) => top - line > maxScroll);
      if (firstStuck !== -1) {
        const zoneStart = firstStuck === 0 ? 0 : tops[firstStuck - 1] - line;
        const zone = maxScroll - zoneStart;
        if (zone > 0 && scrollY >= zoneStart) {
          const stuckCount = tops.length - firstStuck;
          const steps = Math.floor(((scrollY - zoneStart) / zone) * (stuckCount + 1));
          const idx = Math.min(firstStuck - 1 + steps, tops.length - 1);
          setActiveId(idx >= 0 ? headings[idx].id : null);
          return;
        }
      }

      // The last heading above the reading line is the current section
      let current: string | null = null;
      for (let i = 0; i < tops.length; i++) {
        if (tops[i] <= scrollY + line) current = headings[i].id;
        else break;
      }
      setActiveId(current);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav aria-label="On this page" data-testid={testId} className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
        On this page
      </p>
      <ul className="flex flex-col gap-1.5 border-l border-neutral-200 text-sm dark:border-neutral-800">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={`-ml-px block border-l py-0.5 transition-colors ${
                item.level === 3 ? "pl-7" : "pl-4"
              } ${
                activeId === item.id
                  ? "border-sky-500 text-sky-600 dark:border-sky-400 dark:text-sky-400"
                  : "border-transparent text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              }`}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
