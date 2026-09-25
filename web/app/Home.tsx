// The homepage (DESIGN-SYSTEM.md section 4): the kana banner, Welcome, how
// many new jobs are waiting, and one tile per Battlefield with exactly two
// numbers, new and applied.

import Link from "next/link";
import { btnDashed, btnSecondary } from "./shell/ui";

type Tile = {
  slug: string;
  name: string;
  fresh: number;
  applied: number;
  colour: string;
  searched: string;
};

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const count = (n: number) => WORDS[n] ?? String(n);

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <span className="block">
      <span className="block font-mono text-big leading-none font-semibold">{value}</span>
      <span className="mt-[0.4375rem] block text-label font-semibold tracking-[0.08em] uppercase opacity-80">
        {label}
      </span>
    </span>
  );
}

export default function Home({ tiles }: { tiles: Tile[] }) {
  const totalNew = tiles.reduce((sum, t) => sum + t.fresh, 0);

  return (
    <div className="panel-scroll flex h-full flex-col overflow-y-auto px-[3.75rem] pt-[4.375rem] pb-10">
      <div className="flex flex-col items-start">
        <span className="font-jp text-banner leading-none font-normal tracking-[0.14em]">カムイ</span>
        <span className="mt-[1.125rem] font-display text-mark font-bold tracking-[0.44em] uppercase">
          Kamui
        </span>
      </div>

      <h1 className="mt-[3.375rem] font-display text-welcome font-bold tracking-[-0.02em]">Welcome</h1>
      <p className="mt-3 text-sub font-medium">
        {tiles.length === 0 ? (
          "No Battlefields yet. Create one to start searching."
        ) : (
          <>
            {count(tiles.length)} {tiles.length === 1 ? "Battlefield" : "Battlefields"} in play.{" "}
            <span className="font-semibold text-autumn-bright">
              {totalNew} new {totalNew === 1 ? "job" : "jobs"}
            </span>{" "}
            since you last looked.
          </>
        )}
      </p>

      {tiles.length ? (
        <div className="mt-[2.375rem] grid grid-cols-3 gap-[1.125rem]">
          {tiles.map((t) => (
            <Link
              key={t.slug}
              href={`/battlefields/${t.slug}`}
              className={`block rounded-tile border border-tile-edge px-6 pt-[1.375rem] pb-5 hover:brightness-110 ${t.colour}`}
            >
              <span className="block truncate font-display text-sub font-semibold">{t.name}</span>
              <span className="mt-[1.625rem] flex items-end gap-[1.875rem]">
                <Figure value={t.fresh} label="new" />
                <Figure value={t.applied} label="applied" />
              </span>
              <span className="mt-[1.375rem] block border-t border-panel-edge pt-3.5 text-meta font-medium">
                {t.searched}
              </span>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="min-h-8 grow" />

      <div className="flex gap-3">
        <Link href="/explore" className={`${btnSecondary} px-5 py-3 text-item`}>
          Explore something new
        </Link>
        <Link href="/battlefields/new" className={`${btnDashed} px-5 py-3 font-semibold`}>
          + New Battlefield
        </Link>
      </div>
    </div>
  );
}
