"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigationItems = [
  ["Overview", "/"],
  ["Radar", "/radar/"],
  ["Research", "/research/"],
  ["API Health", "/health/"],
  ["Digests", "/digests/"],
  ["Sources", "/sources/"],
] as const;

export function Navigation() {
  const pathname = usePathname();
  return (
    <header className="border-b border-[var(--border)] bg-black/20 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
        <Link className="flex items-center gap-3" href="/">
          <span className="grid size-9 place-items-center rounded-lg border border-violet-400/40 bg-violet-400/10 font-semibold text-violet-200">
            N
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-wide">
              Noir AI Observatory
            </span>
            <span className="block text-xs text-[var(--muted)]">
              Live ecosystem dashboard · Phase 3
            </span>
          </span>
        </Link>

        <nav aria-label="Primary navigation" className="overflow-x-auto">
          <ul className="flex min-w-max items-center gap-1">
            {navigationItems.map(([label, href]) => (
              <li key={href}>
                <Link
                  aria-current={
                    href === "/"
                      ? pathname === "/"
                        ? "page"
                        : undefined
                      : pathname.endsWith(href.slice(0, -1)) ||
                          pathname.includes(href)
                        ? "page"
                        : undefined
                  }
                  className="block rounded-md px-3 py-2 text-sm text-[var(--muted)] transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 aria-[current=page]:bg-violet-400/10 aria-[current=page]:text-violet-200"
                  href={href}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
