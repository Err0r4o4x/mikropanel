import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { SignJWT } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Usuario y contraseña requeridos" }, { status: 400 });
    }

    // Autenticar usando la función de Supabase
    const { data, error } = await supabaseAdmin.rpc('authenticate_user', {
      p_username: username.toLowerCase().trim(),
      p_password: password
    });

    if (error) {
      console.error('Error en autenticación Supabase:', error);
      return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Error en autenticación" }, { status: 401 });
    }

    const authResult = data[0];

    if (!authResult.success) {
      return NextResponse.json({ error: authResult.message }, { status: 401 });
    }

    // Crear JWT token
    const token = await new SignJWT({ 
      username: authResult.username, 
      role: authResult.role,
      userId: authResult.user_id 
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("8h") // Extendido a 8 horas
      .sign(secret);

    const res = NextResponse.json({ 
      ok: true, 
      user: {
        username: authResult.username,
        role: authResult.role,
        userId: authResult.user_id
      }
    });
    
    res.cookies.set("auth", token, { 
      httpOnly: true, 
      path: "/", 
      sameSite: "lax",
      maxAge: 8 * 60 * 60 // 8 horas en segundos
    });
    
    return res;
  } catch (error) {
    console.error('Error en login:', error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
