// Locations: the search bar's location chips, how they become Apify runs, and
// which country a job is in. Safe to import from client and server code.

// The preset chips on a Battlefield's search bar. `id` is what is searched:
// "all" means no location filter, "remote" means remote-only, anything else is
// matched against the posting's location text.
export const PRESET_LOCATIONS = [
  { id: "all", label: "All Locations" },
  { id: "United States", label: "US" },
  { id: "United Kingdom", label: "UK" },
  { id: "Australia", label: "Australia" },
  { id: "Singapore", label: "Singapore" },
  { id: "Malaysia", label: "Malaysia" },
  { id: "remote", label: "Remote" },
] as const;

export type SearchTarget = { location: string; remoteOnly?: boolean };

// One Apify run per selected location. "all" (or nothing) is a single run with
// no location filter.
export function searchTargets(selected: string[]): SearchTarget[] {
  const clean = [...new Set(selected.map((s) => s.trim()).filter(Boolean))];
  if (clean.length === 0 || clean.includes("all")) return [{ location: "" }];
  return clean.map((id) => (id === "remote" ? { location: "", remoteOnly: true } : { location: id }));
}

// Country from the actor's own field when it has one, else from the location
// text ("San Mateo, CA United States", "London, UK", "Seattle, WA").
const US_STATES =
  "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";
const COUNTRY_PATTERNS: [string, RegExp][] = [
  ["United States", new RegExp(`\\b(united states|usa|u\\.s\\.a?\\.?)\\b|,\\s*(${US_STATES})\\b`, "i")],
  ["United Kingdom", /\b(united kingdom|uk|england|scotland|wales|northern ireland|london)\b/i],
  ["Australia", /\b(australia|sydney|melbourne|brisbane|perth|adelaide|canberra)\b/i],
  ["Singapore", /\bsingapore\b/i],
  ["Malaysia", /\b(malaysia|kuala lumpur|penang|selangor|johor)\b/i],
  ["India", /\b(india|bengaluru|bangalore|hyderabad|mumbai|pune|chennai|new delhi|gurugram|noida)\b/i],
  ["Canada", /\b(canada|toronto|vancouver|montreal|ottawa)\b/i],
  ["Ireland", /\b(ireland|dublin)\b/i],
  ["Germany", /\b(germany|berlin|munich|hamburg)\b/i],
  ["France", /\b(france|paris)\b/i],
  ["Netherlands", /\b(netherlands|amsterdam)\b/i],
  ["Japan", /\b(japan|tokyo)\b/i],
];

export function jobCountry(location: string | null, raw: unknown): string {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (typeof r.countryDerived === "string" && r.countryDerived.trim()) {
    const derived = r.countryDerived.trim();
    return /^united states/i.test(derived) ? "United States" : derived;
  }
  const text = location ?? "";
  for (const [country, pattern] of COUNTRY_PATTERNS) if (pattern.test(text)) return country;
  return "Unknown";
}

// Short names where the search bar has them ("US", "UK")
export function countryLabel(country: string) {
  return PRESET_LOCATIONS.find((p) => p.id === country)?.label ?? country;
}

// Chart colours for countries (DESIGN-SYSTEM.md, Stats). Fixed per country so a
// filter never repaints a country; every other country is grouped as Other.
// Validated with the dataviz palette checks against the dark glass surface.
export const CHART_COUNTRIES = ["United States", "United Kingdom", "Australia", "Singapore", "Malaysia"];
export const COUNTRY_COLOR: Record<string, string> = {
  "United States": "var(--color-chart-1)",
  "United Kingdom": "var(--color-chart-2)",
  Australia: "var(--color-chart-3)",
  Singapore: "var(--color-chart-4)",
  Malaysia: "var(--color-chart-5)",
  Other: "var(--color-grade-none)",
};
