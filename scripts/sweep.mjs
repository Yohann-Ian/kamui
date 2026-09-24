// Entry point of the Railway cron service (railway/sweep-cron.json): asks the
// web service to ingest every search whose Apify runs have finished, then exits.
// Needs SWEEP_URL (the web service's /api/runs/sweep URL) and CRON_SECRET.
const url = process.env.SWEEP_URL;
const secret = process.env.CRON_SECRET;
if (!url || !secret) {
  console.error("SWEEP_URL and CRON_SECRET must both be set");
  process.exit(1);
}

try {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(10 * 60 * 1000),
  });
  console.log(`sweep ${res.status}: ${await res.text()}`);
  process.exit(res.ok ? 0 : 1);
} catch (e) {
  console.error("sweep failed:", e);
  process.exit(1);
}
