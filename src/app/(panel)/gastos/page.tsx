"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { getRole } from "@/lib/admin";
import { getCurrentUser, isAdminUser } from "@/lib/admin";
import { useGastos } from "@/hooks/useSupabaseData";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

/* ===== LS keys ===== */
const LS_AJUSTES = "app_cobros_ajustes";

/* ===== Helpers ===== */
const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const monthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/* ===== Tipos ===== */
type Gasto = {
  id: string;
  fecha: string;
  motivo: string;
  monto_usd: number;
  usuario: string;
};

type Ajuste = {
  id: string;
  yyyymm: string;
  amount: number;        // negativo para gasto
  label: string;         // "Gasto: ..."
  createdISO: string;
  actor?: string;
  meta?: { type?: "gasto"; gastoId?: string; carryPrevOn7?: boolean };
};

export default function GastosPage() {
  // Datos directos de Supabase
  const [gastos, setGastos, gastosLoading] = useGastos();
  const loaded = !gastosLoading;
  const role = getRole();
  const canCreateGasto = role !== "envios"; // envios NO puede crear gastos

  const [q, setQ] = useState("");
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");

  const dlgRef = useRef<HTMLDialogElement | null>(null);
  const [motivo, setMotivo] = useState("");
  const [monto, setMonto] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    const upd = () => setIsAdmin(isAdminUser(getCurrentUser()));
    upd();
    const onStorage = (e: StorageEvent) => { if (e.key === "app_user") upd(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Los datos se cargan automáticamente con hooks de Supabase

  function openDialog() {
    setMotivo(""); setMonto(""); setFormErr(null);
    dlgRef.current?.showModal();
  }
  const closeDialog = () => dlgRef.current?.close();

  // Helpers ajustes
  const readAjustes = (): Ajuste[] => {
    try {
      const raw = localStorage.getItem(LS_AJUSTES);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  };
  const writeAjustes = (list: Ajuste[]) => {
    try { localStorage.setItem(LS_AJUSTES, JSON.stringify(list)); } catch {}
    // “despertar” Cobros en este mismo tab:
    document.dispatchEvent(new CustomEvent("ajustes-changed"));
    // y en otros tabs:
    window.dispatchEvent(new StorageEvent("storage", { key: LS_AJUSTES }));
  };

  async function submitGasto(e?: React.FormEvent) {
    e?.preventDefault();
    setFormErr(null);

    const motivoTrim = motivo.trim();
    const montoNum = Number(monto);
    if (!motivoTrim) return setFormErr("Indica el motivo del gasto.");
    if (!Number.isFinite(montoNum) || montoNum <= 0) return setFormErr("Cantidad inválida.");

    const user = getCurrentUser();
    const username = (user?.username || user?.name || "Invitado").toString().toLowerCase();

    const nuevo: Gasto = {
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      motivo: motivoTrim,
      monto_usd: Math.round(montoNum * 100) / 100,
      usuario: username,
    };

    // 1) guardar gasto
    const next = [nuevo, ...gastos];
    await setGastos(next);

    // 2) crear/actualizar ajuste negativo persistido
    const ajustes = readAjustes().filter((a) => a.id !== `gasto-${nuevo.id}`);
    ajustes.push({
      id: `gasto-${nuevo.id}`,
      yyyymm: monthKey(new Date(nuevo.fecha)),
      amount: -Math.abs(nuevo.monto_usd),
      label: `Gasto: ${nuevo.motivo}`,
      createdISO: nuevo.fecha,
      actor: nuevo.usuario,
      meta: { type: "gasto", gastoId: nuevo.id, carryPrevOn7: true },
    });
    writeAjustes(ajustes);

    closeDialog();
  }

  async function deleteGasto(id: string) {
    if (!isAdmin) return;
    if (!confirm("¿Eliminar este gasto del historial?")) return;

    const next = gastos.filter((g) => g.id !== id);
    await setGastos(next);

    // borrar el ajuste asociado
    const ajustes = readAjustes().filter(
      (a) => !(a.meta?.type === "gasto" && a.meta?.gastoId === id)
    );
    writeAjustes(ajustes);
  }

  // ==== filtro & gráfico (tu UI tal cual) ====
  const filtrados = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const dFrom = desde ? new Date(desde + "T00:00:00") : null;
    const dTo = hasta ? new Date(hasta + "T23:59:59.999") : null;

    return gastos
      .filter((g) => {
        if (ql) {
          const hay = g.motivo.toLowerCase().includes(ql) || g.usuario.toLowerCase().includes(ql);
          if (!hay) return false;
        }
        const f = new Date(g.fecha);
        if (dFrom && f < dFrom) return false;
        if (dTo && f > dTo) return false;
        return true;
      })
      .sort((a, b) => +new Date(b.fecha) - +new Date(a.fecha));
  }, [gastos, q, desde, hasta]);

  const totalFiltrado = useMemo(
    () => filtrados.reduce((acc, g) => acc + g.monto_usd, 0), [filtrados]
  );

  const dataBar = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of gastos) {
      const d = new Date(g.fecha);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, (map.get(key) ?? 0) + g.monto_usd);
    }
    const today = new Date();
    const items: { ym: string; label: string; total: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const dt = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      const total = map.get(key) ?? 0;
      const label = dt.toLocaleDateString("es-ES", { month: "short" }) + " " + String(dt.getFullYear()).slice(-2);
      items.push({ ym: key, label, total: Math.round(total * 100) / 100 });
    }
    return items;
  }, [gastos]);

  const totalMeses = useMemo(() => dataBar.reduce((a, m) => a + m.total, 0), [dataBar]);

  // Mostrar pantalla de carga
  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando gastos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* filtros + botón */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm mb-4">
        <div className="grid grid-cols-12 items-center gap-3">
          <div className="col-span-12 md:col-span-6">
            <input className="w-full border rounded px-3 py-2" placeholder="Ej. caja de cables, switch…"
              value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="col-span-6 md:col-span-2">
            <label className="block text-xs text-slate-500">Desde</label>
            <input type="date" className="w-full border rounded px-3 py-2"
              value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="col-span-6 md:col-span-2">
            <label className="block text-xs text-slate-500">Hasta</label>
            <input type="date" className="w-full border rounded px-3 py-2"
              value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div className="col-span-12 md:col-span-2 flex items-end justify-between md:justify-end gap-3">
            <div className="text-right">
              <div className="text-xs text-slate-500">Total</div>
              <div className="font-semibold">{currency(totalFiltrado)}</div>
            </div>
            {canCreateGasto && (
            <button onClick={openDialog}
              className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow inline-flex items-center gap-2">
              <Plus className="h-4 w-4" /> Añadir gasto
            </button>
           )}
          </div>
        </div>
      </div>

      {/* tabla */}
      <div className="rounded-2xl border bg-white overflow-hidden shadow-sm">
        <div className="grid grid-cols-12 text-sm font-medium text-slate-600 px-4 py-2 border-b">
          <div className="col-span-3">Fecha</div>
          <div className="col-span-4">Motivo</div>
          <div className="col-span-2">Usuario</div>
          <div className="col-span-2 text-right">Monto</div>
          {isAdmin && <div className="col-span-1 text-right">Acción</div>}
        </div>
        {filtrados.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">Sin gastos.</div>
        ) : filtrados.map((g) => (
          <div key={g.id} className="grid grid-cols-12 items-center text-sm px-4 py-3 border-b last:border-b-0">
            <div className="col-span-3">
              {new Date(g.fecha).toLocaleString()}
              <div className="text-xs text-slate-500">{g.fecha.slice(0, 10)}</div>
            </div>
            <div className="col-span-4 truncate">{g.motivo}</div>
            <div className="col-span-2">{g.usuario}</div>
            <div className="col-span-2 text-right font-medium">{currency(g.monto_usd)}</div>
            {isAdmin && (
              <div className="col-span-1 text-right">
                <button onClick={() => deleteGasto(g.id)}
                  className="px-2 py-1.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs inline-flex items-center gap-1">
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* gráfico */}
      <div className="mt-8 rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Gasto por mes (últimos 12)</h3>
          <div className="text-xs text-slate-500">Total: <span className="font-medium">{currency(totalMeses)}</span></div>
        </div>
        <div className="mx-auto max-w-[980px]">
          <div className="w-full h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataBar} margin={{ top: 10, right: 10, bottom: 24, left: 10 }}>
                <defs>
                  <linearGradient id="gastoBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" />
                    <stop offset="100%" stopColor="#2563eb" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} tickMargin={10} />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} tickFormatter={(v) => `$${v}`} width={56} />
                <Tooltip formatter={(v: number) => [currency(v), "Gasto mensual"]} labelFormatter={(l) => `Mes: ${l}`} />
                <Legend />
                <Bar dataKey="total" name="Gasto mensual" fill="url(#gastoBar)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* modal */}
      <dialog ref={dlgRef} className="rounded-xl p-0 w-[92vw] max-w-md backdrop:bg-black/30">
        <form method="dialog" onSubmit={submitGasto} className="p-5 bg-white rounded-xl">
          <div className="text-lg font-semibold mb-3">Añadir gasto</div>
          {formErr && <div className="text-red-600 text-sm mb-2">{formErr}</div>}
          <div className="space-y-3">
            <label className="grid grid-cols-4 items-center gap-2">
              <span className="col-span-1">Motivo</span>
              <input className="col-span-3 border rounded px-3 py-2" value={motivo} onChange={(e) => setMotivo(e.target.value)} required />
            </label>
            <label className="grid grid-cols-4 items-center gap-2">
              <span className="col-span-1">Cantidad ($)</span>
              <input className="col-span-3 border rounded px-3 py-2" type="number" min={1} step={0.01}
                value={monto} onChange={(e) => setMonto(e.target.value)} required />
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={closeDialog} className="px-3 py-2 rounded border">Cancelar</button>
            <button type="submit" className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white">Guardar</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
