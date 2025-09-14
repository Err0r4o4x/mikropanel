"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getRole, PERM, getCurrentUser, isAdminUser } from "@/lib/admin";
import { Plus, CheckCheck, Package, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { useEquipos } from "@/hooks/useSupabaseData";

/* ===== LocalStorage keys ===== */
const LS_ENVIOS  = "app_envios";

/* ===== Tipos ===== */
type EstadoEquipo =
  | { tipo: "disponible" }
  | { tipo: "vendido";  fechaISO: string }
  | { tipo: "asignado"; fechaISO: string; clienteId: string; clienteNombre: string };

type Equipo = {
  id: string;
  etiqueta: string;
  precio_usd?: number;
  estado_tipo: string;
  estado_fecha?: string;
  estado_cliente_id?: string;
  estado_cliente_nombre?: string;
  placeholder?: boolean;
  created_at: string;
};

type EnvioItem = { key: string; display: string; qty: number };
type Envio = {
  id: string;
  created_iso: string;
  created_by: string;
  items: EnvioItem[];
  status: "en_camino" | "disponible" | "recogido";
  arrived_iso?: string;
  picked_iso?: string;
  picked_by?: string;
  inventory_added?: boolean; // evita doble-suma
};

/* ===== Helpers ===== */
const nowISO = (): string => new Date().toISOString();

/** Grupos desde inventario (incluye placeholders) */
const readGrupos = (equiposList: Equipo[]): { key: string; display: string }[] => {
  try {
    const map = new Map<string, string>();
    for (const e of equiposList) {
      const k = e.etiqueta.trim().toLowerCase();
      const d = e.etiqueta.trim();
      if (!map.has(k)) map.set(k, d);
    }
    return Array.from(map, ([key, display]) => ({ key, display }))
      .sort((a, b) => a.display.localeCompare(b.display));
  } catch {
    return [];
  }
};

/** Suma unidades al inventario */
const addToInventory = async (items: EnvioItem[], equiposList: Equipo[], setEquiposFn: (equipos: Equipo[]) => Promise<void>) => {
  try {
    const now = nowISO();
    const next = equiposList.slice();
    for (const it of items) {
      for (let i = 0; i < it.qty; i++) {
        next.unshift({
          id: crypto.randomUUID(),
          etiqueta: it.display,
          estado_tipo: "disponible",
          created_at: now,
        });
      }
    }
    await setEquiposFn(next);
  } catch {}
};

/** Resta unidades disponibles del inventario */
type SubtractResult =
  | { ok: true }
  | { ok: false; missing: Array<{ key: string; display: string; falta: number }> };

function isSubtractFail(r: SubtractResult): r is Extract<SubtractResult, { ok: false }> {
  return r.ok === false;
}

const subtractFromInventory = async (items: EnvioItem[], equiposList: Equipo[], setEquiposFn: (equipos: Equipo[]) => Promise<void>): Promise<SubtractResult> => {
  try {
    const disponiblesPorKey = new Map<string, number>();
    for (const e of equiposList) {
      if (e.estado_tipo !== "disponible" || e.placeholder) continue;
      const k = e.etiqueta.trim().toLowerCase();
      disponiblesPorKey.set(k, (disponiblesPorKey.get(k) || 0) + 1);
    }

    const faltantes: Array<{ key: string; display: string; falta: number }> = [];
    for (const it of items) {
      const have = disponiblesPorKey.get(it.key) || 0;
      if (have < it.qty) faltantes.push({ key: it.key, display: it.display, falta: it.qty - have });
    }
    if (faltantes.length) return { ok: false, missing: faltantes };

    const remainingByKey = new Map(items.map(it => [it.key, it.qty]));
    const next: Equipo[] = [];
    for (const e of equiposList) {
      const k = e.etiqueta.trim().toLowerCase();
      const need = remainingByKey.get(k) || 0;
      if (need > 0 && e.estado_tipo === "disponible" && !e.placeholder) {
        remainingByKey.set(k, need - 1);
        continue;
      }
      next.push(e);
    }
    await setEquiposFn(next);
    return { ok: true };
  } catch {
    return { ok: false, missing: items.map(it => ({ key: it.key, display: it.display, falta: it.qty })) };
  }
};

/* ===== Página ===== */
export default function EnviosPage() {
  const role = getRole();
  const isAdmin = isAdminUser(getCurrentUser());
  const canCrear       = PERM.crearEnvio(role);
  const canDisponible  = PERM.marcarDisponible(role);
  const canRecoger     = PERM.recogerEnvio(role);

  // Datos directos de Supabase
  const [equipos, setEquipos, equiposLoading] = useEquipos();
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [grupos, setGrupos] = useState<{ key: string; display: string }[]>([]);
  
  // Estado de carga
  const isLoading = equiposLoading;

  // Modal crear
  const [openNew, setOpenNew] = useState(false);
  const [rowsNew, setRowsNew] = useState<{ key: string; display: string; qty: string; checked: boolean }[]>([]);

  // Modal editar
  const [openEdit, setOpenEdit] = useState(false);
  const [editId, setEditId] = useState<string>("");
  const [rowsEdit, setRowsEdit] = useState<{ key: string; display: string; qty: string; checked: boolean }[]>([]);

  /* Cargar */
  useEffect(() => {
    if (equiposLoading) return;
    
    try {
      const raw = localStorage.getItem(LS_ENVIOS);
      const list: Envio[] = raw ? JSON.parse(raw) : [];
      setEnvios(Array.isArray(list) ? list : []);
    } catch {}
    setGrupos(readGrupos(equipos));
  }, [equiposLoading, equipos]);

  /* Sync por storage */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_ENVIOS && e.newValue != null) {
        try { setEnvios(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* ===== Crear ===== */
  const openNuevo = () => {
    if (!canCrear) return;
    setRowsNew(grupos.map(g => ({ key: g.key, display: g.display, qty: "0", checked: false })));
    setOpenNew(true);
  };
  const submitNuevo = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canCrear) return;
    const toSend: EnvioItem[] = rowsNew
      .filter(r => r.checked && Number(r.qty) > 0)
      .map(r => ({ key: r.key, display: r.display, qty: Math.floor(Number(r.qty)) }));

    if (!toSend.length) return alert("Selecciona al menos un equipo con cantidad > 0.");

    const u = getCurrentUser();
    const nuevo: Envio = {
      id: crypto.randomUUID(),
      created_iso: nowISO(),
      created_by: (u?.username || "admin").toString(),
      items: toSend,
      status: "en_camino",
      inventory_added: false,
    };
    const next = [nuevo, ...envios] as Envio[];
    setEnvios(next);
    localStorage.setItem(LS_ENVIOS, JSON.stringify(next));
    window.dispatchEvent(new StorageEvent("storage", { key: LS_ENVIOS, newValue: JSON.stringify(next) }));
    setOpenNew(false);
  };

  /* ===== Editar ===== */
  function openEditar(e: Envio) {
    if (!isAdmin) return;
    setEditId(e.id);
    const map = new Map<string, number>();
    for (const it of e.items) map.set(it.key, (map.get(it.key) || 0) + it.qty);
    const base = readGrupos(equipos);
    setRowsEdit(
      base.map(g => ({
        key: g.key,
        display: g.display,
        checked: map.has(g.key),
        qty: String(map.get(g.key) || 0),
      }))
    );
    setOpenEdit(true);
  }
  async function submitEditar(e?: React.FormEvent) {
    e?.preventDefault();
    if (!isAdmin) return;

    const toItems: EnvioItem[] = rowsEdit
      .filter(r => r.checked && Number(r.qty) > 0)
      .map(r => ({ key: r.key, display: r.display, qty: Math.floor(Number(r.qty)) }));

    const current = envios.find(x => x.id === editId);
    if (!current) return;

    // Manejar cambios de inventario si está recogido
    if (current.status === "recogido") {
      const mapOld = new Map(current.items.map(i => [i.key, i.qty]));
      const keys = new Set<string>([...current.items.map(i=>i.key), ...toItems.map(i=>i.key)]);
      const toAdd: EnvioItem[] = [];
      const toSub: EnvioItem[] = [];

      keys.forEach(k => {
        const oldQ = mapOld.get(k) || 0;
        const newQ = (toItems.find(i=>i.key===k)?.qty) || 0;
        const display = (toItems.find(i=>i.key===k)?.display) || (current.items.find(i=>i.key===k)?.display) || k;
        const diff = newQ - oldQ;
        if (diff > 0) toAdd.push({ key:k, display, qty: diff });
        if (diff < 0) toSub.push({ key:k, display, qty: -diff });
      });

      if (toSub.length) {
        const res = await subtractFromInventory(toSub, equipos, setEquipos);
        if (isSubtractFail(res)) {
          alert(
            "No hay stock disponible para restar estas cantidades:\n" +
            res.missing.map(m => `• ${m.display}: ${m.falta}`).join("\n")
          );
          return;
        }
      }
      if (toAdd.length) await addToInventory(toAdd, equipos, setEquipos);
    }

    // Actualizar el envío
    const next: Envio[] = envios.map(x =>
      x.id === editId ? ({ ...x, items: toItems } as Envio) : x
    );
    
    localStorage.setItem(LS_ENVIOS, JSON.stringify(next));
    window.dispatchEvent(new StorageEvent("storage", { key: LS_ENVIOS, newValue: JSON.stringify(next) }));
    setEnvios(next);

    setOpenEdit(false);
  }

  /* ===== Cambios de estado ===== */
  const marcarDisponible = (id: string) => {
    if (!canDisponible) return;
    setEnvios(prev => {
      const next: Envio[] = prev.map(e =>
        e.id === id ? ({ ...e, status: "disponible", arrived_iso: nowISO() } as Envio) : e
      );
      localStorage.setItem(LS_ENVIOS, JSON.stringify(next));
      window.dispatchEvent(new StorageEvent("storage", { key: LS_ENVIOS, newValue: JSON.stringify(next) }));
      return next;
    });
  };

  // Evita doble suma, incluso con 2 pestañas
  const marcarRecogido = async (id: string) => {
    if (!canRecoger) return;

    try {
      const raw = localStorage.getItem(LS_ENVIOS);
      const list: Envio[] = raw ? JSON.parse(raw) : [];
      const idx = list.findIndex(e => e.id === id);
      if (idx < 0) return;

      const env = list[idx];
      if (env.status === "recogido" && env.inventory_added) return;

      const u = getCurrentUser();
      const alreadyAdded = Boolean(env.inventory_added);

      const updated: Envio = {
        ...env,
        status: "recogido",
        picked_iso: nowISO(),
        picked_by: (u?.username || "tech").toString(),
        inventory_added: true,
      };
      const next: Envio[] = list.slice();
      next[idx] = updated;

      localStorage.setItem(LS_ENVIOS, JSON.stringify(next));
      window.dispatchEvent(new StorageEvent("storage", { key: LS_ENVIOS, newValue: JSON.stringify(next) }));
      setEnvios(next);

      if (!alreadyAdded) await addToInventory(env.items, equipos, setEquipos);
    } catch {}
  };

  /* ===== Eliminar ===== */
  async function eliminarEnvio(id: string) {
    if (!isAdmin) return;
    const env = envios.find(e => e.id === id);
    if (!env) return;
    if (!confirm("¿Eliminar este envío?")) return;

    if (env.status === "recogido") {
      const res = await subtractFromInventory(env.items, equipos, setEquipos); // rollback stock
      if (isSubtractFail(res)) {
        alert(
          "No se puede eliminar: faltan unidades disponibles para revertir este envío.\n" +
          res.missing.map(m => `• ${m.display}: ${m.falta}`).join("\n")
        );
        return;
      }
    }

    const next = envios.filter(e => e.id !== id) as Envio[];
    setEnvios(next);
    localStorage.setItem(LS_ENVIOS, JSON.stringify(next));
    window.dispatchEvent(new StorageEvent("storage", { key: LS_ENVIOS, newValue: JSON.stringify(next) }));
  }

  /* ===== Vistas ===== */
  const enCamino    = envios.filter(e => e.status === "en_camino");
  const disponibles = envios.filter(e => e.status === "disponible");
  const historial   = envios.filter(e => e.status === "recogido");

  // Mostrar pantalla de carga
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando envíos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Envíos</h1>
          <p className="text-xs text-slate-500">Crea envíos, marca llegada y retiro</p>
        </div>
        {canCrear && (
          <button
            onClick={openNuevo}
            className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Gestión envío
          </button>
        )}
      </div>

      <Section title="En camino" empty="No hay envíos en camino.">
        {enCamino.map(e => (
          <EnvioCard key={e.id} e={e}>
            <div className="flex gap-2">
              {canDisponible && (
                <button
                  onClick={() => marcarDisponible(e.id)}
                  className="px-3 py-2 rounded bg-amber-600 hover:bg-amber-700 text-white text-sm inline-flex items-center gap-2"
                  title="Marcar disponible en depósito"
                >
                  <Package className="h-4 w-4" />
                  Disponible
                </button>
              )}
              {isAdmin && (
                <>
                  <button
                    onClick={() => openEditar(e)}
                    className="px-3 py-2 rounded bg-slate-200 hover:bg-slate-300 text-slate-900 text-sm inline-flex items-center gap-2"
                    title="Editar envío"
                  >
                    <Pencil className="h-4 w-4" /> Editar
                  </button>
                  <button
                    onClick={() => eliminarEnvio(e.id)}
                    className="px-3 py-2 rounded bg-rose-100 hover:bg-rose-200 text-rose-700 text-sm inline-flex items-center gap-2"
                    title="Eliminar envío"
                  >
                    <Trash2 className="h-4 w-4" /> Eliminar
                  </button>
                </>
              )}
            </div>
          </EnvioCard>
        ))}
      </Section>

      <Section title="Disponibles" empty="No hay envíos disponibles.">
        {disponibles.map(e => (
          <EnvioCard key={e.id} e={e}>
            <div className="flex gap-2">
              {canRecoger && (
                <button
                  onClick={() => marcarRecogido(e.id)}
                  className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm inline-flex items-center gap-2"
                  title="Marcar recogido por técnicos"
                >
                  <CheckCheck className="h-4 w-4" />
                  Recogido
                </button>
              )}
              {isAdmin && (
                <>
                  <button
                    onClick={() => openEditar(e)}
                    className="px-3 py-2 rounded bg-slate-200 hover:bg-slate-300 text-slate-900 text-sm inline-flex items-center gap-2"
                    title="Editar envío"
                  >
                    <Pencil className="h-4 w-4" /> Editar
                  </button>
                  <button
                    onClick={() => eliminarEnvio(e.id)}
                    className="px-3 py-2 rounded bg-rose-100 hover:bg-rose-200 text-rose-700 text-sm inline-flex items-center gap-2"
                    title="Eliminar envío"
                  >
                    <Trash2 className="h-4 w-4" /> Eliminar
                  </button>
                </>
              )}
            </div>
          </EnvioCard>
        ))}
      </Section>

      <Section title="Historial" empty="Sin historial.">
        {historial.map(e => (
          <EnvioCard key={e.id} e={e} compact>
            {isAdmin && (
              <div className="flex gap-2">
                <button
                  onClick={() => openEditar(e)}
                  className="px-3 py-2 rounded bg-slate-200 hover:bg-slate-300 text-slate-900 text-sm inline-flex items-center gap-2"
                  title="Editar envío"
                >
                  <Pencil className="h-4 w-4" /> Editar
                </button>
                <button
                  onClick={() => eliminarEnvio(e.id)}
                  className="px-3 py-2 rounded bg-rose-100 hover:bg-rose-200 text-rose-700 text-sm inline-flex items-center gap-2"
                  title="Eliminar envío (con rollback)"
                >
                  <Trash2 className="h-4 w-4" /> Eliminar
                </button>
              </div>
            )}
          </EnvioCard>
        ))}
      </Section>

      {/* ===== Modal: Crear envío ===== */}
      {openNew && (
        <Modal onClose={() => setOpenNew(false)} title="¿Qué enviamos hoy?">
          <form onSubmit={submitNuevo} className="space-y-3">
            <ItemGrid rows={rowsNew} setRows={setRowsNew} placeholder="0" />
            <FooterButtons onCancel={() => setOpenNew(false)} submitLabel="Crear envío" />
          </form>
        </Modal>
      )}

      {/* ===== Modal: Editar envío ===== */}
      {openEdit && (
        <Modal onClose={() => setOpenEdit(false)} title="Editar envío">
          <form onSubmit={submitEditar} className="space-y-3">
            <ItemGrid rows={rowsEdit} setRows={setRowsEdit} placeholder="0" />
            <FooterButtons onCancel={() => setOpenEdit(false)} submitLabel="Guardar cambios" />
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ====== UI helpers ====== */
function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const has = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="space-y-2">
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      <div className="rounded-2xl border bg-white overflow-hidden">
        {has ? children : <div className="p-4 text-sm text-slate-500">{empty}</div>}
      </div>
    </section>
  );
}

function EnvioCard({
  e,
  compact,
  children,
}: {
  e: Envio;
  compact?: boolean;
  children?: ReactNode;
}) {
  const totalUnidades = useMemo(() => e.items.reduce((s, it) => s + it.qty, 0), [e.items]);
  return (
    <div className="px-4 py-3 border-b last:border-b-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2
            className={`h-4 w-4 ${
              e.status === "recogido" ? "text-emerald-600" : e.status === "disponible" ? "text-amber-600" : "text-slate-400"
            }`}
          />
          <div className="font-medium">
            {new Date(e.created_iso).toLocaleString()} · {totalUnidades} unidad{totalUnidades === 1 ? "" : "es"}
          </div>
        </div>
        {/* Antes ocultábamos children si compact. Ahora SIEMPRE los mostramos. */}
        {children && !compact && <div>{children}</div>}
      </div>

      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-slate-700">
        {e.items.map((it) => (
          <div key={it.key} className="flex items-center justify-between rounded border px-2 py-1">
            <span>{it.display}</span>
            <span className="font-semibold">x{it.qty}</span>
          </div>
        ))}
      </div>

      {/* En modo compacto, renderizamos acciones debajo para que siempre se vean en Historial */}
      {children && compact && (
        <div className="mt-3 flex flex-wrap gap-2 justify-end">
          {children}
        </div>
      )}
    </div>
  );
}

/* ====== Modal + grids ====== */
function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[92vw] max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="text-lg font-semibold mb-3">{title}</div>
        {children}
      </div>
    </div>
  );
}

function ItemGrid({
  rows,
  setRows,
  placeholder = "",
}: {
  rows: { key: string; display: string; qty: string; checked: boolean }[];
  setRows: React.Dispatch<React.SetStateAction<{ key: string; display: string; qty: string; checked: boolean }[]>>;
  placeholder?: string;
}) {
  return (
    <div className="max-h-[55vh] overflow-auto space-y-3 pr-1 -mr-1">
      {rows.map((r, idx) => (
        <label key={r.key} className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              className="w-5 h-5"
              checked={r.checked}
              onChange={(e) => setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, checked: e.target.checked } : x)))}
            />
            <span className="font-medium">{r.display}</span>
          </div>
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            min={0}
            step={1}
            placeholder={placeholder ?? ""}
            className="w-24 border rounded px-2 py-2 text-right text-base"
            value={r.qty}
            onChange={(e) => setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)))}
          />
        </label>
      ))}
      {rows.length === 0 && <div className="text-sm text-slate-500">No hay equipos registrados aún.</div>}
    </div>
  );
}

function FooterButtons({ onCancel, submitLabel }: { onCancel: () => void; submitLabel: string }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onCancel} className="px-3 py-2 rounded border">
        Cancelar
      </button>
      <button type="submit" className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white">
        {submitLabel}
      </button>
    </div>
  );
}
