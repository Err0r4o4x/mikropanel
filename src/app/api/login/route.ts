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
    console.log('🔍 [API/LOGIN] Procesando request de login...');
    
    const { username, password } = await req.json();
    console.log('🔍 [API/LOGIN] Datos recibidos:', { username: username?.toLowerCase()?.trim(), hasPassword: !!password });

    if (!username || !password) {
      console.log('❌ [API/LOGIN] Faltan credenciales');
      return NextResponse.json({ error: "Usuario y contraseña requeridos" }, { status: 400 });
    }

    console.log('🔍 [API/LOGIN] Llamando a authenticate_user...');
    // Usar función de autenticación personalizada
    const { data, error } = await supabaseAdmin.rpc('authenticate_user', {
      p_username: username.toLowerCase().trim(),
      p_password: password
    });

    console.log('🔍 [API/LOGIN] Respuesta de Supabase:', { 
      hasData: !!data, 
      dataLength: data?.length, 
      hasError: !!error,
      error: error?.message 
    });

    if (error) {
      console.error('❌ [API/LOGIN] Error en autenticación:', error);
      return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }

    if (!data || data.length === 0) {
      console.log('❌ [API/LOGIN] Sin datos de respuesta');
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    const authResult = data[0];
    console.log('🔍 [API/LOGIN] Resultado de autenticación:', {
      success: authResult.success,
      user_id: authResult.user_id,
      username: authResult.username,
      role: authResult.role,
      message: authResult.message
    });

    if (!authResult.success) {
      console.log('❌ [API/LOGIN] Autenticación fallida:', authResult.message);
      return NextResponse.json({ error: authResult.message || "Credenciales inválidas" }, { status: 401 });
    }

    console.log('🔍 [API/LOGIN] Creando JWT token...');
    // Crear JWT token
    const token = await new SignJWT({ 
      id: authResult.user_id,
      username: authResult.username, 
      role: authResult.role
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("8h")
      .sign(secret);

    console.log('✅ [API/LOGIN] JWT token creado, longitud:', token.length);

    const res = NextResponse.json({ 
      ok: true, 
      user: {
        id: authResult.user_id,
        username: authResult.username,
        role: authResult.role
      }
    });
    
    // Establecer cookie JWT
    const cookieOptions = {
      httpOnly: true, 
      path: "/", 
      sameSite: "lax" as const,
      maxAge: 8 * 60 * 60, // 8 horas
      secure: process.env.NODE_ENV === 'production' // Solo HTTPS en producción
    };
    
    console.log('🔍 [API/LOGIN] Configuración de cookie:', cookieOptions);
    res.cookies.set("auth", token, cookieOptions);
    
    console.log('✅ [API/LOGIN] Cookie establecida, enviando respuesta exitosa');
    return res;
  } catch (error) {
    console.error('❌ [API/LOGIN] Error crítico en login:', error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
