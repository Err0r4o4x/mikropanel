import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");

async function isValid(token?: string) {
  if (!token) return false;
  try { await jwtVerify(token, secret); return true; } catch { return false; }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const publicPaths = ["/login", "/api/login"];
  const isPublic =
    publicPaths.some(p => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (isPublic) return NextResponse.next();

  const token = req.cookies.get("auth")?.value;
  if (!(await isValid(token))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next|favicon.ico).*)"] };
