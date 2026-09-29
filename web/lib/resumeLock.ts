// The password lock on the Resumes section. Every resume page, route and action
// checks isResumesUnlocked() on the server.
//
// - The password starts as DEFAULT_PASSWORD. Changing it (only possible while
//   unlocked) stores a salted scrypt hash in AppSetting, which then overrides
//   the default.
// - Unlocking sets an HttpOnly cookie "<expiry>.<hmac>" signed with a random key
//   kept in AppSetting. The signature also covers the current password hash, so
//   changing the password signs every other device out.
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "./prisma";
import { HttpError } from "./http";

const DEFAULT_PASSWORD = "96%+5";
const COOKIE = "kamui_resumes";
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const HASH_KEY = "resumes.passwordHash";
const SIGNING_KEY = "resumes.signingKey";
export const MIN_PASSWORD_LENGTH = 5;

async function getSetting(key: string) {
  return (await prisma.appSetting.findUnique({ where: { key } }))?.value ?? null;
}

async function signingKey() {
  const existing = await getSetting(SIGNING_KEY);
  if (existing) return existing;
  const fresh = randomBytes(32).toString("hex");
  try {
    await prisma.appSetting.create({ data: { key: SIGNING_KEY, value: fresh } });
    return fresh;
  } catch {
    // another request created it first
    return (await getSetting(SIGNING_KEY))!;
  }
}

const same = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);
const digest = (s: string) => createHash("sha256").update(s).digest();

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}

async function checkPassword(password: string) {
  const stored = await getSetting(HASH_KEY);
  if (!stored) return same(digest(password), digest(DEFAULT_PASSWORD));
  const [, salt, hash] = stored.split(":");
  return same(scryptSync(password, salt, 32), Buffer.from(hash, "hex"));
}

async function sign(expiry: number) {
  const version = (await getSetting(HASH_KEY)) ?? "default";
  return createHmac("sha256", await signingKey()).update(`${expiry}.${version}`).digest("hex");
}

async function setSessionCookie() {
  const expiry = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  (await cookies()).set(COOKIE, `${expiry}.${await sign(expiry)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function isResumesUnlocked() {
  const value = (await cookies()).get(COOKIE)?.value;
  const [expiryText, mac] = value?.split(".") ?? [];
  const expiry = Number(expiryText);
  if (!mac || !Number.isFinite(expiry) || expiry < Date.now() / 1000) return false;
  return same(Buffer.from(mac, "hex"), Buffer.from(await sign(expiry), "hex"));
}

export async function requireResumesUnlocked() {
  if (!(await isResumesUnlocked())) throw new HttpError(401, "Resumes are locked");
}

// At most 10 wrong passwords per address per 15 minutes (one server, so an
// in-memory count is enough)
const failures = new Map<string, { count: number; since: number }>();
const WINDOW_MS = 15 * 60 * 1000;

async function clientAddress() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
}

export async function unlockResumes(password: string): Promise<string | null> {
  const address = await clientAddress();
  const entry = failures.get(address);
  if (entry && Date.now() - entry.since < WINDOW_MS && entry.count >= 10) {
    return "Too many wrong attempts. Try again in 15 minutes.";
  }
  if (!(await checkPassword(password))) {
    const fresh = !entry || Date.now() - entry.since >= WINDOW_MS;
    failures.set(address, { count: fresh ? 1 : entry!.count + 1, since: fresh ? Date.now() : entry!.since });
    return "That password is not right.";
  }
  failures.delete(address);
  await setSessionCookie();
  return null;
}

export async function lockResumes() {
  (await cookies()).delete(COOKIE);
}

// Only while unlocked. Re-issues this device's cookie; every other device's
// cookie stops matching and it is locked again.
export async function changeResumesPassword(password: string) {
  await requireResumesUnlocked();
  const value = hashPassword(password);
  await prisma.appSetting.upsert({ where: { key: HASH_KEY }, create: { key: HASH_KEY, value }, update: { value } });
  await setSessionCookie();
}
