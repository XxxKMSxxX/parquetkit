"use client";

import { useEffect, useState } from "react";

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

/** Sticky "On this page" rail with scroll-position highlighting. */
export function Toc({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      // Treat the upper part of the viewport as the "current section" band
      { rootMargin: "-80px 0px -70% 0px" },
    );
    headings.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav aria-label="On this page" data-testid="toc" className="flex flex-col gap-2">
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
