// @MB-FETCH registrarRouterPagado
export async function registrarRouterPagado(equipoId: string, clienteId: string, monto = 140) {
  const res = await fetch('/api/inventario/movimiento', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      equipo_id: equipoId,
      cliente_id: clienteId,
      tipo: 'venta',
      detalle: { router_pagado: true, concepto: 'Router pagado' },
      monto_usd: monto,
      created_by: 'misael',
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error creando movimiento')
  return data
}

// @MB-FETCH editarUsuarioAsignaciones
export async function editarUsuarioAsignaciones(params: {
  cliente_id: string
  tieneRouter?: boolean
  equipo_router_id?: string
  tieneSwitch?: boolean
  equipo_switch_id?: string
}) {
  const res = await fetch('/api/usuarios/editar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error editando usuario')
  return data
}
