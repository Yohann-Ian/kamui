import Link from "next/link";
import { prisma } from "../../../lib/prisma";
import { createBattlefield, setArchived } from "../actions";
import BattlefieldForm from "../BattlefieldForm";

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
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
        &larr; Discovery
      </Link>
      <h1 className="mb-1 mt-3 text-xl font-medium">New Battlefield</h1>
      <p className="mb-6 text-sm text-gray-500">
        {wave
          ? `Seeded from the Explore search "${wave.query}". Its ${wave.jobCount} ${
              wave.jobCount === 1 ? "job is" : "jobs are"
            } copied in when you create it, unranked. Nothing else runs.`
          : "Nothing runs when you create it. You choose when to search and when to rank."}
      </p>

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

      {archived.length > 0 ? (
        <section className="mt-12 border-t border-gray-200 pt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Archived
          </h2>
          <ul className="space-y-1">
            {archived.map((b) => (
              <li key={b.id} className="flex items-center gap-3 text-sm">
                <span>{b.name}</span>
                <form action={setArchived.bind(null, b.id, false)}>
                  <button className="text-gray-500 underline hover:text-gray-900">Restore</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
