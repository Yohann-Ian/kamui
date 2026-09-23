"use client";

import Link from "next/link";

export const TRACKS = [
  { id: "ai-ml", label: "AI/ML Engineer" },
  { id: "b2b-content", label: "B2B Content" },
];

export default function BattlefieldSwitch({
  current,
  basePath,
}: {
  current: string;
  basePath: string;
}) {
  return (
    <div className="flex gap-1">
      {TRACKS.map((t) => (
        <Link
          key={t.id}
          href={`${basePath}?track=${t.id}`}
          className={`rounded-md px-3 py-1 text-sm ${
            current === t.id
              ? "bg-gray-900 text-white"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
