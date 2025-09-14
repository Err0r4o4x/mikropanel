"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, isAdminUser } from "@/lib/admin";
import { useZonas } from "@/hooks/useSupabaseData";
import { useTarifas } from "@/hooks/useTarifas";

/** Claves localStorage */
const LS_EQUIPOS = "app_equipos";

/** Tipos */
type EstadoEquipo =
  | { tipo: "disponible" }
  | { tipo: "vendido"; fechaISO: string }
  | { tipo: "asignado"; fechaISO: string; clienteId: string; clienteNombre: string };

type Equipo = {
  id: string;
  etiqueta: string;       // nombre del equipo (agrupa)
  categoria?: string;
  precio_usd?: number;
  estado_tipo: string;
  estado_fecha?: string;
  estado_cliente_id?: string;
  estado_cliente_nombre?: string;
  placeholder?: boolean;  // marcador cuando cantidad=0
  created_at: string;
};


/** Defaults Zonas/Tarifas */

const TARIFA_BASE: Record<string, number> = {
  carbajal: 5,
  "santo-suarez": 7,
  "san-francisco": 5,
  "buenos-aires": 5,
};

export default function ConfiguracionPage() {
  const router = useRouter();

  /** Guard: solo admin */
  useEffect(() => {
    if (!isAdminUser(getCurrentUser())) router.replace("/");
  }, [router]);

  /** ===== Tarifas ===== */
  const [zonas, , zonasLoading] = useZonas();
  const [tarifasDB, updateTarifasDB, tarifasLoading] = useTarifas(TARIFA_BASE);
  const [tarifasLocal, setTarifasLocal] = useState<Record<string, number>>({});
  const [statusTarifas, setStatusTarifas] = useState<string | null>(null);
  
  // Sincronizar tarifas de DB con estado local
  useEffect(() => {
    setTarifasLocal(tarifasDB);
  }, [tarifasDB]);
  
  // Estado de carga combinado
  const isLoading = zonasLoading || tarifasLoading;

  const zonasOrdenadas = useMemo(
    () => zonas.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [zonas]
  );

  function setTarifa(id: string, value: string) {
    const n = Number(value);
    setTarifasLocal(prev => ({
      ...prev,
      [id]: Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0,
    }));
  }

  async function guardarTarifas() {
    try {
      await updateTarifasDB(tarifasLocal);
      setStatusTarifas("Tarifas guardadas correctamente.");
      setTimeout(() => setStatusTarifas(null), 2000);
    } catch {
      setStatusTarifas("Error al guardar tarifas.");
      setTimeout(() => setStatusTarifas(null), 2000);
    }
  }

  /** ===== Inventario (cantidad + precio) ===== */
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [hydratedInv, setHydratedInv] = useState(false); // evita guardar antes de cargar
  const [statusInv, setStatusInv] = useState<string | null>(null);
  const [errInv, setErrInv] = useState<string | null>(null);

  // Cargar equipos (y marcar hidratado)
  useEffect(() => {
    try {
      const rawE = localStorage.getItem(LS_EQUIPOS);
      if (rawE) {
        const parsed: Equipo[] = JSON.parse(rawE);
        if (Array.isArray(parsed)) setEquipos(parsed);
      }
    } catch {}
    setHydratedInv(true);
  }, []);

  // Guardar SOLO tras hidratar
  useEffect(() => {
    if (!hydratedInv) return;
    try { localStorage.setItem(LS_EQUIPOS, JSON.stringify(equipos)); } catch {}
  }, [hydratedInv, equipos]);

  // Sincronizar cambios desde otras pestañas
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_EQUIPOS && typeof e.newValue === "string") {
        try {
          const list = JSON.parse(e.newValue);
          if (Array.isArray(list)) setEquipos(list);
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /** Agrupar por etiqueta (placeholder NO suma cantidad) */
type Grupo = {
  key: string;
  display: string;
  cantidad: number;   // << SOLO disponibles
  asignadas: number;  // informativo
  precioUSD?: number; // último precio conocido (no vendidas o placeholder)
};

const grupos = useMemo<Grupo[]>(() => {
  const map = new Map<string, Grupo>();
  for (const e of equipos) {
    const key = e.etiqueta.trim().toLowerCase();
    const display = e.etiqueta.trim();
    if (!map.has(key)) {
      map.set(key, { key, display, cantidad: 0, asignadas: 0, precioUSD: e.precio_usd });
    }
    const g = map.get(key)!;

    // el marcador no suma cantidad
    if (e.placeholder) {
      if (g.precioUSD == null && e.precio_usd != null) g.precioUSD = e.precio_usd;
      continue;
    }

    // SOLO contamos disponibles como stock
    if (e.estado_tipo === "disponible") g.cantidad += 1;

    // contamos asignadas por separado (solo informativo)
    if (e.estado_tipo === "asignado") g.asignadas += 1;

    // guarda último precio conocido en no vendidas
    if (e.estado_tipo !== "vendido" && typeof e.precio_usd === "number") {
      g.precioUSD = e.precio_usd;
    }
  }
  return Array.from(map.values()).sort((a, b) => a.display.localeCompare(b.display));
}, [equipos]);

  /** Filas editables */
  type RowInv = { key: string; display: string; qty: string; price: string; asignadas: number };
  const [rowsInv, setRowsInv] = useState<RowInv[]>([]);

  useEffect(() => {
    setRowsInv(
      grupos.map((g) => ({
        key: g.key,
        display: g.display,
        qty: String(g.cantidad),
        price: g.precioUSD != null ? String(g.precioUSD) : "",
        asignadas: g.asignadas,
      }))
    );
  }, [grupos]);

  /** Aplicar cambios: agrega/quita unidades, actualiza precio y crea placeholder si qty=0 */
  function applyInventario() {
    setErrInv(null);
    setStatusInv(null);

    const errors: string[] = [];
    const toAdd: { key: string; display: string; add: number; price?: number }[] = [];
    const toRemove: { key: string; remove: number }[] = [];
    const priceMap = new Map<string, number | undefined>();
    const desiredByKey = new Map<string, number>();
    const keysTouched = new Set<string>();

    for (const r of rowsInv) {
      const g = grupos.find((x) => x.key === r.key)!;
      const desired = Math.max(0, Math.floor(Number(r.qty)) || 0);
      const current = g.cantidad;
      const assigned = g.asignadas;

      desiredByKey.set(r.key, desired);
      keysTouched.add(r.key);

      const p = r.price.trim() === "" ? undefined : Number(r.price);
      if (p != null && (!Number.isFinite(p) || p < 0)) {
        errors.push(`Precio inválido para ${g.display}`);
      }
      priceMap.set(r.key, p);

      if (desired > current) {
        toAdd.push({ key: r.key, display: g.display, add: desired - current, price: p });
      } else if (desired < current) {
        const need = current - desired;
        const disponibles = current - assigned;
        if (need > disponibles) {
          errors.push(`No puedes bajar ${g.display} a ${desired}. Hay ${assigned} asignada(s). Mínimo permitido: ${assigned}.`);
        } else {
          toRemove.push({ key: r.key, remove: need });
        }
      }
    }

    if (errors.length) {
      setErrInv(errors.join("\n"));
      return;
    }

    setEquipos((prev) => {
      let next = prev.slice();

      // Quitar placeholders de los grupos que editamos (se reconstruyen)
      next = next.filter((e) => !(e.placeholder && keysTouched.has(e.etiqueta.trim().toLowerCase())));

      // Remover unidades disponibles
      for (const { key, remove } of toRemove) {
        let remaining = remove;
        next = next.filter((e) => {
          if (
            remaining > 0 &&
            e.etiqueta.trim().toLowerCase() === key &&
            e.estado_tipo === "disponible" &&
            !e.placeholder
          ) {
            remaining -= 1;
            return false;
          }
          return true;
        });
      }

      // Agregar nuevas unidades
      const now = new Date().toISOString();
      for (const { display, add, price } of toAdd) {
        for (let i = 0; i < add; i++) {
          next.unshift({
            id: crypto.randomUUID(),
            etiqueta: display,
            categoria: "general",
            precio_usd: price,
            estado_tipo: "disponible",
            created_at: now,
          });
        }
      }

      // Actualizar precio en todas las no vendidas (si price definido)
      next = next.map((e) => {
        const k = e.etiqueta.trim().toLowerCase();
        const p = priceMap.get(k);
        if (p === undefined) return e; // campo vacío: no tocar
        if (e.estado_tipo !== "vendido" && !e.placeholder) return { ...e, precio_usd: p };
        return e;
      });

      // Asegurar placeholder cuando desired=0 y ya no queden no vendidos
      for (const r of rowsInv) {
        const key = r.key;
        const desired = desiredByKey.get(key) ?? 0;
        if (desired !== 0) continue;

        const hasNonSold = next.some(
          (e) => e.etiqueta.trim().toLowerCase() === key && e.estado_tipo !== "vendido" && !e.placeholder
        );
        const hasPlaceholder = next.some((e) => e.etiqueta.trim().toLowerCase() === key && e.placeholder);

        if (!hasNonSold && !hasPlaceholder) {
          next.unshift({
            id: crypto.randomUUID(),
            etiqueta: r.display,
            categoria: "general",
            precio_usd: priceMap.get(key),
            estado_tipo: "disponible", // el estado visible se deriva por cantidad 0
            created_at: now,
            placeholder: true,
          });
        }

        // actualizar precio del placeholder si lo cambiaste
        if (!hasNonSold && hasPlaceholder) {
          const p = priceMap.get(key);
          if (p !== undefined) {
            next = next.map((e) => {
              if (e.placeholder && e.etiqueta.trim().toLowerCase() === key) {
                return { ...e, precio_usd: p };
              }
              return e;
            });
          }
        }
      }

      return next;
    });

    setStatusInv("Inventario actualizado.");
    setTimeout(() => setStatusInv(null), 2000);
  }

  // Mostrar pantalla de carga
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-10">
      {/* ===== Tarifas ===== */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-baseline gap-3">
            <h2 className="text-xl font-semibold">Tarifas por Zona</h2>
            <span className="text-sm px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
              {zonas.length} calle{zonas.length === 1 ? "" : "s"}
            </span>
          </div>
          <button
            onClick={guardarTarifas}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow"
            title="Guardar tarifas"
          >
            Guardar tarifas
          </button>
        </div>

        {statusTarifas && (
          <div className="mb-4 text-sm px-3 py-2 rounded border border-slate-200 bg-green-50 text-green-700">
            {statusTarifas}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-2 border-b border-slate-200 text-sm font-semibold text-slate-700">
            <div className="col-span-8">Zona / Calle</div>
            <div className="col-span-4 text-right">Tarifa ($/Mb)</div>
          </div>

           {zonasOrdenadas.map((z) => {
             const valor = tarifasLocal[z.id] ?? 5;
            return (
              <div key={z.id} className="grid grid-cols-12 items-center px-4 py-3 border-b last:border-b-0 border-slate-100">
                <div className="col-span-8 text-slate-800">{z.nombre}</div>
                <div className="col-span-4">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={valor}
                    onChange={(e) => setTarifa(z.id, e.target.value)}
                    className="w-full text-right border rounded px-3 py-2"
                    aria-label={`Tarifa de ${z.nombre}`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-slate-500 mt-3">
          Nota: estas tarifas se almacenan en tu navegador (localStorage) y se usan en la pantalla{" "}
          <span className="font-medium">Usuarios</span> para calcular ingresos.
        </p>
      </section>

      {/* ===== Inventario ===== */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Inventario: stock y precios</h2>
          <button
            onClick={applyInventario}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow"
            title="Guardar cambios de inventario"
          >
            Guardar inventario
          </button>
        </div>

        {errInv && (
          <div className="mb-3 text-sm px-3 py-2 rounded border border-rose-200 bg-rose-50 text-rose-700 whitespace-pre-line">
            {errInv}
          </div>
        )}
        {statusInv && (
          <div className="mb-3 text-sm px-3 py-2 rounded border border-emerald-200 bg-emerald-50 text-emerald-700">
            {statusInv}
          </div>
        )}

        {grupos.length === 0 ? (
          <div className="text-sm text-slate-500">No hay equipos en inventario.</div>
        ) : (
          <div className="rounded-lg border overflow-hidden bg-white">
            <div className="grid grid-cols-12 bg-slate-50 text-slate-700 text-sm font-medium px-3 py-2 border-b">
              <div className="col-span-5">Equipo</div>
              <div className="col-span-2">Cantidad</div>
              <div className="col-span-2">Asignadas</div>
              <div className="col-span-3">Precio (USD)</div>
            </div>

            {rowsInv.map((r, idx) => (
              <div key={r.key} className="grid grid-cols-12 items-center px-3 py-2 border-b last:border-b-0 text-sm">
                <div className="col-span-5 font-medium">{r.display}</div>

                <div className="col-span-2">
                  <input
                    type="number"
                    min={0}
                    className="w-24 border rounded px-2 py-1"
                    value={r.qty}
                    onChange={(e) =>
                      setRowsInv((prev) => prev.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)))
                    }
                  />
                </div>

                <div className="col-span-2 text-slate-600">{r.asignadas}</div>

                <div className="col-span-3">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className="w-32 border rounded px-2 py-1"
                    value={r.price}
                    onChange={(e) =>
                      setRowsInv((prev) => prev.map((x, i) => (i === idx ? { ...x, price: e.target.value } : x)))
                    }
                    placeholder="-"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-slate-500 mt-3">
          Si defines <span className="font-medium">Cantidad = 0</span>, el equipo se mantiene visible en Inventario con
          estado “No disponible”. El <span className="font-medium">Precio</span> (si lo indicas) se aplicará a todas las
          unidades no vendidas del grupo y al marcador.
        </p>
      </section>
    </div>
  );
}
