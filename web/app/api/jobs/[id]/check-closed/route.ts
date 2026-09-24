import { prisma } from "@/lib/prisma";
import { HttpError, errorResponse } from "@/lib/http";

// Phrases job boards show on a posting that has been taken down.
const CLOSED_TEXT = [
  /no longer accepting applications/i,
  /(job|position|posting|role) (is )?no longer (available|open|active)/i,
  /(job|position|posting|role) has (been )?(filled|closed|expired)/i,
  /this job (posting )?has expired/i,
];

// Checks one job's posting URL and marks the job closed if it is gone.
// On demand only (when the user opens a job), never in bulk. It only ever sets
// closed; a failed or inconclusive check changes nothing.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const job = await prisma.job.findUnique({ where: { id: (await params).id } });
    if (!job) throw new HttpError(404, "No such job");

    let res: Response;
    try {
      res = await fetch(job.url, {
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; KAMUI job check)" },
      });
    } catch (e) {
      return Response.json({ closed: job.closed, checked: false, reason: `fetch failed: ${e}` });
    }

    let reason: string | null = null;
    if ([400, 404, 410].includes(res.status)) {
      // SmartRecruiters answers a dead posting with 400
      reason = `HTTP ${res.status}`;
    } else if (
      res.redirected &&
      job.url.includes(job.atsJobId) &&
      !res.url.includes(job.atsJobId)
    ) {
      // Greenhouse (and company career sites in front of it) redirect a dead
      // posting to a general listing page that no longer carries the job id
      reason = `redirected to ${res.url}`;
    } else if (res.ok) {
      const text = await res.text();
      const hit = CLOSED_TEXT.find((re) => re.test(text));
      if (hit) reason = `page says "${text.match(hit)![0]}"`;
    }

    if (!reason) {
      return Response.json({ closed: job.closed, checked: true, status: res.status });
    }
    const updated = job.closed
      ? job
      : await prisma.job.update({
          where: { id: job.id },
          data: { closed: true, closedAt: new Date() },
        });
    return Response.json({ closed: true, closedAt: updated.closedAt, checked: true, reason });
  } catch (e) {
    return errorResponse(e);
  }
}
