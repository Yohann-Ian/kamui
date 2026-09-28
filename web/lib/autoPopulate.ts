// Auto-Populate: once a day a Railway cron calls POST /api/battlefields/auto-populate,
// which starts a search for every Battlefield with autoPopulate on. It spends
// money with nobody watching, so each Battlefield passes these guards first:
//   1. no search of its own is running or ingesting (never stack searches);
//   2. no search, manual or automatic, started in the last 20 hours;
//   3. it claims lastAutoRunAt atomically, so two fires at the same moment
//      cannot both start one.
// It only starts the search; the sweep saves the results as usual.
import { prisma } from "./prisma";
import { ACTIVE, startBattlefieldSearch } from "./searchRuns";

const MIN_GAP_MS = 20 * 60 * 60 * 1000;

export type AutoPopulateResult =
  | { battlefield: string; status: "started"; runId: string }
  | { battlefield: string; status: "skipped"; reason: string }
  | { battlefield: string; status: "failed"; error: string };

function ago(d: Date) {
  const minutes = Math.floor((Date.now() - d.getTime()) / 60_000);
  return minutes < 60 ? `${minutes} minutes ago` : `${Math.floor(minutes / 60)} hours ago`;
}

export async function autoPopulateAll(): Promise<AutoPopulateResult[]> {
  const battlefields = await prisma.battlefield.findMany({
    where: { autoPopulate: true, archived: false },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
  });

  const results: AutoPopulateResult[] = [];
  for (const b of battlefields) {
    try {
      const active = await prisma.run.findFirst({
        where: { battlefieldId: b.id, kind: "search", status: { in: ACTIVE } },
        select: { id: true },
      });
      if (active) {
        results.push({ battlefield: b.slug, status: "skipped", reason: "a search is already running" });
        continue;
      }

      const cutoff = new Date(Date.now() - MIN_GAP_MS);
      const recent = await prisma.run.findFirst({
        where: { battlefieldId: b.id, kind: "search", startedAt: { gt: cutoff } },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true },
      });
      if (recent) {
        results.push({
          battlefield: b.slug,
          status: "skipped",
          reason: `searched ${ago(recent.startedAt)}, within the last 20 hours`,
        });
        continue;
      }

      // Claim: only one caller can move lastAutoRunAt forward inside the window
      const now = new Date();
      const claimed = await prisma.battlefield.updateMany({
        where: {
          id: b.id,
          OR: [{ lastAutoRunAt: null }, { lastAutoRunAt: { lt: cutoff } }],
        },
        data: { lastAutoRunAt: now },
      });
      if (claimed.count === 0) {
        results.push({
          battlefield: b.slug,
          status: "skipped",
          reason: "another Auto-Populate call claimed it within the last 20 hours",
        });
        continue;
      }

      try {
        const { run } = await startBattlefieldSearch(b);
        results.push({ battlefield: b.slug, status: "started", runId: run.id });
      } catch (e) {
        // Nothing fired, so give the claim back (only if it is still ours)
        await prisma.battlefield.updateMany({
          where: { id: b.id, lastAutoRunAt: now },
          data: { lastAutoRunAt: b.lastAutoRunAt },
        });
        throw e;
      }
    } catch (e) {
      results.push({
        battlefield: b.slug,
        status: "failed",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return results;
}
