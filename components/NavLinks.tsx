"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/parquet-viewer", label: "Viewer", prefix: "/parquet-viewer" },
  { href: "/sql", label: "SQL", prefix: "/sql" },
  { href: "/convert/parquet-to-csv", label: "Convert", prefix: "/convert" },
  { href: "/diff", label: "Diff", prefix: "/diff" },
  { href: "/docs", label: "Guides", prefix: "/docs" },
] as const;

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Tools"
      // On phones the nav is its own full-width row: spread the links like a
      // tab bar, with the first and last pill optically flush with the edges
      className="-mx-2 flex items-center justify-between text-sm text-neutral-600 sm:mx-0 sm:justify-start sm:gap-x-1 dark:text-neutral-400"
    >
      {links.map((link) => {
        const active =
          pathname === link.prefix || pathname.startsWith(`${link.prefix}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-2 py-1.5 transition-colors sm:px-2.5 ${
              active
                ? "bg-neutral-100 font-medium text-sky-600 dark:bg-neutral-800/80 dark:text-sky-400"
                : "hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-100"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
