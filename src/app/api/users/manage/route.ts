import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyAuth } from "@/lib/auth";

// GET: Listar todos los usuarios (solo admin)
export async function GET(req: Request) {
  try {
    const authResult = await verifyAuth(req);
    if (!authResult.valid || (authResult.payload.role !== 'admin' && authResult.payload.role !== 'owner')) {
      return NextResponse.json({ error: "No autorizado - Solo administradores" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('auth_users')
      .select('id, username, role, active, created_at, last_login, login_attempts')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error obteniendo usuarios:', error);
      return NextResponse.json({ error: "Error obteniendo usuarios" }, { status: 500 });
    }

    return NextResponse.json({ users: data || [] });

  } catch (error) {
    console.error('Error en GET users:', error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// POST: Crear nuevo usuario (solo admin)
export async function POST(req: Request) {
  try {
    const authResult = await verifyAuth(req);
    if (!authResult.valid || (authResult.payload.role !== 'admin' && authResult.payload.role !== 'owner')) {
      return NextResponse.json({ error: "No autorizado - Solo administradores" }, { status: 403 });
    }

    const { username, password, role } = await req.json();

    if (!username || !password || !role) {
      return NextResponse.json({ 
        error: "Usuario, contraseña y rol requeridos" 
      }, { status: 400 });
    }

    // Validar rol
    const validRoles = ['owner', 'admin', 'tech', 'envios', 'viewer'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ 
        error: "Rol inválido. Debe ser: " + validRoles.join(', ')
      }, { status: 400 });
    }

    // Insertar nuevo usuario (la función crypt() hasheará la contraseña)
    const { data, error } = await supabaseAdmin
      .from('auth_users')
      .insert({
        username: username.toLowerCase().trim(),
        password_hash: `crypt('${password}', gen_salt('bf'))`,
        role: role,
        active: true
      })
      .select('id, username, role, active, created_at')
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: "El usuario ya existe" }, { status: 409 });
      }
      console.error('Error creando usuario:', error);
      return NextResponse.json({ error: "Error creando usuario" }, { status: 500 });
    }

    return NextResponse.json({ 
      ok: true, 
      message: "Usuario creado correctamente",
      user: data
    });

  } catch (error) {
    console.error('Error en POST users:', error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// PUT: Actualizar usuario (solo admin)
export async function PUT(req: Request) {
  try {
    const authResult = await verifyAuth(req);
    if (!authResult.valid || (authResult.payload.role !== 'admin' && authResult.payload.role !== 'owner')) {
      return NextResponse.json({ error: "No autorizado - Solo administradores" }, { status: 403 });
    }

    const { userId, role, active } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "ID de usuario requerido" }, { status: 400 });
    }

    const updates: any = { updated_at: new Date().toISOString() };
    
    if (role !== undefined) {
      const validRoles = ['owner', 'admin', 'tech', 'envios', 'viewer'];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ 
          error: "Rol inválido. Debe ser: " + validRoles.join(', ')
        }, { status: 400 });
      }
      updates.role = role;
    }

    if (active !== undefined) {
      updates.active = active;
    }

    const { data, error } = await supabaseAdmin
      .from('auth_users')
      .update(updates)
      .eq('id', userId)
      .select('id, username, role, active, updated_at')
      .single();

    if (error) {
      console.error('Error actualizando usuario:', error);
      return NextResponse.json({ error: "Error actualizando usuario" }, { status: 500 });
    }

    return NextResponse.json({ 
      ok: true, 
      message: "Usuario actualizado correctamente",
      user: data
    });

  } catch (error) {
    console.error('Error en PUT users:', error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
