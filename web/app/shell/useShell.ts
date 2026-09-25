"use client";

// Global Frost and background settings, persisted in localStorage so they
// survive reloads, navigation and closing the browser. Read through
// useSyncExternalStore, so the server render uses the defaults and the client
// switches to the stored values without a hydration mismatch. The CSS
// variables themselves were already applied before paint by bootScript.

import { useSyncExternalStore } from "react";
import {
  BACKGROUND_KEY,
  FROST,
  backgroundVar,
  clampFrost,
  frostVars,
  type FrostName,
  type FrostValues,
} from "./frost";

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const notify = () => listeners.forEach((fn) => fn());

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage blocked: the change still applies for this page view
  }
}

function readFrost(name: FrostName) {
  const stored = read(FROST[name].key);
  const n = stored === null ? NaN : Number(stored);
  return Number.isFinite(n) ? clampFrost(name, n) : FROST[name].fallback;
}

const DEFAULT_FROST = `${FROST.view.fallback}|${FROST.strength.fallback}|${FROST.focus.fallback}`;
const frostSnapshot = () => `${readFrost("view")}|${readFrost("strength")}|${readFrost("focus")}`;

export function useFrost(): FrostValues {
  const [view, strength, focus] = useSyncExternalStore(subscribe, frostSnapshot, () => DEFAULT_FROST)
    .split("|")
    .map(Number);
  return { view, strength, focus };
}

export function setFrost(name: FrostName, value: number) {
  write(FROST[name].key, String(clampFrost(name, value)));
  const vars = frostVars({ view: readFrost("view"), strength: readFrost("strength"), focus: readFrost("focus") });
  for (const [prop, v] of Object.entries(vars)) document.documentElement.style.setProperty(prop, v);
  notify();
}

// The stored background if it is still one of the files, else the first file.
export function useBackground(files: string[]) {
  const stored = useSyncExternalStore(subscribe, () => read(BACKGROUND_KEY), () => null);
  return stored && files.includes(stored) ? stored : files[0] ?? null;
}

export function setBackground(file: string) {
  write(BACKGROUND_KEY, file);
  document.documentElement.style.setProperty("--bg-image", backgroundVar(file));
  notify();
}
