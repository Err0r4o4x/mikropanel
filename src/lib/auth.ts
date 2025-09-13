import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "mikropanel-fallback-secret");

export async function getUserFromCookie() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth")?.value;

    if (!token) return null;

    const { payload } = await jwtVerify(token, secret);
    
    return {
      id: payload.id as string,
      username: payload.username as string,
      role: payload.role as string
    };
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    return null;
  }
}

export async function verifyAuth(req: Request) {
  try {
    // Obtener token del header Authorization o de cookies
    const authHeader = req.headers.get('Authorization');
    let token = authHeader?.replace('Bearer ', '');
    
    // Si no hay header, intentar obtener de cookies
    if (!token) {
      const cookieHeader = req.headers.get('Cookie');
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          acc[key] = value;
          return acc;
        }, {} as Record<string, string>);
        token = cookies.auth;
      }
    }

    if (!token) {
      return { valid: false, error: 'No token provided' };
    }

    const { payload } = await jwtVerify(token, secret);

    return {
      valid: true,
      payload: {
        id: payload.id as string,
        username: payload.username as string,
        role: payload.role as string
      }
    };
  } catch (error) {
    console.error('Error verificando autenticación:', error);
    return { valid: false, error: 'Authentication error' };
  }
}
