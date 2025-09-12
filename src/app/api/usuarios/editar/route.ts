import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

type Body = {
  cliente_id: string
  tieneRouter?: boolean
  equipo_router_id?: string
  tieneSwitch?: boolean
  equipo_switch_id?: string
}

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as Body
    if (!b.cliente_id) {
      return NextResponse.json({ ok: false, error: 'cliente_id es requerido' }, { status: 400 })
    }

    // (Opcional) Actualizar flags del cliente si los manejas en esa tabla.
    // await supabaseAdmin.from('clientes').update({ ... }).eq('id', b.cliente_id)

    const inserts: any[] = []

    if (b.tieneRouter && b.equipo_router_id) {
      inserts.push({
        equipo_id: b.equipo_router_id,
        cliente_id: b.cliente_id,
        tipo: 'asignacion' as const,
        detalle: { via: 'editar_usuario', tipo: 'router' },
        created_by: 'misael',
      })
    }

    if (b.tieneSwitch && b.equipo_switch_id) {
      inserts.push({
        equipo_id: b.equipo_switch_id,
        cliente_id: b.cliente_id,
        tipo: 'asignacion' as const,
        detalle: { via: 'editar_usuario', tipo: 'switch' },
        created_by: 'misael',
      })
    }

    if (inserts.length > 0) {
      const { error } = await supabaseAdmin.from('movimientos').insert(inserts)
      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Error inesperado' }, { status: 500 })
  }
}
