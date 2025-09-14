"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, DollarSign, Users, MapPin, PiggyBank, Wrench } from "lucide-react";
import { getCurrentUser, isAdminUser } from "@/lib/admin";
import { useClientes, useZonas } from "@/hooks/useSupabaseData";
import { useTarifas } from "@/hooks/useTarifas";

const LS_ZONAS = "app_zonas";
const LS_TARIFAS = "app_tarifas";
const LS_CLIENTES = "app_clientes";

type ZonaId = string;
type Zona = { id: ZonaId; nombre: string };
type Cliente = {
  id: string;
  nombre: string;
  ip: string;
  mac: string;
  servicio: number; // Mb
  router: boolean;
  switch: boolean;
  zona: ZonaId;
  activo: boolean;
};

const TARGET_MB = 170;
const FIXED_COST = 130;
const MARGIN_STD = 3.75;
const MARGIN_PREMIUM = 5.25;

export default function DashboardPage() {
  // Datos directos de Supabase
  const [zonas, , zonasLoading] = useZonas();
  const [tarifas, , tarifasLoading] = useTarifas({});
  const [clientes, , clientesLoading] = useClientes();
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Estado de carga combinado
  const isLoading = zonasLoading || tarifasLoading || clientesLoading;

  // ¿Eres admin?
  useEffect(() => {
    const update = () => setIsAdmin(isAdminUser(getCurrentUser()));
    update();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "app_user") update();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Los datos se cargan automáticamente con hooks de Supabase

  // Mostrar pantalla de carga
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  const {
    totalMbActivos,
    totalUsuariosActivos,
    zonasDetalladas,
    totalIngreso,
    progreso,
    margenBruto,
    reporteNeto,
    sobranteTecnicos,
  } = useMemo(() => {
    const activos = clientes.filter((c) => c.activo);

    const byZonaMb = new Map<ZonaId, number>();
    for (const c of activos) {
      byZonaMb.set(c.zona, (byZonaMb.get(c.zona) ?? 0) + (Number(c.servicio) || 0));
    }

    const detalles = zonas
      .map((z) => {
        const mb = byZonaMb.get(z.id) ?? 0;
        const tarifa = tarifas[z.id] ?? 0;
        const ingreso = mb * tarifa;
        return { id: z.id, nombre: z.nombre, mb, tarifa, ingreso };
      })
      .sort((a, b) => b.ingreso - a.ingreso);

    const totalMb = detalles.reduce((acc, z) => acc + z.mb, 0);
    const ingresoTotal = detalles.reduce((acc, z) => acc + z.ingreso, 0);
    const usuariosActivos = activos.length;

    // Margen por Mb (tarifa 7 => premium)
    let margen = 0;
    for (const c of activos) {
      const tarifaZona = tarifas[c.zona] ?? 0;
      const perMb = tarifaZona === 7 ? MARGIN_PREMIUM : MARGIN_STD;
      margen += perMb * (Number(c.servicio) || 0);
    }
    const neto = margen - FIXED_COST;

    // Sobrante para técnicos = Ingresos − Margen
    const sobrante = Math.max(0, ingresoTotal - margen);

    return {
      totalMbActivos: totalMb,
      totalUsuariosActivos: usuariosActivos,
      zonasDetalladas: detalles,
      totalIngreso: ingresoTotal,
      progreso: TARGET_MB > 0 ? Math.min(1, totalMb / TARGET_MB) : 0,
      margenBruto: margen,
      reporteNeto: neto,
      sobranteTecnicos: sobrante,
    };
  }, [zonas, tarifas, clientes]);

  const currency = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Resumen del negocio</h1>
          <p className="text-sm text-slate-500">Objetivo: repartir {TARGET_MB} Mb</p>
        </div>
        <div className="text-xs text-slate-500">Actualizado: {new Date().toLocaleString()}</div>
      </div>

      {/* === Métricas superiores === */}
      {isAdmin ? (
        <>
          {/* FILA 1 (admin): Mb, Ingresos, Net, Sobrante */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Mb activos */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-50 border border-blue-100">
                  <Activity className="h-5 w-5 text-blue-700" />
                </div>
                <div className="text-sm text-slate-500">Mb activos</div>
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {totalMbActivos} <span className="text-base text-slate-500">/ {TARGET_MB}</span>
              </div>
              <div className="mt-3">
                <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-[width] duration-500"
                    style={{ width: `${progreso * 100}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {Math.round(progreso * 100)}% de la meta · Faltan {Math.max(0, TARGET_MB - totalMbActivos)} Mb
                </div>
              </div>
            </div>

            {/* Ingresos estimados */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100">
                  <DollarSign className="h-5 w-5 text-emerald-700" />
                </div>
                <div className="text-sm text-slate-500">Ingresos estimados</div>
              </div>
              <div className="mt-2 text-2xl font-semibold">{currency(totalIngreso)}</div>
              <div className="mt-1 text-xs text-slate-500">Sumando todas las calles (solo activos)</div>
            </div>

            {/* Reporte neto */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rose-50 border border-rose-100">
                  <PiggyBank className="h-5 w-5 text-rose-700" />
                </div>
                <div className="text-sm text-slate-500">Reporte neto</div>
              </div>
              <div className={`mt-2 text-2xl font-semibold ${reporteNeto >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                {currency(reporteNeto)}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {currency(margenBruto)} − costo fijo mensual {currency(FIXED_COST)}
              </div>
            </div>

            {/* Sobrante (técnicos) */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100">
                  <Wrench className="h-5 w-5 text-indigo-700" />
                </div>
                <div className="text-sm text-slate-500">Sobrante (técnicos)</div>
              </div>
              <div className="mt-2 text-2xl font-semibold text-indigo-700">{currency(sobranteTecnicos)}</div>
              <div className="mt-1 text-xs text-slate-500">Fórmula: Ingresos estimados − Margen bruto</div>
            </div>
          </div>

          {/* FILA 2 (admin): Usuarios, Zonas, Margen */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Usuarios activos */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-violet-50 border border-violet-100">
                  <Users className="h-5 w-5 text-violet-700" />
                </div>
                <div className="text-sm text-slate-500">Usuarios activos</div>
              </div>
              <div className="mt-2 text-2xl font-semibold">{totalUsuariosActivos}</div>
              <div className="mt-1 text-xs text-slate-500">Con contrato vigente</div>
            </div>

            {/* Zonas */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-50 border border-amber-100">
                  <MapPin className="h-5 w-5 text-amber-700" />
                </div>
                <div className="text-sm text-slate-500">Zonas</div>
              </div>
              <div className="mt-2 text-2xl font-semibold">{zonas.length}</div>
              <div className="mt-1 text-xs text-slate-500">Redes/calles registradas</div>
            </div>

            {/* Margen bruto */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-teal-50 border border-teal-100">
                  <DollarSign className="h-5 w-5 text-teal-700" />
                </div>
                <div className="text-sm text-slate-500">Margen bruto (estimado)</div>
              </div>
              <div className="mt-2 text-2xl font-semibold">{currency(margenBruto)}</div>
              <div className="mt-1 text-xs text-slate-500">
                Regla: ${MARGIN_STD}/Mb normal · ${MARGIN_PREMIUM}/Mb si tarifa = 7
              </div>
            </div>
          </div>
        </>
      ) : (
        // === NO ADMIN: UNA sola grilla con 4 tarjetas ===
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Mb activos */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-50 border border-blue-100">
                <Activity className="h-5 w-5 text-blue-700" />
              </div>
              <div className="text-sm text-slate-500">Mb activos</div>
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {totalMbActivos} <span className="text-base text-slate-500">/ {TARGET_MB}</span>
            </div>
            <div className="mt-3">
              <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-600 transition-[width] duration-500"
                  style={{ width: `${progreso * 100}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {Math.round(progreso * 100)}% de la meta · Faltan {Math.max(0, TARGET_MB - totalMbActivos)} Mb
              </div>
            </div>
          </div>

          {/* Ingresos estimados */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100">
                <DollarSign className="h-5 w-5 text-emerald-700" />
              </div>
              <div className="text-sm text-slate-500">Ingresos estimados</div>
            </div>
            <div className="mt-2 text-2xl font-semibold">{currency(totalIngreso)}</div>
            <div className="mt-1 text-xs text-slate-500">Sumando todas las calles (solo activos)</div>
          </div>

          {/* Usuarios activos */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-violet-50 border border-violet-100">
                <Users className="h-5 w-5 text-violet-700" />
              </div>
              <div className="text-sm text-slate-500">Usuarios activos</div>
            </div>
            <div className="mt-2 text-2xl font-semibold">{totalUsuariosActivos}</div>
            <div className="mt-1 text-xs text-slate-500">Con contrato vigente</div>
          </div>

          {/* Zonas */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-50 border border-amber-100">
                <MapPin className="h-5 w-5 text-amber-700" />
              </div>
              <div className="text-sm text-slate-500">Zonas</div>
            </div>
            <div className="mt-2 text-2xl font-semibold">{zonas.length}</div>
            <div className="mt-1 text-xs text-slate-500">Redes/calles registradas</div>
          </div>
        </div>
      )}

      {/* Detalle por zona */}
      <div className="rounded-2xl border bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b bg-slate-50 text-sm font-semibold text-slate-700">
          Distribución por zona (Mb e ingresos)
        </div>

        {zonasDetalladas.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">No hay zonas registradas.</div>
        ) : (
          <div className="divide-y">
            {zonasDetalladas.map((z) => {
              const pct = totalMbActivos > 0 ? (z.mb / totalMbActivos) * 100 : 0;
              return (
                <div key={z.id} className="px-4 py-3 grid grid-cols-12 items-center gap-3 text-sm">
                  <div className="col-span-12 md:col-span-3">
                    <div className="font-medium text-slate-900">{z.nombre}</div>
                    <div className="text-xs text-slate-500">Tarifa: ${z.tarifa}/Mb</div>
                  </div>

                  <div className="col-span-12 md:col-span-5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Mb</span>
                      <span className="font-medium">{z.mb}</span>
                    </div>
                    <div className="mt-2 h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-slate-600/80"
                        style={{ width: `${pct}%` }}
                        title={`${pct.toFixed(1)}% del total`}
                      />
                    </div>
                  </div>

                  <div className="col-span-12 md:col-span-4 md:text-right">
                    <div className="text-slate-600">Ingreso estimado</div>
                    <div className="font-semibold">{currency(z.ingreso)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        * Los cálculos usan únicamente <span className="font-medium">usuarios activos</span>. Modifica tarifas en
        <span className="font-medium"> Configuración</span> y usuarios en <span className="font-medium">Usuarios</span>.
      </p>
    </div>
  );
}
