"use client";

// The Resumes lock screen: a single password field.

import { useActionState } from "react";
import { unlockAction } from "./actions";
import { CardLabel, btnPrimary, field } from "../shell/ui";

export default function Lock() {
  const [state, action, pending] = useActionState(unlockAction, {});
  return (
    <section className="flex h-full flex-col px-6 pt-6">
      <h1 className="font-display text-heading font-bold tracking-[-0.015em]">Resumes</h1>
      <p className="mt-1 text-item font-medium">Locked. Enter the password to see your resumes.</p>
      <form action={action} className="glass-card mt-6 w-[22rem] px-5 py-[1.125rem]">
        <label htmlFor="password">
          <CardLabel className="pb-1.5">Password</CardLabel>
        </label>
        <input id="password" name="password" type="password" autoFocus autoComplete="current-password"
          className={`${field} w-full`} />
        <div className="mt-3 flex items-center gap-3">
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? "Checking..." : "Unlock"}
          </button>
          {state.error ? (
            <span className="text-meta font-semibold underline decoration-grade-unfit decoration-2 underline-offset-4">
              {state.error}
            </span>
          ) : null}
        </div>
      </form>
    </section>
  );
}
