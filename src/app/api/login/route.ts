import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { SignJWT } from "jose";

console.log('🚀 [API/LOGIN] Iniciando ruta de login...');
console.log('🔍 [API/LOGIN] Variables de entorno:', {
  'JWT_SECRET': process.env.JWT_SECRET ? `${process.env.JWT_SECRET.substring(0, 10)}...` : 'NO DEFINIDA',
  'NODE_ENV': process.env.NODE_ENV,
  timestamp: new Date().toISOString()
});

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "mikropanel-fallback-secret");

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Usuario y contraseña requeridos" }, { status: 400 });
    }

    // Usar función de autenticación personalizada
    const { data, error } = await supabaseAdmin.rpc('authenticate_user', {
      p_username: username.toLowerCase().trim(),
      p_password: password
    });

    if (error) {
      console.error('Error en autenticación:', error);
      return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    const authResult = data[0];

    if (!authResult.success) {
      return NextResponse.json({ error: authResult.message || "Credenciales inválidas" }, { status: 401 });
    }

    // Crear JWT token
    const token = await new SignJWT({ 
      id: authResult.user_id,
      username: authResult.username, 
      role: authResult.role
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("8h")
      .sign(secret);

    const res = NextResponse.json({ 
      ok: true, 
      user: {
        id: authResult.user_id,
        username: authResult.username,
        role: authResult.role
      }
    });
    
    // Establecer cookie JWT
    res.cookies.set("auth", token, { 
      httpOnly: true, 
      path: "/", 
      sameSite: "lax",
      maxAge: 8 * 60 * 60 // 8 horas
    });
    
    return res;
  } catch (error) {
    console.error('Error en login:', error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
