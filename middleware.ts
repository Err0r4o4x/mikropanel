import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

console.log('🚀 [MIDDLEWARE] Iniciando middleware...');
console.log('🔍 [MIDDLEWARE] Variables de entorno:', {
  'JWT_SECRET': process.env.JWT_SECRET ? `${process.env.JWT_SECRET.substring(0, 10)}...` : 'NO DEFINIDA',
  'NODE_ENV': process.env.NODE_ENV,
  timestamp: new Date().toISOString()
});

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "mikropanel-fallback-secret");

async function isValidToken(token?: string) {
  if (!token) return false;
  try { 
    await jwtVerify(token, secret); 
    return true; 
  } catch { 
    return false; 
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const publicPaths = ["/login", "/api/login"];
  const isPublic =
    publicPaths.some(p => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (isPublic) return NextResponse.next();

  // Verificar JWT token
  const token = req.cookies.get("auth")?.value;
  
  if (!(await isValidToken(token))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next|favicon.ico).*)"] };
