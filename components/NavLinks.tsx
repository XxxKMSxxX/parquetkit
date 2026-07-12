"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/parquet-viewer", label: "Viewer", prefix: "/parquet-viewer" },
  { href: "/sql", label: "SQL", prefix: "/sql" },
  { href: "/convert/parquet-to-csv", label: "Convert", prefix: "/convert" },
  { href: "/docs", label: "Guides", prefix: "/docs" },
] as const;

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Tools"
      className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-neutral-600 dark:text-neutral-400"
    >
      {links.map((link) => {
        const active =
          pathname === link.prefix || pathname.startsWith(`${link.prefix}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-2.5 py-1.5 transition-colors ${
              active
                ? "bg-neutral-100 font-medium text-sky-600 dark:bg-neutral-800/80 dark:text-sky-400"
                : "hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-100"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
      <span
        aria-hidden="true"
        className="mx-2 h-4 w-px bg-neutral-200 dark:bg-neutral-800"
      />
      <a
        href="https://github.com/XxxKMSxxX/parquetkit"
        rel="noopener"
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-100"
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
    </nav>
  );
}
