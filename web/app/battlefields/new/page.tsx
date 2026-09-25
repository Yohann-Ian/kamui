import { prisma } from "../../../lib/prisma";
import { createBattlefield, setArchived } from "../actions";
import BattlefieldForm from "../BattlefieldForm";
import { CardLabel } from "../../shell/ui";

export const dynamic = "force-dynamic";

export default async function NewBattlefield({
  searchParams,
}: {
  searchParams: Promise<{ fromWave?: string }>;
}) {
  const { fromWave } = await searchParams;
  const [archived, wave] = await Promise.all([
    prisma.battlefield.findMany({ where: { archived: true }, orderBy: { name: "asc" } }),
    fromWave ? prisma.searchWave.findUnique({ where: { id: fromWave } }) : null,
  ]);

  return (
    <section className="panel-scroll h-full overflow-y-auto px-6 pt-6 pb-8">
      <h1 className="font-display text-heading font-bold tracking-[-0.015em]">New Battlefield</h1>
      <p className="mt-1 text-item font-medium">
        {wave
          ? `Seeded from the Explore search "${wave.query}". Its ${wave.jobCount} ${
              wave.jobCount === 1 ? "job is" : "jobs are"
            } copied in when you create it, unranked. Nothing else runs.`
          : "Nothing runs when you create it. You choose when to search and when to rank."}
      </p>

      <div className="mt-5 flex max-w-[60rem] flex-col gap-4">
        <div className="glass-card px-5 py-[1.125rem]">
          <CardLabel className="pb-4">Search</CardLabel>
          <BattlefieldForm
            action={createBattlefield}
            submitLabel="Create Battlefield"
            hidden={wave ? { fromWave: wave.id } : {}}
            defaults={{
              name: wave ? wave.query.charAt(0).toUpperCase() + wave.query.slice(1) : "",
              titleIncludes: wave ? [wave.query] : [],
              titleExcludes: [],
              locations: wave?.locations.length ? wave.locations : ["United States"],
              maxBoards: 2000,
              maxJobs: 200,
              maxJobsPerBoard: 25,
            }}
          />
        </div>

        {archived.length > 0 ? (
          <div className="glass-card px-5 py-[1.125rem]">
            <CardLabel className="pb-2">Archived</CardLabel>
            <ul>
              {archived.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 rounded-row px-3 py-[0.5625rem]">
                  <span className="truncate text-item font-medium">{b.name}</span>
                  <form action={setArchived.bind(null, b.id, false)}>
                    <button className="text-meta font-semibold underline underline-offset-2">Restore</button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
