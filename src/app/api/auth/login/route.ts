import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

interface AttemptRecord { count: number; lockedUntil?: number; }
const attempts = new Map<string, AttemptRecord>();

function getIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function checkLimit(ip: string): { ok: boolean; retryMs?: number } {
  const rec = attempts.get(ip);
  if (!rec) return { ok: true };
  if (rec.lockedUntil && Date.now() < rec.lockedUntil)
    return { ok: false, retryMs: rec.lockedUntil - Date.now() };
  return { ok: true };
}

function recordFail(ip: string) {
  const rec = attempts.get(ip) ?? { count: 0 };
  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS) rec.lockedUntil = Date.now() + LOCKOUT_MS;
  attempts.set(ip, rec);
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const { ok, retryMs } = checkLimit(ip);
  if (!ok) {
    return NextResponse.json(
      { success: false, error: "Too many attempts. Try again in 15 minutes." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((retryMs ?? LOCKOUT_MS) / 1000)) } }
    );
  }

  const { username, password } = await req.json();

  // Resolve role from env vars
  let role: "admin" | "viewer" | null = null;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    role = "admin";
  } else if (username === process.env.VIEWER1_USERNAME && password === process.env.VIEWER1_PASSWORD) {
    role = "viewer";
  } else if (username === process.env.VIEWER2_USERNAME && password === process.env.VIEWER2_PASSWORD) {
    role = "viewer";
  }

  if (!role) {
    recordFail(ip);
    return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
  }

  attempts.delete(ip);

  const res = NextResponse.json({ success: true, role });
  res.cookies.set("qore_session", `${role}:${process.env.AUTH_SECRET}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 8, // 8 hours
    path: "/",
  });
  return res;
}
