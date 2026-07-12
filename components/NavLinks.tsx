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
      className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-neutral-600 dark:text-neutral-400"
    >
      {links.map((link) => {
        const active =
          pathname === link.prefix || pathname.startsWith(`${link.prefix}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "font-medium text-sky-600 dark:text-sky-400"
                : "transition-colors hover:text-sky-600 dark:hover:text-sky-400"
            }
          >
            {link.label}
          </Link>
        );
      })}
      <a
        href="https://github.com/XxxKMSxxX/parquetkit"
        rel="noopener"
        className="transition-colors hover:text-sky-600 dark:hover:text-sky-400"
      >
        GitHub
      </a>
    </nav>
  );
}
