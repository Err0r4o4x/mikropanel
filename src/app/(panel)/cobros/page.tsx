"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, isAdminUser } from "@/lib/admin";
import { useClientes } from "@/hooks/useSupabaseData";
import { useTarifas } from "@/hooks/useTarifas";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

/* ===== LocalStorage keys ===== */
const LS_COBROS_CORTES = "app_cobros_cortes";
const LS_AJUSTES_COBROS = "app_cobros_ajustes";

/* ===== Archivo de ajustes (histórico) ===== */
const LS_AJUSTES_ARCHIVE = "app_cobros_ajustes_archive";
// estructura: { [yyyymm]: { items: Ajuste[], total: number, savedISO: string } }
type AjustesArchive = Record<string, { items: Ajuste[]; total: number; savedISO: string }>;

function readAjustesArchive(): AjustesArchive {
  try {
    const raw = localStorage.getItem(LS_AJUSTES_ARCHIVE);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}
function writeAjustesArchive(obj: AjustesArchive) {
  try {
    localStorage.setItem(LS_AJUSTES_ARCHIVE, JSON.stringify(obj));
  } catch {}
}

/* ===== Envíos (estado y movimientos) ===== */
const LS_ENVIO_STATE = "app_cobros_envio_state"; // { [yyyymm]: { total, remaining, createdISO, updatedISO } }
const LS_ENVIO_MOVS = "app_cobros_envio_movs"; // Array<{ id, yyyymm, amount, note, createdISO }>

/* ===== Flags (día 5) ===== */
const AUTOSAVE_FLAG_PREFIX = "app_cobros_autosave_"; // + YYYY-MM
const RESET_FLAG_PREFIX = "app_cobros_reset_"; // + YYYY-MM

/* ===== Helpers ===== */
function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function archiveMonthAdjustments(yyyymm: string, allAjustes: Ajuste[]) {
  const monthItems = allAjustes.filter((a) => a.yyyymm === yyyymm);
  if (monthItems.length === 0) return;

  const total = round2(monthItems.reduce((acc, a) => acc + (Number(a.amount) || 0), 0));
  const archive = readAjustesArchive();

  archive[yyyymm] = {
    items: monthItems,
    total,
    savedISO: new Date().toISOString(),
  };

  writeAjustesArchive(archive);
}

/* ===== Parámetros del negocio ===== */
const FIXED_COST = 130;
const MARGIN_STD = 3.75;
const MARGIN_PREMIUM = 5.25;

/* ===== Tipos ===== */


type Corte = {
  ym: string; // YYYY-MM
  ingreso: number;
  tecnicos: number;
  neto: number;
  createdISO: string;
};

type Ajuste = {
  id: string;
  yyyymm: string; // YYYY-MM
  amount: number;
  label: string;
  createdISO: string;
  actor?: string;
  meta?: { type?: "gasto" | "venta" | "instalacion"; gastoId?: string; movId?: string };
};

/* ===== Envíos ===== */
type EnviosState = Record<
  string,
  { total: number; remaining: number; createdISO: string; updatedISO: string }
>;
type EnvioMovimiento = {
  id: string;
  yyyymm: string;
  amount: number; // lo enviado (positivo)
  note?: string;
  createdISO: string;
};

export default function CobrosPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  /* ===== Guard de admin ===== */
  useEffect(() => {
    const admin = isAdminUser(getCurrentUser());
    setIsAdmin(admin);
    if (!admin) router.replace("/");
  }, [router]);

  /* ===== Base de datos (clientes/tarifas) ===== */
  const [clientes, , clientesLoading] = useClientes();
  const [tarifas, , tarifasLoading] = useTarifas({});
  const [cortes, setCortes] = useState<Corte[]>([]);
  const [loadedCortes, setLoadedCortes] = useState(false);
  
  // Estado de carga combinado
  const isLoading = clientesLoading || tarifasLoading;

  useEffect(() => {
    // Los datos de clientes y tarifas se cargan automáticamente con hooks

    try {
      const raw = localStorage.getItem(LS_COBROS_CORTES);
      if (raw) {
        const list: Array<{
          ym: string;
          ingreso: number;
          tecnicos?: number;
          tecnicosUSD?: number;
          neto: number;
          createdISO?: string;
        }> = JSON.parse(raw);
        const norm: Corte[] = Array.isArray(list)
          ? list.map((c) => ({
              ym: String(c.ym),
              ingreso: Number(c.ingreso ?? 0),
              tecnicos: Number(c.tecnicos ?? c.tecnicosUSD ?? 0),
              neto: Number(c.neto ?? 0),
              createdISO: c.createdISO ?? new Date().toISOString(),
            }))
          : [];
        setCortes(norm);
      }
    } catch {}
    setLoadedCortes(true);
  }, []);

  useEffect(() => {
    if (!loadedCortes) return;
    try {
      localStorage.setItem(LS_COBROS_CORTES, JSON.stringify(cortes));
    } catch {}
  }, [loadedCortes, cortes]);

  /* ===== Ajustes ===== */
  const [ajustes, setAjustes] = useState<Ajuste[]>([]);

  const loadAjustes = () => {
    try {
      const raw = localStorage.getItem(LS_AJUSTES_COBROS);
      if (!raw) {
        setAjustes([]);
        return;
      }
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const norm: Ajuste[] = list.map((a) => ({
          id: String(a.id),
          yyyymm: String(a.yyyymm),
          amount: Number(a.amount || 0),
          label: String(a.label || "Ajuste"),
          createdISO: a.createdISO || new Date().toISOString(),
          actor: a.actor || "",
          meta: a.meta || undefined,
        }));
        setAjustes(norm);
      } else {
        setAjustes([]);
      }
    } catch {
      setAjustes([]);
    }
  };

  useEffect(() => {
    loadAjustes();
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_AJUSTES_COBROS) loadAjustes();
      if (e.key === LS_ENVIO_STATE || e.key === LS_ENVIO_MOVS) {
        reloadEnvios();
      }
    };
    const onFocus = () => {
      loadAjustes();
      reloadEnvios();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  /* ===== Agregados y métricas ===== */
  const mkNow = monthKey();

  const { ajustesMesItems, ajustesMesTotal } = useMemo(() => {
    const items = ajustes
      .filter((a) => a.yyyymm === mkNow)
      .sort((a, b) => (a.createdISO || "").localeCompare(b.createdISO || ""));
    const total = round2(items.reduce((acc, a) => acc + (Number(a.amount) || 0), 0));
    return { ajustesMesItems: items, ajustesMesTotal: total };
  }, [ajustes, mkNow]);

  const { ingresoBruto, tecnicosActual, netoActual, activosCount } = useMemo(() => {
    const activos = clientes.filter((c) => c.activo);

    const ingreso = activos.reduce((acc, c) => {
      const tarifa = Number(tarifas[c.zona_id] ?? 0);
      return acc + tarifa * (Number(c.servicio) || 0);
    }, 0);

    let margen = 0;
    for (const c of activos) {
      const tarifa = Number(tarifas[c.zona_id] ?? 0);
      const perMb = tarifa === 7 ? MARGIN_PREMIUM : MARGIN_STD;
      margen += perMb * (Number(c.servicio) || 0);
    }

    const tecnicos = Math.max(0, ingreso - margen);
    const netoBase = margen - FIXED_COST;
    const neto = netoBase + ajustesMesTotal;

    return {
      ingresoBruto: round2(ingreso),
      tecnicosActual: round2(tecnicos),
      netoActual: round2(neto),
      activosCount: activos.length,
    };
  }, [clientes, tarifas, ajustesMesTotal]);

  /* ===== ENVÍOS (estado + movimientos) ===== */
  const [envState, setEnvState] = useState<EnviosState>({});
  const [envMovs, setEnvMovs] = useState<EnvioMovimiento[]>([]);
  const [sendAmount, setSendAmount] = useState<string>("");
  const [sendNote, setSendNote] = useState<string>("");

  function reloadEnvios() {
    try {
      const st = localStorage.getItem(LS_ENVIO_STATE);
      setEnvState(st ? JSON.parse(st) : {});
    } catch {
      setEnvState({});
    }
    try {
      const mv = localStorage.getItem(LS_ENVIO_MOVS);
      const arr = mv ? JSON.parse(mv) : [];
      setEnvMovs(Array.isArray(arr) ? arr : []);
    } catch {
      setEnvMovs([]);
    }
  }

  useEffect(() => {
    reloadEnvios();
  }, []);

  function saveEnvState(next: EnviosState) {
    setEnvState(next);
    try {
      localStorage.setItem(LS_ENVIO_STATE, JSON.stringify(next));
    } catch {}
  }
  function saveEnvMovs(next: EnvioMovimiento[]) {
    setEnvMovs(next);
    try {
      localStorage.setItem(LS_ENVIO_MOVS, JSON.stringify(next));
    } catch {}
  }

  // Setear "Listo para enviar" para un mes (se usa al guardar corte)
  const setPendingForMonth = useCallback((ym: string, total: number) => {
    const nowISO = new Date().toISOString();
    const current = envState[ym];
    const next: EnviosState = {
      ...envState,
      [ym]: {
        total: round2(total),
        remaining: round2(total), // al crear corte, todo queda pendiente
        createdISO: current?.createdISO || nowISO,
        updatedISO: nowISO,
      },
    };
    saveEnvState(next);

    // Limpia movimientos previos del mismo mes (nuevo periodo)
    const filteredMovs = envMovs.filter((m) => m.yyyymm !== ym);
    saveEnvMovs(filteredMovs);
  }, [envState, envMovs]);

  // Registrar un envío parcial
  function registrarEnvioParcial() {
    const ym = mkNow;
    const st = envState[ym];
    if (!st) {
      alert("No hay un corte marcado como 'Listo para enviar' este mes.");
      return;
    }
    const amt = Number(sendAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      alert("Monto inválido.");
      return;
    }
    if (amt > st.remaining) {
      if (!confirm("El monto excede lo pendiente. ¿Registrar de todas formas?")) return;
    }

    const nowISO = new Date().toISOString();
    const mov: EnvioMovimiento = {
      id: crypto.randomUUID(),
      yyyymm: ym,
      amount: round2(amt),
      note: sendNote?.trim() || "",
      createdISO: nowISO,
    };

    const newRemaining = round2(st.remaining - amt);
    const nextState: EnviosState = {
      ...envState,
      [ym]: { ...st, remaining: newRemaining < 0 ? 0 : newRemaining, updatedISO: nowISO },
    };
    saveEnvState(nextState);
    saveEnvMovs([mov, ...envMovs]);

    setSendAmount("");
    setSendNote("");
  }

  // Limpiar envíos de este mes (si se reinicia el corte)
  function clearEnviosForMonth(ym: string) {
    const ns = { ...envState };
    delete ns[ym];
    saveEnvState(ns);
    const nextMovs = envMovs.filter((m) => m.yyyymm !== ym);
    saveEnvMovs(nextMovs);
  }

  /* ===== Día 5: guardar corte y resetear ajustes del mes (una sola vez) ===== */
  useEffect(() => {
    const today = new Date();
    if (today.getDate() !== 5) return;

    const ym = monthKey(today);
    const saveFlagKey = AUTOSAVE_FLAG_PREFIX + ym;
    const resetFlagKey = RESET_FLAG_PREFIX + ym;

    const alreadySaved = localStorage.getItem(saveFlagKey) === "1";
    const alreadyReset = localStorage.getItem(resetFlagKey) === "1";

    // Guardar corte si no se ha guardado automáticamente (usa métricas actuales)
    if (!alreadySaved) {
      try {
        const nuevo: Corte = {
          ym,
          ingreso: ingresoBruto,
          tecnicos: tecnicosActual,
          neto: netoActual,
          createdISO: new Date().toISOString(),
        };
        const raw = localStorage.getItem(LS_COBROS_CORTES);
        let list: Corte[] = [];
        if (raw) {
          const tmp = JSON.parse(raw);
          if (Array.isArray(tmp)) list = tmp;
        }
        const sinMes = list.filter((c) => c.ym !== ym);
        const next = [...sinMes, nuevo].sort((a, b) => a.ym.localeCompare(b.ym));
        localStorage.setItem(LS_COBROS_CORTES, JSON.stringify(next));
        setCortes(next);
        // Marcamos listo para enviar
        setPendingForMonth(ym, netoActual);
        localStorage.setItem(saveFlagKey, "1");
      } catch {}
    }

    // Resetear ajustes del MES: primero archivar, luego borrar (solo 1 vez)
    if (!alreadyReset) {
      try {
        const raw = localStorage.getItem(LS_AJUSTES_COBROS);
        let list: Ajuste[] = [];
        if (raw) {
          const tmp = JSON.parse(raw);
          if (Array.isArray(tmp)) list = tmp;
        }

        // Archivar antes de borrar los del mes actual
        archiveMonthAdjustments(ym, list);

        // BORRA solo los del mes actual
        const kept = list.filter((a) => a.yyyymm !== ym);
        localStorage.setItem(LS_AJUSTES_COBROS, JSON.stringify(kept));
        setAjustes(kept);

        // Flag
        localStorage.setItem(resetFlagKey, "1");
      } catch {}
    }
  }, [ingresoBruto, tecnicosActual, netoActual, setPendingForMonth]);

  /* ===== Guardar corte manual ===== */
  const guardarCorteMesActual = () => {
    if (!confirm("¿Guardar/actualizar el corte del mes actual?")) return;

    const now = new Date();
    const ym = monthKey(now);

    const nuevo: Corte = {
      ym,
      ingreso: ingresoBruto,
      tecnicos: tecnicosActual,
      neto: netoActual,
      createdISO: now.toISOString(),
    };

    try {
      const raw = localStorage.getItem(LS_COBROS_CORTES);
      let list: Corte[] = [];
      if (raw) {
        const tmp = JSON.parse(raw);
        if (Array.isArray(tmp)) list = tmp;
      }
      const sinMes = list.filter((c) => c.ym !== ym);
      const next = [...sinMes, nuevo].sort((a, b) => a.ym.localeCompare(b.ym));
      localStorage.setItem(LS_COBROS_CORTES, JSON.stringify(next));
      setCortes(next);

      // Listo para enviar
      setPendingForMonth(ym, netoActual);

      alert("Corte guardado/actualizado y marcado como 'Listo para enviar'.");
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar el corte.");
    }
  };

  /* ===== Reiniciar corte y ajustes del mes actual ===== */
  const reiniciarCorteMesActual = () => {
    if (
      !confirm(
        "¿Reiniciar el corte y los ajustes del mes actual? Esto eliminará el corte guardado de este mes y pondrá los ajustes a 0 (se archivarán antes)."
      )
    ) {
      return;
    }

    const now = new Date();
    const ym = monthKey(now);
    const saveFlagKey = AUTOSAVE_FLAG_PREFIX + ym;
    const resetFlagKey = RESET_FLAG_PREFIX + ym;

    try {
      // 1) Eliminar el corte del mes actual
      const rawCortes = localStorage.getItem(LS_COBROS_CORTES);
      let listCortes: Corte[] = [];
      if (rawCortes) {
        const tmp = JSON.parse(rawCortes);
        if (Array.isArray(tmp)) listCortes = tmp;
      }
      const cortesNext = listCortes.filter((c) => c.ym !== ym);
      localStorage.setItem(LS_COBROS_CORTES, JSON.stringify(cortesNext));
      setCortes(cortesNext);

      // 2) Archivar y eliminar TODOS los ajustes del mes actual (reset a 0)
      const rawAj = localStorage.getItem(LS_AJUSTES_COBROS);
      let listAj: Ajuste[] = [];
      if (rawAj) {
        const tmp = JSON.parse(rawAj);
        if (Array.isArray(tmp)) listAj = tmp;
      }
      // Archivar antes de borrar los del mes
      archiveMonthAdjustments(ym, listAj);
      const keptAj = listAj.filter((a) => a.yyyymm !== ym);
      localStorage.setItem(LS_AJUSTES_COBROS, JSON.stringify(keptAj));
      setAjustes(keptAj);

      // 3) Limpiar banderas para permitir auto-guardado/auto-reset si aplica
      localStorage.removeItem(saveFlagKey);
      localStorage.removeItem(resetFlagKey);

      // 4) Limpiar envíos del mes
      clearEnviosForMonth(ym);

      alert("Corte, ajustes y 'Listo para enviar' del mes actual reiniciados.");
    } catch (e) {
      console.error(e);
      alert("No se pudo reiniciar. Revisa la consola para más detalles.");
    }
  };

  /* ===== Serie para gráfico (últimos 12 meses) ===== */
  const serieGraf = useMemo(() => {
    const today = new Date();
    const arr: { label: string; tecnicos: number; neto: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const dt = new Date(today.getFullYear(), today.getMonth() - i, 5);
      const ym = monthKey(dt);
      const label = "5 " + dt.toLocaleDateString("es-ES", { month: "short" });
      const rec = cortes.find((c) => c.ym === ym);
      arr.push({
        label,
        tecnicos: rec?.tecnicos ?? 0,
        neto: rec?.neto ?? 0,
      });
    }
    return arr;
  }, [cortes]);

  /* ===== Eliminar 1 ajuste específico ===== */
  const eliminarAjuste = (id: string) => {
    if (!confirm("¿Eliminar este ajuste?")) return;
    try {
      const raw = localStorage.getItem(LS_AJUSTES_COBROS);
      let list: Ajuste[] = [];
      if (raw) {
        const tmp = JSON.parse(raw);
        if (Array.isArray(tmp)) list = tmp;
      }
      const next = list.filter((a) => a.id !== id);
      localStorage.setItem(LS_AJUSTES_COBROS, JSON.stringify(next));
      setAjustes(next);
    } catch {}
  };

  const envioNow = envState[mkNow];
  const movimientosNow = envMovs.filter((m) => m.yyyymm === mkNow);

  /* ===== Render ===== */
  
  // Mostrar pantalla de carga
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando cobros...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cobros</h1>
          <p className="text-xs text-slate-500">Cortes mensuales (día 5)</p>
        </div>
        <div className="text-xs text-slate-500">Actualizado: {new Date().toLocaleString()}</div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Ingreso bruto (actual)</div>
          <div className="mt-1 text-2xl font-semibold">{currency(ingresoBruto)}</div>
          <div className="text-xs text-slate-500 mt-1">{activosCount} usuario(s) activo(s)</div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Pago a técnicos (actual)</div>
          <div className="mt-1 text-2xl font-semibold">{currency(tecnicosActual)}</div>
          <div className="text-xs text-slate-500 mt-1">Ingreso − Margen</div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Costo fijo mensual</div>
          <div className="mt-1 text-2xl font-semibold">{currency(FIXED_COST)}</div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Ajustes (mes)</div>
          <div className={`mt-1 text-2xl font-semibold ${ajustesMesTotal >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {currency(ajustesMesTotal)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Se reinicia automáticamente el día 5 (se guarda corte antes de reiniciar).
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Neto del negocio (actual)</div>
          <div className={`mt-1 text-2xl font-semibold ${netoActual >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {currency(netoActual)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Margen − costo fijo + ajustes</div>
        </div>
      </div>

      {/* Acciones de corte */}
      {isAdmin && (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={reiniciarCorteMesActual}
            className="px-4 py-2 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 shadow border border-rose-200"
            title="Elimina el corte del mes y pone ajustes del mes en 0 (se archivan antes)"
          >
            Reiniciar corte de este mes
          </button>

          <button
            onClick={guardarCorteMesActual}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow"
          >
            Guardar corte de este mes
          </button>
        </div>
      )}

      {/* Panel: Listo para enviar (solo admin) */}
      {isAdmin && (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-700">Listo para enviar — {mkNow}</div>
              {envioNow ? (
                <div className="mt-1 text-sm text-slate-600">
                  Total corte: <b>{currency(envioNow.total)}</b> · Pendiente:{" "}
                  <b className={envioNow.remaining > 0 ? "text-rose-700" : "text-emerald-700"}>
                    {currency(envioNow.remaining)}
                  </b>
                </div>
              ) : (
                <div className="mt-1 text-sm text-slate-500">No hay corte marcado como listo para enviar este mes.</div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={0.01}
                className="border rounded px-3 py-2 w-36"
                placeholder="Monto $"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                disabled={!envioNow}
              />
              <input
                className="border rounded px-3 py-2 w-56"
                placeholder="Nota (opcional)"
                value={sendNote}
                onChange={(e) => setSendNote(e.target.value)}
                disabled={!envioNow}
              />
              <button
                onClick={registrarEnvioParcial}
                disabled={!envioNow}
                className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Registrar envío
              </button>
            </div>
          </div>

          {/* Historial de envíos del mes */}
          {movimientosNow.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer select-none text-sm text-slate-600 hover:text-slate-800">
                Historial de envíos (mes actual) — {movimientosNow.length} mov.
              </summary>

              <div className="mt-3 border rounded max-h-56 overflow-auto">
                <div className="grid grid-cols-12 text-xs font-medium text-slate-500 px-3 py-2 border-b bg-slate-50 sticky top-0">
                  <div className="col-span-3">Fecha</div>
                  <div className="col-span-7">Nota</div>
                  <div className="col-span-2 text-right">Monto</div>
                </div>
                {movimientosNow.map((m) => (
                  <div key={m.id} className="grid grid-cols-12 text-sm px-3 py-2 border-b last:border-b-0">
                    <div className="col-span-3">{new Date(m.createdISO).toLocaleString()}</div>
                    <div className="col-span-7">{m.note || "—"}</div>
                    <div className="col-span-2 text-right font-semibold">{currency(m.amount)}</div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Gráfico */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-slate-700">Neto vs Técnicos — cortes mensuales</div>
          <div className="text-xs text-slate-500">Cada punto es el corte del día 5 de cada mes.</div>
        </div>

        <div className="w-full h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={serieGraf} margin={{ top: 10, right: 16, bottom: 8, left: 0 }}>
              <defs>
                <linearGradient id="techBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#93c5fd" />
                  <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} tickMargin={8} />
              <YAxis tick={{ fontSize: 12, fill: "#64748b" }} tickFormatter={(v) => `$${v}`} width={56} />
              <Tooltip formatter={(v: number, key) => [currency(v), key === "tecnicos" ? "Técnicos" : "Neto negocio"]} />
              <Legend />

              <Bar dataKey="tecnicos" name="Técnicos" fill="url(#techBar)" barSize={28} radius={[8, 8, 0, 0]} />
              <Line type="monotone" dataKey="neto" name="Neto negocio" stroke="#16a34a" strokeWidth={2} dot={{ r: 3, fill: "#16a34a" }} activeDot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ajustes del mes (detalle) */}
      <div className="rounded-2xl border bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b bg-slate-50 text-sm font-semibold text-slate-700">
          Ajustes registrados este mes
          {/* Histórico de ajustes (archivo) */}
          <details className="mt-2 rounded border">
            <summary className="px-3 py-2 text-sm font-semibold text-slate-700 cursor-pointer select-none bg-slate-50">
              Histórico de ajustes (meses anteriores)
            </summary>

            <div className="p-3 space-y-3">
              {Object.entries(readAjustesArchive())
                .sort((a, b) => a[0].localeCompare(b[0])) // asc
                .map(([ym, pack]) => (
                  <details key={ym} className="border rounded">
                    <summary className="px-3 py-2 text-sm cursor-pointer select-none bg-slate-50">
                      {ym} —{" "}
                      <span className={pack.total >= 0 ? "text-emerald-700" : "text-rose-700"}>
                        {currency(pack.total)}
                      </span>{" "}
                      · {pack.items.length} ajuste(s)
                    </summary>

                    <div className="px-3 pb-3">
                      <div className="grid grid-cols-12 text-xs font-medium text-slate-500 py-2 border-b">
                        <div className="col-span-3">Fecha</div>
                        <div className="col-span-6">Detalle</div>
                        <div className="col-span-2">Usuario</div>
                        <div className="col-span-1 text-right">Monto</div>
                      </div>

                      <div className="max-h-56 overflow-auto">
                        {pack.items
                          .sort((a, b) => (a.createdISO || "").localeCompare(b.createdISO || ""))
                          .map((it) => (
                            <div key={it.id} className="grid grid-cols-12 text-sm py-2 border-b last:border-b-0">
                              <div className="col-span-3">
                                {it.createdISO ? new Date(it.createdISO).toLocaleString() : "—"}
                              </div>
                              <div className="col-span-6">{it.label || "Ajuste"}</div>
                              <div className="col-span-2">{it.actor || "—"}</div>
                              <div
                                className={`col-span-1 text-right font-semibold ${
                                  it.amount >= 0 ? "text-emerald-700" : "text-rose-700"
                                }`}
                              >
                                {it.amount >= 0 ? "+" : "-"}
                                {currency(Math.abs(it.amount))}
                              </div>
                            </div>
                          ))}
                      </div>
                      <div className="mt-2 text-[11px] text-slate-500">
                        Guardado el {new Date(pack.savedISO).toLocaleString()}
                      </div>
                    </div>
                  </details>
                ))}
              {Object.keys(readAjustesArchive()).length === 0 && (
                <div className="text-sm text-slate-500">Aún no hay meses archivados.</div>
              )}
            </div>
          </details>
        </div>

        {ajustesMesItems.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">Sin ajustes registrados este mes.</div>
        ) : (
          <div className="divide-y">
            <div className="grid grid-cols-12 text-xs font-medium text-slate-500 px-4 py-2">
              <div className="col-span-3">Fecha</div>
              <div className="col-span-5">Detalle</div>
              <div className="col-span-2">Usuario</div>
              <div className="col-span-1 text-right">Monto</div>
              <div className="col-span-1 text-right">Acción</div>
            </div>

            {ajustesMesItems.map((a) => (
              <div key={a.id} className="grid grid-cols-12 items-center text-sm px-4 py-3">
                <div className="col-span-3">{a.createdISO ? new Date(a.createdISO).toLocaleString() : "—"}</div>
                <div className="col-span-5">{a.label || "Ajuste"}</div>
                <div className="col-span-2">{a.actor ? a.actor : "—"}</div>
                <div
                  className={`col-span-1 text-right font-semibold ${
                    a.amount >= 0 ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {a.amount >= 0 ? "+" : "-"}
                  {currency(Math.abs(a.amount))}
                </div>
                <div className="col-span-1 text-right">
                  <button
                    onClick={() => eliminarAjuste(a.id)}
                    className="px-2 py-1.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-500">
        El día 5 se guarda el corte y se reinician los ajustes para comenzar el nuevo periodo. El monto del corte queda en “Listo para enviar” para registrar envíos parciales.
      </p>
    </div>
  );
}
