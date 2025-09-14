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
  if (!token) {
    console.log('🔍 [MIDDLEWARE] Sin token');
    return false;
  }
  try { 
    const result = await jwtVerify(token, secret);
    console.log('✅ [MIDDLEWARE] Token válido:', { 
      payload: result.payload,
      tokenLength: token.length 
    });
    return true; 
  } catch (error) { 
    console.log('❌ [MIDDLEWARE] Token inválido:', error instanceof Error ? error.message : 'Error desconocido');
    return false; 
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  console.log('🔍 [MIDDLEWARE] Procesando ruta:', pathname);

  const publicPaths = ["/login", "/api/login"];
  const isPublic =
    publicPaths.some(p => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (isPublic) {
    console.log('✅ [MIDDLEWARE] Ruta pública, permitiendo acceso');
    return NextResponse.next();
  }

  // Verificar JWT token desde Authorization header o cookie (fallback)
  let token = req.headers.get('authorization')?.replace('Bearer ', '');
  
  // Si no hay header Authorization, intentar cookie como fallback
  if (!token) {
    token = req.cookies.get("auth")?.value;
  }
  
  console.log('🔍 [MIDDLEWARE] Token encontrado:', { 
    fromHeader: !!req.headers.get('authorization'),
    fromCookie: !!req.cookies.get("auth")?.value,
    hasToken: !!token, 
    tokenLength: token?.length || 0 
  });
  
  if (!(await isValidToken(token))) {
    console.log('❌ [MIDDLEWARE] Token inválido, redirigiendo a login');
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  
  console.log('✅ [MIDDLEWARE] Token válido, permitiendo acceso');
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next|favicon.ico).*)"] };
