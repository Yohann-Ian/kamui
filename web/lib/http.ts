import { timingSafeEqual } from "node:crypto";

// An error that carries the HTTP status an API route should answer with.
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  console.error(e);
  const message = e instanceof Error ? e.message : String(e);
  return Response.json({ error: message }, { status: 500 });
}

// POST bodies are optional on some routes; a missing or invalid body reads as {}.
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

// Cron-only routes require "Authorization: Bearer <CRON_SECRET>". With
// CRON_SECRET unset, every call is refused.
export function isCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
