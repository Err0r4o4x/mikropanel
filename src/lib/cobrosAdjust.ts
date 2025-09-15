// src/lib/cobrosAdjust.ts
// @MB-COBROS-ADJUSTS — helpers para sincronizar Gastos ⇄ Cobros (ajustes)

/* ======================= Tipos ======================= */
export type Gasto = {
  id: string;
  fechaISO: string;
  motivo: string;
  montoUSD: number;
  usuario: string;
};

export type AjusteCobro = {
  id: string;
  yyyymm: string; // YYYY-MM
  amount: number; // negativo para gasto, positivo para ventas/altas
  label: string;  // Ej: "Gasto: ..." / "Prorrateo alta: ..."
  createdISO: string;
  actor?: string;
  meta?: { type?: "gasto" | "venta"; gastoId?: string; movId?: string; carryPrevOn7?: boolean };
};

export type ClienteAlta = {
  id: string;
  nombre: string;
  zona: string;     // ZonaId
  servicio: number; // Mb
};

/* ======================= Constantes ======================= */
// const LS_GASTOS = "app_gastos";
// const LS_AJUSTES = "app_cobros_ajustes";

/* ======================= Utils ======================= */
function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* ======================= Storage helpers ======================= */
function readAjustes(): AjusteCobro[] {
  // Ya no usamos localStorage - los datos vienen de Supabase
  return [];
}

function writeAjustes(list: AjusteCobro[]) {
  // Ya no guardamos en localStorage - los datos se guardan en Supabase
  console.log("Guardando ajustes:", list);
}

/* ======================= Gastos → Ajustes negativos ======================= */

/** Crea (o reemplaza) el ajuste negativo asociado a un gasto concreto. */
export function recordExpenseAdjustment(g: Gasto) {
  const ajustes = readAjustes();
  const mk = monthKey(new Date(g.fechaISO));
  const id = `gasto-${g.id}`;

  // Quita si existía (evita duplicados)
  const filtered = ajustes.filter((a) => a.id !== id);

  filtered.push({
    id,
    yyyymm: mk,
    amount: -Math.abs(Number(g.montoUSD) || 0),
    label: `Gasto: ${g.motivo}`,
    createdISO: g.fechaISO,
    actor: g.usuario,
    meta: { type: "gasto", gastoId: g.id, carryPrevOn7: true },
  });

  writeAjustes(filtered);
}

/** Elimina el ajuste vinculado a un gasto (si existe). */
export function removeExpenseAdjustment(gastoId: string) {
  const ajustes = readAjustes();
  const next = ajustes.filter(
    (a) => !(a.meta?.type === "gasto" && a.meta?.gastoId === gastoId)
  );
  writeAjustes(next);
}

/**
 * Asegura que todos los gastos tengan su ajuste negativo y limpia huérfanos.
 * Úsalo al entrar a Cobros por si faltara sincronización.
 */
export function reconcileExpenseAdjustments() {
  // Ya no usamos localStorage - los datos vienen de Supabase
  const gastos: Gasto[] = [];

  const ajustes = readAjustes();

  // Índice rápido de ajustes existentes por gastoId
  const byGasto = new Map<string, AjusteCobro>();
  for (const a of ajustes) {
    if (a.meta?.type === "gasto" && a.meta.gastoId) {
      byGasto.set(a.meta.gastoId, a);
    }
  }

  let mutated = false;

  // Crea faltantes
  for (const g of gastos) {
    if (!byGasto.has(g.id)) {
      const mk = monthKey(new Date(g.fechaISO));
      ajustes.push({
        id: `gasto-${g.id}`,
        yyyymm: mk,
        amount: -Math.abs(Number(g.montoUSD) || 0),
        label: `Gasto: ${g.motivo}`,
        createdISO: g.fechaISO,
        actor: g.usuario,
        meta: { type: "gasto", gastoId: g.id, carryPrevOn7: true },
      });
      mutated = true;
    }
  }

  // Elimina ajustes de gastos que ya no existen
  const gastoIds = new Set(gastos.map((g) => g.id));
  const cleaned = ajustes.filter((a) => {
    if (a.meta?.type === "gasto" && a.meta.gastoId) {
      return gastoIds.has(a.meta.gastoId);
    }
    return true;
  });

  if (cleaned.length !== ajustes.length) mutated = true;
  if (mutated) writeAjustes(cleaned);
}

/* ======================= Alta de cliente → Ajuste positivo (prorrateo) ======================= */

/**
 * Registra un ajuste POSITIVO por prorrateo del mes actual cuando un cliente se da de alta.
 * - Meses de 30 días (simplificado)
 * - Factor = (días restantes del mes / 30)
 * - Monto = servicio(Mb) × tarifa($/Mb) × factor
 */
export function recordJoinProration(
  cliente: ClienteAlta,
  tarifaPorMbUSD: number,
  opts?: { fechaISO?: string; actor?: string }
) {
  const fecha = opts?.fechaISO ? new Date(opts.fechaISO) : new Date();
  const yyyymm = monthKey(fecha);

  // Mes fijo de 30 días. Incluyendo el día de alta: si se da de alta el día 16 → 15/30 = 0.5
  const day = fecha.getDate(); // 1..31 (usamos 30 d)
  const remainingDays = Math.max(0, 30 - day + 1);
  const factor = remainingDays / 30;

  const mensual = (Number(cliente.servicio) || 0) * (Number(tarifaPorMbUSD) || 0);
  const monto = Math.max(0, Math.round(mensual * factor * 100) / 100);
  if (!monto) return;

  const ajustes = readAjustes();

  const ajuste: AjusteCobro = {
    id: `alta-${cliente.id}-${Date.now()}`,
    yyyymm,
    amount: monto, // POSITIVO
    label: `Prorrateo alta: ${cliente.nombre} — ${cliente.servicio}Mb × $${tarifaPorMbUSD}/Mb (${remainingDays}/30)`,
    createdISO: fecha.toISOString(),
    actor: opts?.actor || "",
    meta: { type: "venta", movId: `alta-${cliente.id}` },
  };

  writeAjustes([...ajustes, ajuste]);
}
