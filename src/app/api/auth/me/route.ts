import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get("qore_session");
  if (!cookie) return NextResponse.json(null, { status: 401 });
  const [role, secret] = cookie.value.split(":");
  if (secret !== process.env.AUTH_SECRET) return NextResponse.json(null, { status: 401 });
  if (role !== "admin" && role !== "viewer") return NextResponse.json(null, { status: 401 });
  return NextResponse.json({ role });
}
