"use client";

// The sidebar (DESIGN-SYSTEM.md section 4), on every screen. It fits the panel's
// height: the Battlefield list scrolls if there are many, but always keeps room
// for two. Frost is collapsible (collapsed by default) and compact when open,
// so short laptop screens give the space to the Battlefields. Only on unusually
// short windows with Frost open does the sidebar itself scroll.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { FROST, type FrostName } from "./frost";
import { setBackground, setFrost, setFrostOpen, useBackground, useFrost, useFrostOpen } from "./useShell";

export type SidebarBattlefield = { slug: string; name: string; unranked: number };

const FROST_LABELS: Record<FrostName, string> = { view: "View", strength: "Strength", focus: "Focus" };

function activeSlug(pathname: string, battlefieldParam: string | null) {
  const m = pathname.match(/^\/battlefields\/([^/]+)/);
  if (m && m[1] !== "new") return decodeURIComponent(m[1]);
  return battlefieldParam;
}

const navItem = "block rounded-btn px-[0.6875rem] py-[0.5625rem] text-item font-medium";

export default function Sidebar({
  battlefields,
  backgrounds,
}: {
  battlefields: SidebarBattlefield[];
  backgrounds: string[];
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = activeSlug(pathname, params.get("battlefield"));
  // Tracking and settings follow the Battlefield in view, else the first one
  const context = active ?? battlefields[0]?.slug ?? null;

  const frost = useFrost();
  const frostOpen = useFrostOpen();
  const background = useBackground(backgrounds);
  const bgIndex = background ? backgrounds.indexOf(background) : -1;

  const nav = [
    { href: "/explore", label: "Explore", current: pathname.startsWith("/explore") },
    {
      href: context ? `/tracking?battlefield=${context}` : "/tracking",
      label: "Tracking",
      current: pathname.startsWith("/tracking"),
    },
    { href: "/resumes", label: "Resumes", current: pathname.startsWith("/resumes") },
    {
      href: context ? `/battlefields/${context}/settings` : "/battlefields/new",
      label: "Battlefield settings",
      current: /^\/battlefields\/[^/]+\/settings/.test(pathname),
    },
  ];

  return (
    <nav
      aria-label="Main"
      className="panel-scroll flex w-sidebar shrink-0 flex-col overflow-y-auto border-r border-divider bg-sidebar py-6"
    >
      <Link href="/" className="flex shrink-0 items-baseline gap-2 px-5 pb-[1.625rem]">
        <span className="font-display text-wordmark font-bold tracking-[0.16em]">KAMUI</span>
        <span className="font-jp text-count font-medium">カムイ</span>
      </Link>

      <div className="shrink-0 px-5 pb-2.5 text-section font-semibold">Battlefields</div>
      <div className="panel-scroll flex min-h-[5.25rem] flex-col gap-0.5 overflow-y-auto px-2.5">
        {battlefields.map((b) => (
          <Link
            key={b.slug}
            href={`/battlefields/${b.slug}`}
            className={`flex items-center justify-between gap-2 rounded-btn border-l-2 px-[0.6875rem] py-[0.5625rem] ${
              b.slug === active ? "border-autumn-light bg-bf-active" : "border-transparent hover:bg-row-selected"
            }`}
          >
            <span className="truncate text-item font-medium">{b.name}</span>
            <span className="shrink-0 font-mono text-count" title="unranked jobs">
              {b.unranked}
            </span>
          </Link>
        ))}
      </div>

      <Link
        href="/battlefields/new"
        className="mx-5 mt-2.5 shrink-0 rounded-btn border border-dashed border-dash px-2.5 py-[0.4375rem] text-center text-item font-medium hover:bg-row-selected"
      >
        + New Battlefield
      </Link>

      <div className="mx-5 my-[1.375rem] h-px shrink-0 bg-divider" />

      <div className="flex shrink-0 flex-col gap-0.5 px-2.5">
        {nav.map((n) => (
          <Link
            key={n.label}
            href={n.href}
            className={`${navItem} ${n.current ? "bg-row-selected" : "hover:bg-row-selected"}`}
          >
            {n.label}
          </Link>
        ))}
      </div>

      <div className="min-h-3 grow" />

      <div className="shrink-0 px-5 pb-1">
        <button
          type="button"
          onClick={() => setFrostOpen(!frostOpen)}
          aria-expanded={frostOpen}
          className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between rounded-btn px-2 py-1.5 text-section font-semibold hover:bg-row-selected"
        >
          <span>Frost</span>
          <span aria-hidden className="text-count">{frostOpen ? "▾" : "▸"}</span>
        </button>
        {frostOpen ? (
          <div className="pt-1.5 pb-1.5">
            {(Object.keys(FROST) as FrostName[]).map((name, i) => (
              <div key={name} className={`flex items-center gap-2 ${i ? "pt-2.5" : ""}`}>
                <label htmlFor={`frost-${name}`} className="w-[3.75rem] shrink-0 text-label font-medium">
                  {FROST_LABELS[name]}
                </label>
                <input
                  id={`frost-${name}`}
                  type="range"
                  min={FROST[name].min}
                  max={FROST[name].max}
                  value={frost[name]}
                  onChange={(e) => setFrost(name, Number(e.target.value))}
                  className="min-w-0 flex-1"
                />
                <span className="w-6 shrink-0 text-right font-mono text-label text-frost">{frost[name]}</span>
              </div>
            ))}

            {backgrounds.length > 1 ? (
              <div className="flex items-center justify-between pt-2.5 text-label font-medium">
                <span>
                  Background{" "}
                  <span className="font-mono">
                    {bgIndex + 1}/{backgrounds.length}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setBackground(backgrounds[(bgIndex + 1) % backgrounds.length])}
                  className="rounded-btn border border-secondary-edge bg-secondary px-2.5 py-1 text-label font-semibold hover:bg-hover"
                  title="Next background photograph"
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
