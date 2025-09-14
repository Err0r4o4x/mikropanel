import { NextResponse } from 'next/server'

type Body = {
  equipo_id: string
  cliente_id?: string
  tipo: 'alta'|'baja'|'asignacion'|'venta'|'devolucion'|'ajuste'
  detalle?: Record<string, unknown>
  monto_usd?: number
  created_by?: string
}

export async function POST(req: Request) {
  try {
    // Importación lazy para evitar problemas en build time
    const { supabaseAdmin } = await import('@/lib/supabase/server')
    
    const data = (await req.json()) as Body

    if (!data.equipo_id || !data.tipo) {
      return NextResponse.json({ ok: false, error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('movimientos').insert({
      equipo_id: data.equipo_id,
      cliente_id: data.cliente_id ?? null,
      tipo: data.tipo,
      detalle: data.detalle ?? {},
      monto_usd: data.monto_usd ?? null,
      created_by: data.created_by ?? 'system',
    })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message || 'Error inesperado' }, { status: 500 })
  }
}
