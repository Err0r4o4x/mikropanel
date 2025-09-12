import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET() {
  const { data, error } = await supabaseAdmin.from('clientes').select('*').limit(1)
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true, data })
}
