import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROUTES = new Set(["/login"]);
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/health"];

function getRole(request: NextRequest): "admin" | "viewer" | null {
  const cookie = request.cookies.get("qore_session");
  if (!cookie) return null;
  try {
    const [role, secret] = cookie.value.split(":");
    if (secret !== process.env.AUTH_SECRET) return null;
    if (role === "admin" || role === "viewer") return role;
    return null;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.has(pathname)) return NextResponse.next();
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const role = getRole(request);
  if (!role) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/login", request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // Inject role header so server components can read it
  const res = NextResponse.next();
  res.headers.set("x-qore-role", role);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\..*).*)"],
};
