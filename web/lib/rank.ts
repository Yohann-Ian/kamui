// Grades jobs against a Battlefield's active rubric. Port of worker/judge.py.
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma";
import { HttpError } from "./http";

const MODEL = "claude-haiku-4-5";
const CONCURRENCY = 5;

const client = new Anthropic();

type Verdict = { grade: string; score: number; reason: string; key_gap: string | null };

async function judgeOne(
  rubricBody: string,
  title: string,
  company: string,
  description: string | null
): Promise<Verdict> {
  const prompt = `${rubricBody}

Now grade this job.

COMPANY: ${company}
TITLE: ${title}
DESCRIPTION:
${description || "(no description available)"}

Return ONLY this JSON, nothing else:
{"grade": "Fit | Possible | Improbable | Unfit", "score": 0-100, "reason": "one sentence, 25 words max", "key_gap": "the single biggest gap, or null"}`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });
  const block = msg.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error(`no text in response (stop_reason ${msg.stop_reason})`);
  }
  let text = block.text.trim();
  // strip code fences if the model added them
  if (text.startsWith("```")) {
    text = text.split("```")[1].replace("json", "").trim();
  }
  return JSON.parse(text);
}

async function activeRubric(battlefieldId: string) {
  const rubric = await prisma.rubric.findFirst({ where: { battlefieldId, active: true } });
  if (!rubric) throw new HttpError(409, "This Battlefield has no active rubric");
  return rubric;
}

// Dismissed and closed jobs are never sent to the model.
const rankable = (battlefieldId: string) => ({ battlefieldId, dismissed: false, closed: false });

export async function rankPreview(battlefieldId: string) {
  const rubric = await activeRubric(battlefieldId);
  const [unranked, alreadyRanked] = await Promise.all([
    prisma.job.count({
      where: { ...rankable(battlefieldId), judgments: { none: { rubricId: rubric.id } } },
    }),
    prisma.job.count({
      where: { ...rankable(battlefieldId), judgments: { some: { rubricId: rubric.id } } },
    }),
  ]);
  return { unranked, alreadyRanked, rubricVersion: rubric.version };
}

// rerank=false grades only jobs with no judgment under the active rubric.
// rerank=true grades every rankable job, overwriting its judgment under that rubric.
// jobIds narrows the set (used by auto-rank to grade only a search's new arrivals).
export async function rankBattlefield(
  battlefieldId: string,
  { rerank = false, jobIds }: { rerank?: boolean; jobIds?: string[] } = {}
) {
  const rubric = await activeRubric(battlefieldId);
  const run = await prisma.run.create({ data: { battlefieldId, kind: "rank" } });

  try {
    const jobs = await prisma.job.findMany({
      where: {
        ...rankable(battlefieldId),
        ...(jobIds ? { id: { in: jobIds } } : {}),
        ...(rerank ? {} : { judgments: { none: { rubricId: rubric.id } } }),
      },
      select: { id: true, title: true, company: true, description: true },
    });

    let ranked = 0;
    const failures: string[] = [];
    const queue = [...jobs];

    async function worker() {
      for (let job = queue.shift(); job; job = queue.shift()) {
        try {
          const v = await judgeOne(rubric.body, job.title, job.company, job.description);
          const data = {
            grade: v.grade,
            score: Math.round(Number(v.score) || 0),
            reason: v.reason,
            keyGap: v.key_gap ?? null,
          };
          await prisma.judgment.upsert({
            where: { jobId_rubricId: { jobId: job.id, rubricId: rubric.id } },
            create: { jobId: job.id, rubricId: rubric.id, ...data },
            update: data,
          });
          ranked++;
        } catch (e) {
          failures.push(`${job.company} / ${job.title}: ${e instanceof Error ? e.message : e}`);
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    await prisma.run.update({
      where: { id: run.id },
      data: {
        status: "done",
        jobsFound: jobs.length,
        jobsRanked: ranked,
        error: failures.length ? `${failures.length} failed. First: ${failures[0]}` : null,
        finishedAt: new Date(),
      },
    });
    return { runId: run.id, rubricVersion: rubric.version, ranked, failed: failures.length };
  } catch (e) {
    await prisma.run.update({
      where: { id: run.id },
      data: { status: "failed", error: String(e), finishedAt: new Date() },
    });
    throw e;
  }
}
