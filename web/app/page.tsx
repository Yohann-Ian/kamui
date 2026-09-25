import { redirect } from "next/navigation";
import { resolveBattlefield } from "../lib/battlefields";

export const dynamic = "force-dynamic";

// Temporary: sends / to a Battlefield's Discovery until the homepage exists.
// Old links of the form /?battlefield=<slug> keep working.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ battlefield?: string }>;
}) {
  const { current } = await resolveBattlefield((await searchParams).battlefield);
  redirect(current ? `/battlefields/${current.slug}` : "/battlefields/new");
}
