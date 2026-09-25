// Shared pieces of the design system (DESIGN-SYSTEM.md sections 3 and 5).
// All text is white; anything that recedes does so with opacity >= 0.8, size
// or weight, never a greyer colour.

import type { ReactNode } from "react";

export const btnPrimary =
  "rounded-btn bg-autumn-deep px-[1.125rem] py-2.5 text-button font-bold hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-80 disabled:hover:brightness-100";
export const btnSecondary =
  "rounded-btn border border-secondary-edge bg-secondary px-4 py-2.5 text-button font-semibold hover:bg-hover disabled:cursor-not-allowed disabled:opacity-80";
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

// "just now", "12 minutes ago", "2 hours ago", "yesterday", "5 days ago"
export function timeAgo(date: Date, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - date.getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return minutes === 1 ? "a minute ago" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
  return daysAgo(Math.floor(hours / 24));
}

// A coloured stat card: describes one selected thing, never a list
export function StatCard({
  label,
  value,
  sub,
  colour,
  mono = false,
  size = "text-big",
}: {
  label: string;
  value: ReactNode;
  sub: ReactNode;
  colour: string;
  mono?: boolean;
  size?: "text-big" | "text-grade" | "text-title";
}) {
  return (
    <div className={`flex w-stat shrink-0 flex-col rounded-card px-[1.0625rem] py-4 ${colour}`}>
      <CardLabel>{label}</CardLabel>
      <div
        className={`mt-1 ${size} leading-[1.1] font-semibold ${mono ? "font-mono" : ""} ${size === "text-big" ? "" : "mt-1.5"}`}
      >
        {value}
      </div>
      <div className="mt-1 text-label leading-snug font-medium opacity-85">{sub}</div>
    </div>
  );
}
