"use client";

import Link from "next/link";

export type BattlefieldLink = { slug: string; name: string };

export default function BattlefieldSwitch({
  battlefields,
  current,
  basePath,
}: {
  battlefields: BattlefieldLink[];
  current: string;
  basePath: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {battlefields.map((b) => (
        <Link
          key={b.slug}
          href={`${basePath}?battlefield=${b.slug}`}
          className={`rounded-md px-3 py-1 text-sm ${
            current === b.slug
              ? "bg-gray-900 text-white"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          {b.name}
        </Link>
      ))}
      <Link
        href="/battlefields/new"
        className="rounded-md px-2 py-1 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-900"
      >
        + New Battlefield
      </Link>
    </div>
  );
}
