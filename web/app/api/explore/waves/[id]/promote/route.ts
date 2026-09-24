import { prisma } from "@/lib/prisma";
import { getBattlefield } from "@/lib/jobs";
import { uniqueSlug } from "@/lib/battlefields";
import { HttpError, errorResponse, readJson } from "@/lib/http";
import { copyWaveJobs } from "@/lib/waves";

const strings = (v: unknown) =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim() !== "") : undefined;
const int = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : undefined);

// Body: { battlefieldId } or { newBattlefield: { name, titleIncludes?, titleExcludes?,
// locations?, maxBoards?, maxJobs?, maxJobsPerBoard? } }.
// Copies the wave's jobs into that Battlefield (see copyWaveJobs). Nothing is ranked.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const wave = await prisma.searchWave.findUnique({
      where: { id: (await params).id },
    });
    if (!wave) throw new HttpError(404, "No such search wave");

    const body = await readJson(request);
    let battlefield;
    if (typeof body.battlefieldId === "string") {
      battlefield = await getBattlefield(body.battlefieldId);
    } else if (body.newBattlefield && typeof body.newBattlefield === "object") {
      const nb = body.newBattlefield as Record<string, unknown>;
      const name = typeof nb.name === "string" ? nb.name.trim() : "";
      if (!name) throw new HttpError(400, "newBattlefield.name is required");
      battlefield = await prisma.battlefield.create({
        data: {
          name,
          slug: await uniqueSlug(name),
          titleIncludes: strings(nb.titleIncludes) ?? [wave.query],
          titleExcludes: strings(nb.titleExcludes) ?? [],
          locations: strings(nb.locations) ?? wave.locations,
          maxBoards: int(nb.maxBoards),
          maxJobs: int(nb.maxJobs),
          maxJobsPerBoard: int(nb.maxJobsPerBoard),
        },
      });
    } else {
      throw new HttpError(400, "Send battlefieldId or newBattlefield");
    }

    const { copied, skipped } = await copyWaveJobs(wave.id, battlefield.id);
    return Response.json({ battlefield, copied, skipped });
  } catch (e) {
    return errorResponse(e);
  }
}
