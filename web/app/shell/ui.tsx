// Shared pieces of the design system (DESIGN-SYSTEM.md sections 3 and 5).
// All text is white; anything that recedes does so with opacity >= 0.8, size
// or weight, never a greyer colour.

import type { ReactNode } from "react";

export const btnPrimary =
  "rounded-btn bg-autumn-deep px-[1.125rem] py-2.5 text-button font-bold hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-80 disabled:hover:brightness-100";
export const btnSecondary =
  "rounded-btn border border-secondary-edge bg-secondary px-4 py-2.5 text-button font-semibold hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-80";
export const btnDashed =
  "rounded-btn border border-dashed border-dash px-4 py-2.5 text-item font-medium hover:bg-row-selected";
export const field = "glass-field px-2.5 py-1.5 text-item";

// The small uppercase label at the top of a card
export function CardLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`text-label font-semibold uppercase tracking-[0.1em] opacity-85 ${className}`}>
      {children}
    </div>
  );
}

const DOT: Record<string, string> = {
  Fit: "bg-grade-fit",
  Possible: "bg-grade-possible",
  Improbable: "bg-grade-improbable",
  Unfit: "bg-grade-unfit",
};

// Grade as a 10px solid dot: never a pill
export function GradeDot({ grade }: { grade: string | null }) {
  return (
    <span
      aria-hidden
      className={`size-2.5 shrink-0 rounded-full ${(grade && DOT[grade]) || "bg-grade-none"}`}
    />
  );
}

export function daysAgo(days: number) {
  if (days <= 0) return "today";
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function ordinal(n: number) {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}
