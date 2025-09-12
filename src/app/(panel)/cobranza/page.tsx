"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CheckCircle2 } from "lucide-react";
import { getCurrentUser, isAdminUser } from "@/lib/admin";

/* ===== Storage keys ===== */
const LS_CLIENTES = "app_clientes";
const LS_TARIFAS = "app_tarifas";
const LS_ZONAS = "app_zonas";
const LS_COBROS_MES = "app_cobros_mes";
const LS_FORCE_COBRANZA = "app_force_cobranza";

type Zona = { id: string; nombre: string };

type Cliente = {
  id: string;
  nombre: string;
  zona: string; // zona id
  servicio: number; // Mb
  activo: boolean;
};

type CobroItem = {
  id: string;         // yyyymm-clienteId
  clienteId: string;
  nombre: string;
  zona: string;       // zona id
  mb: number;
  tarifa: number;
  amount: number;     // mb * tarifa
  pagado: boolean;
};

function monthKey(d: Date | string = new Date()) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function currency(n?: number) {
  if (n == null) return "-";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

/** Construye el lote de cobranza (todos pagado=false) para el mes actual */
function buildBatch(): CobroItem[] {
  try {
    const rawC = localStorage.getItem(LS_CLIENTES);
    const rawT = localStorage.getItem(LS_TARIFAS);
    const clientes: Cliente[] = rawC ? JSON.parse(rawC) : [];
    const tarifas: Record<string, number> = rawT ? JSON.parse(rawT) : {};
    const activos = Array.isArray(clientes) ? clientes.filter((c) => c?.activo) : [];
    const yyyymm = monthKey();

    return activos.map((c) => {
      const mb = Number(c.servicio) || 0;
      const tarifa = Number(tarifas[c.zona] ?? 0);
      return {
        id: `${yyyymm}-${c.id}`,
        clienteId: c.id,
        nombre: c.nombre,
        zona: c.zona,
        mb,
        tarifa,
        amount: mb * tarifa,
        pagado: false,
      };
    });
  } catch {
    return [];
  }
}

export default function CobranzaPage() {
  const router = useRouter();
  const [items, setItems] = useState<CobroItem[]>([]);
  const [zonas, setZonas] = useState<Record<string, Zona>>({});
  const [q, setQ] = useState("");
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const isAdmin = useMemo(() => isAdminUser(getCurrentUser()), []);

  // Cargar/crear lote del mes (si no existe o si se forzó)
  useEffect(() => {
    try {
      // Zonas bonitos
      const rawZ = localStorage.getItem(LS_ZONAS);
      const zonasArr: Zona[] = rawZ ? JSON.parse(rawZ) : [];
      const zmap: Record<string, Zona> = {};
      zonasArr.forEach((z) => (zmap[z.id] = z));
      setZonas(zmap);
    } catch {}

    // Lote del mes
    try {
      const yyyymm = monthKey();
      const rawAll = localStorage.getItem(LS_COBROS_MES);
      const all = rawAll ? JSON.parse(rawAll) : {};
      const forced = localStorage.getItem(LS_FORCE_COBRANZA) === "1";

      let lote: CobroItem[] = Array.isArray(all?.[yyyymm]) ? all[yyyymm] : [];

      // si no existe lote o está forzado → reconstruimos con todos pagado=false
      if (!lote.length || forced) {
        lote = buildBatch();
        all[yyyymm] = lote;
        localStorage.setItem(LS_COBROS_MES, JSON.stringify(all));
      }

      setItems(lote);
    } catch {
      setItems([]);
    }

    // Escuchar cambios desde otras pestañas (cuando marcan cobros, etc.)
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_COBROS_MES) {
        try {
          const yyyymm = monthKey();
          const raw = e.newValue;
          const all = raw ? JSON.parse(raw) : {};
          const lote = Array.isArray(all?.[yyyymm]) ? all[yyyymm] : [];
          setItems(lote);
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Agrupar/filtrar
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? items.filter((i) => i.nombre.toLowerCase().includes(term)) : items;
  }, [items, q]);

  const grupos = useMemo(() => {
    const map = new Map<
      string,
      { zonaId: string; zonaNombre: string; clientes: CobroItem[]; total: number; cobrados: number; monto: number; montoCobrados: number }
    >();
    for (const i of filtered) {
      const zn = zonas[i.zona]?.nombre || i.zona;
      if (!map.has(i.zona)) map.set(i.zona, { zonaId: i.zona, zonaNombre: zn, clientes: [], total: 0, cobrados: 0, monto: 0, montoCobrados: 0 });
      const g = map.get(i.zona)!;
      g.clientes.push(i);
      g.total += 1;
      g.monto += i.amount;
      if (i.pagado) {
        g.cobrados += 1;
        g.montoCobrados += i.amount;
      }
    }
    for (const g of map.values()) g.clientes.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return Array.from(map.values()).sort((a, b) => a.zonaNombre.localeCompare(b.zonaNombre));
  }, [filtered, zonas]);

  const totales = useMemo(() => {
    const total = items.length;
    const cobrados = items.filter((i) => i.pagado).length;
    const monto = items.reduce((s, i) => s + i.amount, 0);
    const montoCobrados = items.filter((i) => i.pagado).reduce((s, i) => s + i.amount, 0);
    return { total, cobrados, monto, montoCobrados, allPaid: total > 0 && total === cobrados };
  }, [items]);

  function persist(next: CobroItem[]) {
    try {
      const yyyymm = monthKey();
      const rawAll = localStorage.getItem(LS_COBROS_MES);
      const all = rawAll ? JSON.parse(rawAll) : {};
      all[yyyymm] = next;
      localStorage.setItem(LS_COBROS_MES, JSON.stringify(all));
      // Notificar a Sidebar/otras pestañas
      window.dispatchEvent(new StorageEvent("storage", { key: LS_COBROS_MES, newValue: JSON.stringify(all) }));
    } catch {}
  }

  function setPagado(id: string, val: boolean) {
    setItems((prev) => {
      const next = prev.map((x) => (x.id === id ? { ...x, pagado: val } : x));
      persist(next);
      return next;
    });
  }

  // Cuando TODOS están pagados -> limpiar forzado, avisar y (si no admin) redirigir
  useEffect(() => {
    if (!totales.allPaid) return;
    try {
      localStorage.removeItem(LS_FORCE_COBRANZA); // para que tech/envíos ya no vean "Cobranza"
      window.dispatchEvent(new StorageEvent("storage", { key: LS_FORCE_COBRANZA }));
    } catch {}
    setDoneMsg("¡Todos los usuarios han sido registrados, muchas gracias!");
    if (!isAdmin) {
      const t = setTimeout(() => router.replace("/"), 2200);
      return () => clearTimeout(t);
    }
  }, [totales.allPaid, isAdmin, router]);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Mensaje de cierre cuando todo está cobrado */}
      {doneMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">{doneMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cobranza</h1>
          <p className="text-xs text-slate-500">Marca pagos del mes actual</p>
        </div>

        {/* Resumen mini */}
        <div className="text-right text-xs sm:text-sm text-slate-600">
          <div>
            {totales.cobrados}/{totales.total} cobrados
          </div>
          <div>
            {currency(totales.montoCobrados)} / {currency(totales.monto)}
          </div>
        </div>
      </div>

      {/* Buscador tocable */}
      <div className="relative">
        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          className="w-full pl-9 pr-3 py-3 rounded-xl border text-base"
          placeholder="Buscar cliente por nombre…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Zonas */}
      {grupos.length === 0 ? (
        <div className="text-sm text-slate-500">No hay clientes para cobrar.</div>
      ) : (
        <div className="space-y-6">
          {grupos.map((g) => (
            <section key={g.zonaId} className="rounded-2xl border bg-white overflow-hidden shadow-sm">
              {/* Cabecera zona */}
              <div className="px-4 py-3 bg-slate-50 border-b">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-800">{g.zonaNombre}</div>
                  <div className="text-xs text-slate-500">
                    {g.cobrados}/{g.total} · {currency(g.montoCobrados)} / {currency(g.monto)}
                  </div>
                </div>
              </div>

              {/* Clientes */}
              <div className="divide-y">
                {g.clientes.map((i) => (
                  <div key={i.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex-1 pr-3">
                      <div className="font-medium text-slate-900">{i.nombre}</div>
                      <div className="text-xs text-slate-500">
                        {i.mb} Mb · ${i.tarifa}/Mb
                      </div>
                    </div>

                    {/* MONTO grande + check */}
                    <div className="flex items-center gap-3">
                      <div className="text-lg sm:text-xl font-extrabold text-emerald-700 tabular-nums">
                        {currency(i.amount)}
                      </div>
                      <input
                        type="checkbox"
                        checked={i.pagado}
                        onChange={(e) => setPagado(i.id, e.target.checked)}
                        className="w-8 h-8 accent-emerald-600 cursor-pointer"
                        title="Marcar recibido"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="text-[11px] text-slate-500 text-center">
        Consejo: usa el buscador mientras cobras en la calle. Cuando todos estén pagados, esta pantalla se ocultará para técnicos.
      </p>
    </div>
  );
}
