// Entry point of the Railway Auto-Populate cron service
// (railway/auto-populate-cron.json): asks the web service to start the daily
// searches for Battlefields with Auto-Populate on, then exits.
// Needs AUTO_POPULATE_URL (the web service's /api/battlefields/auto-populate URL)
// and CRON_SECRET.
const url = process.env.AUTO_POPULATE_URL;
const secret = process.env.CRON_SECRET;
if (!url || !secret) {
  console.error("AUTO_POPULATE_URL and CRON_SECRET must both be set");
  process.exit(1);
}

try {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(5 * 60 * 1000),
  });
  console.log(`auto-populate ${res.status}: ${await res.text()}`);
  process.exit(res.ok ? 0 : 1);
} catch (e) {
  console.error("auto-populate failed:", e);
  process.exit(1);
}
