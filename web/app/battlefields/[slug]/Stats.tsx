"use client";

// Stats: the lower half of the selected column (DESIGN-SYSTEM.md, Stats). A
// hollow donut of this Battlefield's jobs with a legend of found and applied.
// All countries: one slice per country. One country: one slice per grade.
// The grade filter narrows both; it starts at Fit to Possible.

import { useState } from "react";
import { CardLabel } from "../../shell/ui";
import { CHART_COUNTRIES, COUNTRY_COLOR, countryLabel } from "../../../lib/locations";

export type StatRow = { country: string; grade: string | null; applied: boolean };

const GRADE_FILTERS = [
  { id: "all", label: "All categories", grades: null },
  { id: "fit", label: "Fit", grades: ["Fit"] },
  { id: "fit-possible", label: "Fit to Possible", grades: ["Fit", "Possible"] },
  { id: "fit-improbable", label: "Fit to Improbable", grades: ["Fit", "Possible", "Improbable"] },
  { id: "improbable", label: "Improbable", grades: ["Improbable"] },
  { id: "unfit", label: "Unfit", grades: ["Unfit"] },
] as const;

const GRADES = ["Fit", "Possible", "Improbable", "Unfit"];
const GRADE_COLOR: Record<string, string> = {
  Fit: "var(--color-grade-fit)",
  Possible: "var(--color-grade-possible)",
  Improbable: "var(--color-grade-improbable)",
  Unfit: "var(--color-grade-unfit)",
  Unranked: "var(--color-grade-none)",
};

type Slice = { key: string; label: string; color: string; found: number; applied: number };

function tally(rows: StatRow[], keyOf: (r: StatRow) => string) {
  const map = new Map<string, { found: number; applied: number }>();
  for (const r of rows) {
    const t = map.get(keyOf(r)) ?? { found: 0, applied: 0 };
    t.found += 1;
    if (r.applied) t.applied += 1;
    map.set(keyOf(r), t);
  }
  return map;
}

// Countries keep a fixed colour; anything outside the five chart countries is
// folded into Other so the ring never has more than six slices.
function countrySlices(rows: StatRow[]): Slice[] {
  const counts = tally(rows, (r) => (CHART_COUNTRIES.includes(r.country) ? r.country : "Other"));
  // When Other is a single country, name it
  const others = new Set(rows.map((r) => r.country).filter((c) => !CHART_COUNTRIES.includes(c)));
  const otherLabel = others.size === 1 ? [...others][0] : "Other";
  return [...CHART_COUNTRIES, "Other"]
    .filter((c) => counts.has(c))
    .map((c) => ({ key: c, label: c === "Other" ? otherLabel : countryLabel(c), color: COUNTRY_COLOR[c], ...counts.get(c)! }));
}

function gradeSlices(rows: StatRow[]): Slice[] {
  const counts = tally(rows, (r) => r.grade ?? "Unranked");
  return [...GRADES, "Unranked"]
    .filter((g) => counts.has(g))
    .map((g) => ({ key: g, label: g, color: GRADE_COLOR[g], ...counts.get(g)! }));
}

const R = 38; // ring radius in the 100 x 100 viewBox
const C = 2 * Math.PI * R;
const GAP = 1.4; // about 2px of surface between slices at the card's size

function Donut({
  slices,
  total,
  active,
  onHover,
}: {
  slices: Slice[];
  total: number;
  active: string | null;
  onHover: (key: string | null) => void;
}) {
  const gap = slices.length > 1 ? GAP : 0;
  const lengths = slices.map((s) => (s.found / total) * C);
  const arcs = slices.map((s, i) => {
    const start = lengths.slice(0, i).reduce((a, b) => a + b, 0);
    return { ...s, dash: Math.max(lengths[i] - gap, 0.1), offset: start + gap / 2 };
  });
  // The ring, or a copy of it for the glow layers (wider, no pointer events)
  const ring = (width: number, glow: boolean) =>
    arcs.map((a) => (
      <circle
        key={a.key}
        cx="50"
        cy="50"
        r={R}
        fill="none"
        strokeWidth={width}
        strokeDasharray={`${a.dash} ${C - a.dash}`}
        strokeDashoffset={-a.offset}
        pointerEvents={glow ? "none" : undefined}
        style={{
          stroke: a.color,
          opacity: active && active !== a.key ? (glow ? 0.1 : 0.35) : 1,
          transition: "opacity 150ms",
        }}
        onMouseEnter={glow ? undefined : () => onHover(a.key)}
        onMouseLeave={glow ? undefined : () => onHover(null)}
      />
    ));

  return (
    <svg viewBox="0 0 100 100" className="size-full overflow-visible" role="img" aria-label="Jobs donut chart">
      <defs>
        {/* a soft bloom and a tight neon edge, each in the slices' own colours */}
        <filter id="donut-bloom" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="donut-edge" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
      </defs>
      <g transform="rotate(-90 50 50)">
        {/* the track, so an empty chart still reads as a ring */}
        <circle cx="50" cy="50" r={R} fill="none" strokeWidth="8" style={{ stroke: "var(--color-row-selected)" }} />
        {total > 0 ? (
          <>
            <g filter="url(#donut-bloom)" className="donut-glow">
              {ring(14, true)}
            </g>
            <g filter="url(#donut-edge)" opacity="0.9">
              {ring(10, true)}
            </g>
            <g>{ring(8, false)}</g>
          </>
        ) : null}
      </g>
    </svg>
  );
}

export default function Stats({ rows }: { rows: StatRow[] }) {
  const [filter, setFilter] = useState<(typeof GRADE_FILTERS)[number]["id"]>("fit-possible");
  const [country, setCountry] = useState("all");
  const [hover, setHover] = useState<string | null>(null);

  const grades = GRADE_FILTERS.find((f) => f.id === filter)!.grades as readonly string[] | null;
  const byGrade = rows.filter((r) => !grades || (r.grade !== null && grades.includes(r.grade)));
  const inScope = country === "all" ? byGrade : byGrade.filter((r) => r.country === country);
  const slices = country === "all" ? countrySlices(inScope) : gradeSlices(inScope);

  const found = inScope.length;
  const applied = inScope.filter((r) => r.applied).length;
  const hovered = slices.find((s) => s.key === hover) ?? null;

  // Countries with any job in this Battlefield, most jobs first
  const countries = [...tally(rows, (r) => r.country)]
    .filter(([c]) => c !== "Unknown")
    .sort((a, b) => b[1].found - a[1].found)
    .map(([c]) => c);

  const select = "glass-field min-w-0 px-1.5 py-0.5 text-meta font-medium";

  return (
    <div className="glass-card flex min-h-0 min-w-0 flex-1 basis-0 flex-col px-5 py-[1.125rem]">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
        <CardLabel className="mr-auto">Stats</CardLabel>
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Grades" className={select}>
          {GRADE_FILTERS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country" className={select}>
          <option value="all">All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {countryLabel(c)}
            </option>
          ))}
        </select>
      </div>

      {/* a container, so a narrow card drops the legend's applied column (the
          centre readout still gives applied, for the total or a hovered slice) */}
      <div className="@container mt-3 flex min-h-0 flex-1 items-center gap-3">
        <div className="relative aspect-square h-full max-h-[10.5rem] min-h-[5.5rem] max-w-[38%] shrink-0">
          <Donut slices={slices} total={found} active={hover} onHover={setHover} />
          {/* centre readout: the total, or the slice under the pointer */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-mono text-title leading-none font-semibold tabular-nums">
              {hovered ? hovered.found : found}
            </span>
            <span className="mt-1 max-w-[70%] truncate text-label font-semibold uppercase tracking-[0.1em] opacity-85">
              {hovered ? hovered.label : "found"}
            </span>
            <span className="mt-0.5 text-label font-medium opacity-85 tabular-nums">
              {hovered ? hovered.applied : applied} applied
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1 self-center">
          {slices.length === 0 ? (
            <p className="text-meta leading-[1.45] font-medium">
              {rows.length === 0
                ? "No jobs yet. Search New fills this in."
                : grades
                  ? "No graded jobs match this filter. Rank to grade them."
                  : "No jobs in this country."}
            </p>
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 text-meta font-medium tabular-nums @min-[18rem]:grid-cols-[minmax(0,1fr)_auto_auto]">
              <span />
              <span className="text-right text-label font-semibold opacity-85">found</span>
              <span className="hidden text-right text-label font-semibold opacity-85 @min-[18rem]:block">applied</span>
              {slices.map((s) => (
                <div
                  key={s.key}
                  onMouseEnter={() => setHover(s.key)}
                  onMouseLeave={() => setHover(null)}
                  className={`contents ${hover && hover !== s.key ? "[&>*]:opacity-80" : ""}`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="truncate">{s.label}</span>
                  </span>
                  <span className="text-right font-mono">{s.found}</span>
                  <span className="hidden text-right font-mono @min-[18rem]:block">{s.applied}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
