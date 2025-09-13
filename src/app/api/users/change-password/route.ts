import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyAuth } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    // Verificar autenticación
    const authResult = await verifyAuth(req);
    if (!authResult.valid) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ 
        error: "Contraseña actual y nueva contraseña requeridas" 
      }, { status: 400 });
    }

    if (newPassword.length < 4) {
      return NextResponse.json({ 
        error: "La nueva contraseña debe tener al menos 4 caracteres" 
      }, { status: 400 });
    }

    // Cambiar contraseña usando la función de Supabase
    const { data, error } = await supabaseAdmin.rpc('change_password', {
      p_username: authResult.payload.username,
      p_old_password: currentPassword,
      p_new_password: newPassword
    });

    if (error) {
      console.error('Error cambiando contraseña:', error);
      return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Error al cambiar contraseña" }, { status: 500 });
    }

    const result = data[0];

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ 
      ok: true, 
      message: "Contraseña actualizada correctamente" 
    });

  } catch (error) {
    console.error('Error en change-password:', error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
