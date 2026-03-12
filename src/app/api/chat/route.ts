import { NextRequest, NextResponse } from "next/server";

// Bridge runs on Windows host at port 18790 (HTTP → openclaw CLI)
const BRIDGE = process.env.OPENCLAW_BRIDGE ?? "http://host.docker.internal:18790";

function getRole(req: NextRequest): "admin" | "viewer" | null {
  const cookie = req.cookies.get("qore_session");
  if (!cookie) return null;
  const [role, secret] = cookie.value.split(":");
  if (secret !== process.env.AUTH_SECRET) return null;
  return role === "admin" || role === "viewer" ? (role as "admin" | "viewer") : null;
}

export async function POST(req: NextRequest) {
  const role = getRole(req);
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const message: string = body.message ?? "";
    const agentId: string = body.agentId ?? "main";

    if (!message.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const upstream = await fetch(`${BRIDGE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, agentId }),
      // Long timeout — agent can take up to ~3 minutes
      signal: AbortSignal.timeout(200_000),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(
        { error: data.error ?? `Bridge error: ${upstream.status}` },
        { status: upstream.status }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const friendly =
      msg.includes("ECONNREFUSED") || msg.includes("fetch failed")
        ? "Could not reach QORE chat bridge. Make sure chat_bridge.py is running on the host."
        : `Chat error: ${msg}`;
    return NextResponse.json({ error: friendly }, { status: 503 });
  }
}
