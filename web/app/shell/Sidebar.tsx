"use client";

// The sidebar (DESIGN-SYSTEM.md section 4), on every screen. It always fits the
// panel's height: only the Battlefield list scrolls, and only if there are too
// many Battlefields to fit.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { FROST, type FrostName } from "./frost";
import { setBackground, setFrost, useBackground, useFrost } from "./useShell";

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
  const background = useBackground(backgrounds);
  const bgIndex = background ? backgrounds.indexOf(background) : -1;

  const nav = [
    { href: "/explore", label: "Explore", current: pathname.startsWith("/explore") },
    {
      href: context ? `/tracking?battlefield=${context}` : "/tracking",
      label: "Tracking",
      current: pathname.startsWith("/tracking"),
    },
    {
      href: context ? `/battlefields/${context}/settings` : "/battlefields/new",
      label: "Battlefield settings",
      current: /^\/battlefields\/[^/]+\/settings/.test(pathname),
    },
  ];

  return (
    <nav
      aria-label="Main"
      className="flex w-sidebar shrink-0 flex-col border-r border-divider bg-sidebar py-6"
    >
      <Link href="/" className="flex shrink-0 items-baseline gap-2 px-5 pb-[1.625rem]">
        <span className="font-display text-wordmark font-bold tracking-[0.16em]">KAMUI</span>
        <span className="font-jp text-count font-medium">カムイ</span>
      </Link>

      <div className="shrink-0 px-5 pb-2.5 text-section font-semibold">Battlefields</div>
      <div className="panel-scroll flex min-h-0 flex-col gap-0.5 overflow-y-auto px-2.5">
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

      <div className="min-h-4 grow" />

      <div className="shrink-0 px-5 pb-3.5">
        <div className="pb-5 text-section font-semibold">Frost</div>
        {(Object.keys(FROST) as FrostName[]).map((name, i) => (
          <div key={name} className={i ? "pt-[1.375rem]" : ""}>
            <label
              htmlFor={`frost-${name}`}
              className="flex items-baseline justify-between pb-2 text-label font-medium"
            >
              <span>{FROST_LABELS[name]}</span>
              <span className="font-mono text-label text-frost">{frost[name]}</span>
            </label>
            <input
              id={`frost-${name}`}
              type="range"
              min={FROST[name].min}
              max={FROST[name].max}
              value={frost[name]}
              onChange={(e) => setFrost(name, Number(e.target.value))}
              className="w-full"
            />
          </div>
        ))}

        {backgrounds.length > 1 ? (
          <div className="flex items-center justify-between pt-[1.375rem] text-label font-medium">
            <span>
              Background{" "}
              <span className="font-mono">
                {bgIndex + 1}/{backgrounds.length}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setBackground(backgrounds[(bgIndex + 1) % backgrounds.length])}
              className="rounded-btn border border-secondary-edge bg-secondary px-2.5 py-1 text-label font-semibold hover:bg-white/20"
              title="Next background photograph"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
