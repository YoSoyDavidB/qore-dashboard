import { NextRequest, NextResponse } from "next/server";

const GATEWAY = process.env.OPENCLAW_GATEWAY ?? "http://localhost:18789";

function getRole(req: NextRequest): "admin" | "viewer" | null {
  const cookie = req.cookies.get("qore_session");
  if (!cookie) return null;
  const [role, secret] = cookie.value.split(":");
  if (secret !== process.env.AUTH_SECRET) return null;
  return role === "admin" || role === "viewer" ? role as "admin" | "viewer" : null;
}

export async function POST(req: NextRequest) {
  const role = getRole(req);
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const upstream = await fetch(`${GATEWAY}/api/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: body.message, agent: "main" }),
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `OpenClaw gateway error: ${upstream.status}` },
        { status: 502 }
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Could not reach OpenClaw gateway. Is it running?" },
      { status: 503 }
    );
  }
}
