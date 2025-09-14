"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Package2 } from "lucide-react";
import { getCurrentUser, isAdminUser, getRole, PERM } from "@/lib/admin";
import { useClientes, useEquipos, useMovimientos } from "@/hooks/useSupabaseData";

/* ===== LocalStorage keys ===== */
const LS_MOVS = "app_movimientos";
const LS_AJUSTES_COBROS = "app_cobros_ajustes";
const TOUCH_MOVS = "__touch_movs";

/* ===== Helpers ===== */
function prettyName(s: string) {
  if (!s) return s;
  const t = s.toString();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function currency(n?: number) {
  if (n == null) return "-";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
const isRouterName = (name?: string) => (name ?? "").trim().toLowerCase() === "router";
const isSwitchName = (name?: string) => (name ?? "").trim().toLowerCase() === "switch";
// Solo Router o Switch se pueden asignar
const isAssignable = (name?: string) => isRouterName(name) || isSwitchName(name);
const monthKey = (d: Date | string = new Date()) => {
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
};

/* ===== Tipos ===== */
type EstadoEquipo =
  | { tipo: "disponible" }
  | { tipo: "vendido"; fechaISO: string }
  | { tipo: "asignado"; fechaISO: string; clienteId: string; clienteNombre: string };

type Equipo = {
  id: string;
  etiqueta: string;
  categoria?: string;
  precioUSD?: number;
  estado: EstadoEquipo;
  creadoISO: string;
  placeholder?: boolean;
};


type MovimientoBase = {
  id: string;
  fechaISO: string;
  equipoId: string;
  equipoEtiqueta: string;
  actor: string;
};
type MovimientoVenta = MovimientoBase & { tipo: "venta" };
type MovimientoAsignacion = MovimientoBase & {
  tipo: "asignacion";
  clienteId: string;
  clienteNombre: string;
  pagado?: boolean; // solo router
};
type Movimiento = MovimientoVenta | MovimientoAsignacion;

type AjusteCobro = {
  id: string;
  yyyymm: string;
  amount: number;
  label: string;
  createdISO: string;
  actor?: string;
  ref?: { movId?: string; equipo?: string; type?: "manual" | "auto" };
};

/* ===== Regla de negocio ===== */
const AJUSTE_ROUTER_PAGADO_USD = 15;

/* ===== Página ===== */
export default function InventarioPage() {
  // Datos directos de Supabase
  const [equipos, setEquipos, equiposLoading] = useEquipos();
  const [movs, setMovs, movsLoading] = useMovimientos();
  const [clientes, , clientesLoading] = useClientes();
  
  // Estado de carga combinado
  const loaded = !equiposLoading && !movsLoading && !clientesLoading;

  // ==== Ganancia manual para VENTAS ====
  const dlgGananciaRef = useRef<HTMLDialogElement | null>(null);
  const [gananciaTarget, setGananciaTarget] = useState<MovimientoVenta | null>(null);
  const [gananciaValor, setGananciaValor] = useState("");
  const [errGanancia, setErrGanancia] = useState<string | null>(null);

  // Para evitar repetir ganancia manual sobre la misma venta
  const [manualGainSet, setManualGainSet] = useState<Set<string>>(new Set());

  function reloadManualGains() {
    try {
      const raw = localStorage.getItem(LS_AJUSTES_COBROS);
      if (!raw) { setManualGainSet(new Set()); return; }
      const list: AjusteCobro[] = JSON.parse(raw) || [];
      const ids = new Set<string>();
      for (const a of list) {
        if (a.ref?.movId && a.ref?.type === "manual") ids.add(a.ref.movId);
      }
      setManualGainSet(ids);
    } catch {
      setManualGainSet(new Set());
    }
  }

  // cargar al entrar y cuando cambien ajustes en otra pestaña
  useEffect(() => {
    reloadManualGains();
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_AJUSTES_COBROS || e.key === TOUCH_MOVS) reloadManualGains();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function abrirGanancia(m: MovimientoVenta) {
    if (!isAdmin) return;                       // solo admin
    if (manualGainSet.has(m.id)) return;        // ya tiene ganancia -> no abrir

    setGananciaTarget(m);
    setGananciaValor("");
    setErrGanancia(null);
    dlgGananciaRef.current?.showModal();
  }

  function submitGanancia(e?: React.FormEvent) {
    e?.preventDefault();
    if (!isAdmin) return;
    if (!gananciaTarget) return;

    const val = Number(gananciaValor);
    if (!Number.isFinite(val) || val < 0) {
      setErrGanancia("La ganancia debe ser un número positivo (>= 0).");
      return;
    }

    // evita duplicados por movId/type=manual
    try {
      const raw = localStorage.getItem(LS_AJUSTES_COBROS);
      const curr: AjusteCobro[] = raw ? JSON.parse(raw) : [];
      const exists = curr.some(a => a.ref?.movId === gananciaTarget.id && a.ref?.type === "manual");
      if (exists) {
        setErrGanancia("Esta venta ya tiene una ganancia registrada.");
        return;
      }

      const actor = (getCurrentUser()?.username || getCurrentUser()?.name || "admin").toString().toLowerCase();
      const nuevo: AjusteCobro = {
        id: `manual-${gananciaTarget.id}`,
        yyyymm: monthKey(gananciaTarget.fechaISO),
        amount: val,
        label: `Ganancia venta ${gananciaTarget.equipoEtiqueta}`,
        createdISO: new Date().toISOString(),
        actor,
        ref: { movId: gananciaTarget.id, equipo: gananciaTarget.equipoEtiqueta.trim().toLowerCase(), type: "manual" },
      };

      const next = [...curr, nuevo];
      localStorage.setItem(LS_AJUSTES_COBROS, JSON.stringify(next));
      localStorage.setItem(TOUCH_MOVS, String(Date.now())); // despierta Cobros
      reloadManualGains();
      dlgGananciaRef.current?.close();
    } catch {
      setErrGanancia("No se pudo guardar. Revisa el almacenamiento local.");
    }
  }

  // Roles / permisos
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<ReturnType<typeof getRole>>("");
  // const canCreateUsuario = role !== "envios"; // envios NO puede crear usuarios (no usado)
  useEffect(() => {
    const update = () => {
      setIsAdmin(isAdminUser(getCurrentUser()));
      setRole(getRole());
      // Permisos calculados pero no usados en este scope
      // const canNewEquipo     = PERM.newEquipo(role);          // solo admin
      // const canRegistrarMov  = PERM.registrarMov(role);       // admin | tech | envios
      // const canDeleteEquipo  = PERM.deleteEquipo(role);       // solo admin
      // const canDeleteMov     = role === "admin";              // borrar movimientos = solo admin
    };
    update();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "app_user") update();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [role]);

  const canNewEquipo = PERM.newEquipo(role);
  const canRegistrarMov = PERM.registrarMov(role);

  // Los datos se cargan automáticamente con hooks de Supabase

  /* ===== Ajuste auto +15 cuando Pagado = true (router asignado) ===== */
  function ensureAutoAjusteRouter15(movId: string, fechaISO: string) {
    try {
      const raw = localStorage.getItem(LS_AJUSTES_COBROS);
      const list: AjusteCobro[] = raw ? JSON.parse(raw) : [];
      const exists = list.some(a => a.ref?.movId === movId && a.ref?.type === "auto");
      if (exists) return;

      const actor = (getCurrentUser()?.username || getCurrentUser()?.name || "admin").toString().toLowerCase();
      const nuevo: AjusteCobro = {
        id: `auto-${movId}`,
        yyyymm: monthKey(fechaISO),
        amount: AJUSTE_ROUTER_PAGADO_USD,
        label: "Pago instalación Router (+15)",
        createdISO: new Date().toISOString(),
        actor,
        ref: { movId, equipo: "router", type: "auto" },
      };
      const next = [...list, nuevo];
      localStorage.setItem(LS_AJUSTES_COBROS, JSON.stringify(next));
      localStorage.setItem(TOUCH_MOVS, String(Date.now()));
    } catch {}
  }
  function removeAutoAjusteRouter15(movId: string) {
    try {
      const raw = localStorage.getItem(LS_AJUSTES_COBROS);
      const list: AjusteCobro[] = raw ? JSON.parse(raw) : [];
      const next = list.filter(a => !(a.ref?.movId === movId && a.ref?.type === "auto"));
      localStorage.setItem(LS_AJUSTES_COBROS, JSON.stringify(next));
      localStorage.setItem(TOUCH_MOVS, String(Date.now()));
    } catch {}
  }

  /* ===== Agrupar por etiqueta ===== */
  type Grupo = {
    key: string;
    display: string;
    cantidad: number; // disponibles
    asignadas: number; // en clientes
    precioUSD?: number;
    lastISO?: string;
    hasPlaceholder: boolean;
  };

  const grupos = useMemo<Grupo[]>(() => {
    const map = new Map<string, Grupo>();
    for (const e of equipos) {
      const key = e.etiqueta.trim().toLowerCase();
      const display = e.etiqueta.trim();

      if (!map.has(key)) {
        map.set(key, {
          key, display,
          cantidad: 0, asignadas: 0,
          precioUSD: e.precioUSD,
          lastISO: undefined,
          hasPlaceholder: false,
        });
      }
      const g = map.get(key)!;

      if (e.placeholder) {
        g.hasPlaceholder = true;
        if (g.precioUSD == null && e.precioUSD != null) g.precioUSD = e.precioUSD;
        g.lastISO = g.lastISO ?? e.creadoISO;
        continue;
      }

      const refISO =
        e.estado.tipo === "vendido" ? e.estado.fechaISO
        : e.estado.tipo === "asignado" ? e.estado.fechaISO
        : e.creadoISO;
      if (!g.lastISO || new Date(refISO).getTime() > new Date(g.lastISO).getTime()) {
        g.lastISO = refISO;
      }

      if (e.estado.tipo === "disponible") g.cantidad += 1;
      if (e.estado.tipo === "asignado") g.asignadas += 1;

      if (typeof e.precioUSD === "number") g.precioUSD = e.precioUSD;
    }
    return Array.from(map.values()).sort((a, b) => a.display.localeCompare(b.display));
  }, [equipos]);

  /* ===== Nuevo equipo ===== */
  const dlgNuevoRef = useRef<HTMLDialogElement | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoPrecio, setNuevoPrecio] = useState<string>("");
  const [errNuevo, setErrNuevo] = useState<string | null>(null);
  const openNuevo = () => {
    if (!canNewEquipo) return;
    setErrNuevo(null);
    setNuevoNombre("");
    setNuevoPrecio("");
    dlgNuevoRef.current?.showModal();
  };
  const closeNuevo = () => dlgNuevoRef.current?.close();
  const submitNuevo = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canNewEquipo) return;
    const name = nuevoNombre.trim();
    if (!name) {
      setErrNuevo("Escribe el nombre del equipo.");
      return;
    }
    const price = nuevoPrecio.trim() === "" ? undefined : Number(nuevoPrecio);
    if (price != null && (!Number.isFinite(price) || price < 0)) {
      setErrNuevo("Precio inválido.");
      return;
    }
    const now = new Date().toISOString();
    setEquipos((prev) => {
      const next = prev.filter((x) => !(x.placeholder && x.etiqueta.trim().toLowerCase() === name.toLowerCase()));
      next.unshift({
        id: crypto.randomUUID(),
        etiqueta: name,
        precioUSD: price,
        categoria: "general",
        estado: { tipo: "disponible" as const },
        creadoISO: now,
      });
      return next;
    });
    closeNuevo();
  };

  /* ===== Movimiento — modal ===== */
  const [movOpen, setMovOpen] = useState(false);
  const [movQty, setMovQty] = useState<string>("1");
  const [mov, setMov] = useState<{ key: string; display: string; tipo: "venta" | "asignacion"; clienteId?: string; pagado?: boolean }>(
    { key: "", display: "", tipo: "venta" }
  );
  const [errMov, setErrMov] = useState<string | null>(null);

  const openMovimientoGrupo = (g: Grupo) => {
    if (!canRegistrarMov) return;
    setErrMov(null);
    setMov({ key: g.key, display: g.display, tipo: "venta", clienteId: undefined, pagado: false });
    setMovQty("1");
    setMovOpen(true);
  };

  const closeMovimiento = () => setMovOpen(false);

  const submitMovimiento = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canRegistrarMov) return;

    const now = new Date().toISOString();
    const u = getCurrentUser();
    const actor = (u?.username || u?.name || "invitado").toString().toLowerCase();

    if (mov.tipo === "venta") {
      const qty = Math.max(1, Math.floor(Number(movQty || "1")));
      const availUnits = equipos.filter(
        (e) =>
          e.etiqueta.trim().toLowerCase() === mov.key &&
          e.estado.tipo === "disponible" &&
          !e.placeholder
      );

      if (availUnits.length === 0) {
        setErrMov("No hay unidades disponibles en este grupo.");
        return;
      }
      if (qty > availUnits.length) {
        setErrMov(`Solo hay ${availUnits.length} unidad(es) disponibles para vender.`);
        return;
      }

      // Crear N movimientos de venta y marcar N equipos como vendidos
      const picked = availUnits.slice(0, qty);
      const newMovs: Movimiento[] = picked.map((unit) => ({
        id: crypto.randomUUID(),
        fechaISO: now,
        equipoId: unit.id,
        equipoEtiqueta: unit.etiqueta,
        tipo: "venta",
        actor,
      }));

      const marked: Equipo[] = equipos.map((e) => {
        const idx = picked.findIndex(p => p.id === e.id);
        if (idx >= 0) return { ...e, estado: { tipo: "vendido" as const, fechaISO: now } };
        return e;
        });

      const nextMovs: Movimiento[] = [...newMovs, ...movs];
      await setMovs(nextMovs);
      await setEquipos(marked);
      setMovOpen(false);
      return;
    } else {
      // ASIGNACIÓN (1 unidad)
      const unit = equipos.find(
        (e) =>
          e.etiqueta.trim().toLowerCase() === mov.key &&
          e.estado.tipo === "disponible" &&
          !e.placeholder
      );
      if (!unit) {
        setErrMov("No hay unidades disponibles en este grupo.");
        return;
      }
      if (!isAssignable(unit.etiqueta)) {
        setErrMov("Solo se pueden asignar equipos de tipo Router o Switch.");
        return;
      }
      if (!mov.clienteId) {
        setErrMov("Selecciona un cliente para la asignación.");
        return;
      }
      const cliente = clientes.find((c) => c.id === mov.clienteId);
      const routerPagado = isRouterName(unit.etiqueta) ? Boolean(mov.pagado) : undefined;

      const movId = crypto.randomUUID();
      const newMov: MovimientoAsignacion = {
        id: movId,
        fechaISO: now,
        equipoId: unit.id,
        equipoEtiqueta: unit.etiqueta,
        tipo: "asignacion",
        clienteId: mov.clienteId!,
        clienteNombre: cliente?.nombre ?? "Desconocido",
        actor,
        pagado: routerPagado ?? undefined,
      };

      const nextMovs: Movimiento[] = [newMov, ...movs];
      const nextEquipos: Equipo[] = equipos.map((e) =>
        e.id === unit.id
          ? { ...e, estado: { tipo: "asignado" as const, fechaISO: now, clienteId: mov.clienteId!, clienteNombre: cliente?.nombre ?? "Desconocido" } }
          : e
      );
      await setMovs(nextMovs);
      await setEquipos(nextEquipos);

      // Si se marcó pagado en el modal y es router -> crea el +15
      if (isRouterName(unit.etiqueta) && routerPagado) {
        ensureAutoAjusteRouter15(movId, now);
      }
      // Switch es gratis: no se crea ajuste.
    }
    setMovOpen(false);
  };

  //* ===== Eliminar grupo (solo admin) ===== */
  const eliminarGrupo = (g: Grupo) => {
    if (!isAdmin) return;

    // Contar cuántos se eliminarían (solo los "disponible" del grupo)
    const eliminables = equipos.filter(
      (e) =>
        e.etiqueta.trim().toLowerCase() === g.key &&
        e.estado.tipo === "disponible" &&
        !e.placeholder
    ).length;

    if (eliminables === 0) {
      alert(`No hay unidades disponibles de "${g.display}" para eliminar.`);
      return;
    }

    const ok = confirm(
      `Vas a eliminar ${eliminables} unidad(es) DISPONIBLE(S) del grupo "${g.display}".\n` +
      `Los equipos vendid@s o asignad@s NO se tocan.\n\n¿Confirmas?`
    );
    if (!ok) return;

    setEquipos((prev) =>
      prev.filter((e) => {
        const same = e.etiqueta.trim().toLowerCase() === g.key;
        if (!same) return true;
        // Conserva vendidos/asignados; elimina disponibles
        return e.estado.tipo === "vendido" || e.estado.tipo === "asignado";
      })
    );
  };


  /* ===== Eliminar movimiento (revierte) ===== */
  const eliminarMovimiento = async (m: Movimiento) => {
    if (!isAdmin) return;
    if (!confirm("¿Eliminar este registro y revertir su efecto?")) return;

    // Revertir equipo -> disponible
    const nextEquipos: Equipo[] = equipos.map((e) =>
      e.id === m.equipoId ? { ...e, estado: { tipo: "disponible" as const } } : e
    );
    setEquipos(nextEquipos);

    // Eliminar mov
    const nextMovs: Movimiento[] = movs.filter((x) => x.id !== m.id);
    setMovs(nextMovs);

    // Eliminar ajustes vinculados (manual/auto) de ese movId
    removeAutoAjusteRouter15(m.id);
    try {
      await setEquipos(nextEquipos);
      await setMovs(nextMovs);
      // Además borra cualquier ajuste manual enlazado a movId (compatibilidad)
      const raw = localStorage.getItem(LS_AJUSTES_COBROS);
      const list: AjusteCobro[] = raw ? JSON.parse(raw) : [];
      const filtered = Array.isArray(list) ? list.filter((a) => a?.ref?.movId !== m.id) : [];
      localStorage.setItem(LS_AJUSTES_COBROS, JSON.stringify(filtered));
    } catch {}
  };

  /* ===== Filtros (historial) ===== */
  const [fUsuario, setFUsuario] = useState("");
  const [fTipo, setFTipo] = useState<"" | "venta" | "asignacion">("");
  const [fEquipo, setFEquipo] = useState("");
  const [fPagado, setFPagado] = useState<"" | "si" | "no">("");
  const [fDesde, setFDesde] = useState(""); // YYYY-MM-DD
  const [fHasta, setFHasta] = useState(""); // YYYY-MM-DD

  const filteredMovs = useMemo(() => {
    const norm = (s:string) => (s||"").trim().toLowerCase();
    const from = fDesde ? new Date(fDesde + "T00:00:00.000") : null;
    const to = fHasta ? new Date(fHasta + "T23:59:59.999") : null;

    return movs.filter((m) => {
      if (fUsuario && !norm(m.actor).includes(norm(fUsuario))) return false;
      if (fTipo && m.tipo !== fTipo) return false;
      if (fEquipo && !norm(m.equipoEtiqueta).includes(norm(fEquipo))) return false;

      const dt = new Date(m.fechaISO);
      if (from && dt < from) return false;
      if (to && dt > to) return false;

      if (fPagado) {
        const isRouterAsign = m.tipo === "asignacion" && isRouterName(m.equipoEtiqueta);
        if (!isRouterAsign) return false;
        const paid = Boolean((m as MovimientoAsignacion).pagado);
        if (fPagado === "si" && !paid) return false;
        if (fPagado === "no" && paid) return false;
      }
      return true;
    });
  }, [movs, fUsuario, fTipo, fEquipo, fPagado, fDesde, fHasta]);

  /* ===== UI ===== */
  
  // Mostrar pantalla de carga
  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando inventario...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Inventario</h1>
          <p className="text-xs text-slate-500">Gestión de equipos y movimientos</p>
        </div>
        {canNewEquipo && (
          <button
            onClick={openNuevo}
            className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow inline-flex items-center gap-2"
            title="Añadir nuevo equipo"
          >
            <Plus className="h-4 w-4" />
            Nuevo equipo
          </button>
        )}
      </div>

      {/* Tabla por grupos */}
      <div className="rounded-2xl border bg-white overflow-hidden shadow-sm">
        <div className="grid grid-cols-12 px-4 py-3 border-b bg-slate-50 text-sm font-semibold text-slate-700">
          <div className="col-span-4">Equipo</div>
          <div className="col-span-2">Disponibles</div>
          <div className="col-span-2">Estado</div>
          <div className="col-span-2">Precio</div>
          <div className="col-span-2 text-right">Acciones</div>
        </div>

        {grupos.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No hay equipos en esta vista.</div>
        ) : (
          grupos.map((g) => {
            const ultimaFecha = g.lastISO ? new Date(g.lastISO).toLocaleString() : "-";
            const disponible = g.cantidad > 0;
            return (
              <div
                key={g.key}
                className="grid grid-cols-12 items-center px-4 py-3 border-b last:border-b-0 text-sm hover:bg-slate-50/60 transition"
              >
                <div className="col-span-4 flex items-start gap-3">
                  <div className="mt-0.5">
                    <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">
                      <Package2 className="h-5 w-5 text-slate-600" />
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">{g.display}</div>
                    <div className="text-xs text-slate-500">Últ. movimiento: {ultimaFecha}</div>
                    {(g.asignadas ?? 0) > 0 && (
                      <div className="mt-1 text-[11px] text-slate-500">
                        En clientes: <span className="font-medium">{g.asignadas}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-span-2 font-medium">{g.cantidad}</div>

                <div className="col-span-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs ${
                      disponible ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-700 border-slate-300"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${disponible ? "bg-emerald-600" : "bg-slate-500"}`} />
                    {disponible ? "Disponible" : "Sin stock"}
                  </span>
                </div>

                <div className="col-span-2">{currency(g.precioUSD)}</div>

                <div className="col-span-2">
                  <div className="w-full flex justify-end gap-2 flex-wrap sm:flex-nowrap">
                    <button
                      onClick={() => openMovimientoGrupo(g)}
                      className={`px-3 py-1.5 rounded text-xs shrink-0 ${
                        canRegistrarMov && g.cantidad > 0 ? "bg-slate-200 hover:bg-slate-300 text-slate-900" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                      }`}
                      disabled={!canRegistrarMov || g.cantidad === 0}
                      title={
                        !canRegistrarMov
                          ? "Solo admin/tech pueden registrar movimientos"
                          : g.cantidad === 0
                          ? "Sin stock disponible"
                          : "Registrar movimiento"
                      }
                    >
                      Movimiento
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => eliminarGrupo(g)}
                        className="px-2 py-1.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs inline-flex items-center gap-1 shrink-0"
                        title="Eliminar disponibles del grupo (solo admin)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Historial */}
      <div className="rounded-2xl border bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b bg-slate-50 text-sm font-semibold text-slate-700">Historial de movimientos</div>

        {/* Filtros */}
        <div className="px-4 py-3 border-b bg-white/60">
          <div className="grid grid-cols-12 gap-2 items-end">
            <label className="col-span-2 text-xs">
              <div className="text-[11px] text-slate-500 mb-1">Usuario</div>
              <input
                value={fUsuario}
                onChange={(e)=>setFUsuario(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm"
                placeholder="usuario..."
              />
            </label>

            <label className="col-span-2 text-xs">
              <div className="text-[11px] text-slate-500 mb-1">Tipo</div>
              <select
                value={fTipo}
                onChange={(e)=>setFTipo(e.target.value as "" | "venta" | "asignacion")}
                className="w-full border rounded px-2 py-1.5 text-sm bg-white"
              >
                <option value="">Todos</option>
                <option value="venta">Venta</option>
                <option value="asignacion">Asignación</option>
              </select>
            </label>

            <label className="col-span-2 text-xs">
              <div className="text-[11px] text-slate-500 mb-1">Equipo</div>
              <input
                value={fEquipo}
                onChange={(e)=>setFEquipo(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm"
                placeholder="nombre equipo..."
              />
            </label>

            <label className="col-span-2 text-xs">
              <div className="text-[11px] text-slate-500 mb-1">Pagado (solo Router)</div>
              <select
                value={fPagado}
                onChange={(e)=>setFPagado(e.target.value as "" | "si" | "no")}
                className="w-full border rounded px-2 py-1.5 text-sm bg-white"
              >
                <option value="">Todos</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            </label>

            <label className="col-span-2 text-xs">
              <div className="text-[11px] text-slate-500 mb-1">Desde</div>
              <input
                type="date"
                value={fDesde}
                onChange={(e)=>setFDesde(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </label>

            <label className="col-span-2 text-xs">
              <div className="text-[11px] text-slate-500 mb-1">Hasta</div>
              <input
                type="date"
                value={fHasta}
                onChange={(e)=>setFHasta(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </label>
          </div>
        </div>

        {filteredMovs.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Sin movimientos (ajusta los filtros).</div>
        ) : (
          <>
            <div className="px-4 py-2 text-[11px] text-slate-500">
              Mostrando <span className="font-medium">{filteredMovs.length}</span> registro(s)
            </div>

            <div className="grid grid-cols-12 text-xs font-medium text-slate-500 px-4 py-2">
              <div className="col-span-3">Fecha</div>
              <div className="col-span-2">Equipo</div>
              <div className="col-span-2">Tipo</div>
              <div className="col-span-2">Cliente</div>
              <div className="col-span-1">Usuario</div>
              <div className="col-span-1 text-center">Pagado</div>
              <div className="col-span-1 text-right">Acción</div>
            </div>

            {filteredMovs.map((m) => (
              <div key={m.id} className="grid grid-cols-12 items-center text-sm px-4 py-3 border-t hover:bg-slate-50/60 transition">
                <div className="col-span-3 text-slate-700">{new Date(m.fechaISO).toLocaleString()}</div>
                <div className="col-span-2">{m.equipoEtiqueta}</div>
                <div className="col-span-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs ${
                      m.tipo === "venta" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${m.tipo === "venta" ? "bg-amber-600" : "bg-indigo-600"}`} />
                    {m.tipo === "venta" ? "Venta" : "Asignación"}
                  </span>
                </div>
                <div className="col-span-2">{m.tipo === "asignacion" ? (m as MovimientoAsignacion).clienteNombre || "—" : "—"}</div>
                <div className="col-span-1">{prettyName(m.actor)}</div>

                {/* Pagado (solo Router asignado) → crea/quita ajuste +15 */}
                <div className="col-span-1 text-center">
                  {m.tipo === "asignacion" && isRouterName(m.equipoEtiqueta) ? (
                    <input
                      type="checkbox"
                      checked={Boolean((m as MovimientoAsignacion).pagado)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const nextMovs: Movimiento[] = movs.map((x) =>
                          x.id === m.id ? ({ ...x, pagado: checked } as Movimiento) : x
                        );
                        setMovs(nextMovs);
                        try { localStorage.setItem(LS_MOVS, JSON.stringify(nextMovs)); } catch {}
                        localStorage.setItem(TOUCH_MOVS, String(Date.now()));
                        if (checked) ensureAutoAjusteRouter15(m.id, m.fechaISO);
                        else removeAutoAjusteRouter15(m.id);
                      }}
                      title="¿El cliente ya pagó el router? (sumará +15)"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </div>

                {/* Acciones */}
                <div className="col-span-1">
                  <div className="w-full flex justify-end gap-2">
                    {/* Botón GANANCIA: solo admin y solo en ventas */}
                    {m.tipo === "venta" && isAdmin && (() => {
                      const disabled = manualGainSet.has(m.id);
                      return (
                        <button
                          onClick={() => abrirGanancia(m as MovimientoVenta)}
                          disabled={disabled}
                          className={`px-2 py-1.5 rounded text-xs inline-flex items-center gap-1 ${
                            disabled
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                              : "bg-emerald-100 hover:bg-emerald-200 text-emerald-700"
                          }`}
                          title={
                            disabled
                              ? "Esta venta ya tiene una ganancia registrada"
                              : "Registrar ganancia de esta venta (ajuste positivo en Cobros)"
                          }
                        >
                          Ganancia
                        </button>
                      );
                    })()}

                    {/* Botón ELIMINAR: ya estaba restringido a admin */}
                    {isAdmin ? (
                      <button
                        onClick={() => eliminarMovimiento(m)}
                        className="px-2 py-1.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs inline-flex items-center gap-1"
                        title="Eliminar movimiento"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Modal: Nuevo equipo */}
      <dialog ref={dlgNuevoRef} className="rounded-xl p-0 w-[92vw] max-w-md backdrop:bg-black/30">
        <form method="dialog" onSubmit={submitNuevo} className="p-5 bg-white rounded-xl text-slate-800">
          <div className="text-lg font-semibold mb-3">Nuevo equipo</div>
          {errNuevo && <div className="text-red-600 text-sm mb-2">{errNuevo}</div>}

          <div className="space-y-3">
            <label className="grid grid-cols-4 items-center gap-2">
              <span className="col-span-1">Equipo</span>
              <input
                className="col-span-3 border rounded px-3 py-2"
                placeholder="Ej. Nano AC, Router, Switch"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                required
              />
            </label>

            <label className="grid grid-cols-4 items-center gap-2">
              <span className="col-span-1">Precio (USD)</span>
              <input
                className="col-span-3 border rounded px-3 py-2"
                type="number"
                min={0}
                step={0.01}
                placeholder="Opcional"
                value={nuevoPrecio}
                onChange={(e) => setNuevoPrecio(e.target.value)}
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={closeNuevo} className="px-3 py-2 rounded border">
              Cancelar
            </button>
            <button
              type="submit"
              className={`px-3 py-2 rounded text-white ${canNewEquipo ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-400 cursor-not-allowed"}`}
              disabled={!canNewEquipo}
            >
              Guardar
            </button>
          </div>
        </form>
      </dialog>
     
      {/* Modal: Ganancia manual de VENTA */}
      <dialog ref={dlgGananciaRef} className="rounded-xl p-0 w-[92vw] max-w-md backdrop:bg-black/30">
        <form method="dialog" onSubmit={submitGanancia} className="p-5 bg-white rounded-xl text-slate-800">
          <div className="text-lg font-semibold mb-3">Registrar ganancia</div>
          {errGanancia && <div className="text-red-600 text-sm mb-2">{errGanancia}</div>}

          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Venta de: <span className="font-medium">{gananciaTarget?.equipoEtiqueta}</span>
              <br />
              Fecha: <span className="font-medium">{gananciaTarget ? new Date(gananciaTarget.fechaISO).toLocaleString() : "—"}</span>
            </p>

            <label className="grid grid-cols-4 items-center gap-2">
              <span className="col-span-1">Monto</span>
              <input
                type="number"
                min={0}
                step={0.01}
                className="col-span-3 border rounded px-3 py-2"
                value={gananciaValor}
                onChange={(e) => setGananciaValor(e.target.value)}
                placeholder="Ej. 25"
                required
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={() => dlgGananciaRef.current?.close()} className="px-3 py-2 rounded border">
              Cancelar
            </button>
            <button type="submit" className="px-3 py-2 rounded text-white bg-emerald-600 hover:bg-emerald-700" title="Guardar ganancia y enviar a Cobros">
              Guardar
            </button>
          </div>
        </form>
      </dialog>

      {/* Modal: Movimiento */}
      {movOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeMovimiento} />
          <div className="relative w-[92vw] max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="text-lg font-semibold mb-3">Registrar movimiento</div>
            {errMov && <div className="text-red-600 text-sm mb-2">{errMov}</div>}

            <form onSubmit={submitMovimiento} className="space-y-3">
              <div className="text-sm text-slate-600">
                Equipo: <span className="font-medium">{mov.display || "-"}</span>
              </div>

              <label className="grid grid-cols-4 items-center gap-2">
                <span className="col-span-1">Tipo</span>
                <select
                  className="col-span-3 border rounded px-3 py-2 bg-white"
                  value={mov.tipo}
                  onChange={(e) => setMov((f) => ({ ...f, tipo: e.target.value as "venta" | "asignacion" }))}
                >
                  <option value="venta">Venta</option>
                  <option
                    value="asignacion"
                    disabled={!isAssignable(mov.display)}
                    title={!isAssignable(mov.display) ? "Solo Router y Switch se pueden asignar" : ""}
                  >
                    Asignación
                  </option>
                </select>
              </label>

              {/* Cantidad para VENTA */}
              {mov.tipo === "venta" && (
                <label className="grid grid-cols-4 items-center gap-2">
                  <span className="col-span-1">Cantidad</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    className="col-span-3 border rounded px-3 py-2"
                    value={movQty}
                    onChange={(e) => setMovQty(e.target.value)}
                    placeholder="1"
                    required
                  />
                </label>
              )}

              {/* UN solo control de búsqueda/selección de cliente */}
              {mov.tipo === "asignacion" && (
                <>
                  <ClienteCombobox
                    clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre }))}
                    value={mov.clienteId ?? ""}
                    onChange={(id) => setMov((f) => ({ ...f, clienteId: id }))}
                  />
                  {isRouterName(mov.display) && (
                    <label className="grid grid-cols-4 items-center gap-2">
                      <span className="col-span-1">Pagado</span>
                      <div className="col-span-3">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={Boolean(mov.pagado)}
                            onChange={(e) => setMov((f) => ({ ...f, pagado: e.target.checked }))}
                          />
                          <span>El cliente ya pagó el router (+15)</span>
                        </label>
                      </div>
                    </label>
                  )}
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeMovimiento} className="px-3 py-2 rounded border">
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-3 py-2 rounded text-white ${canRegistrarMov ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-400 cursor-not-allowed"}`}
                  disabled={!canRegistrarMov}
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== Combobox de clientes (UNA sola barra) ===== */
function ClienteCombobox({
  clientes,
  value,
  onChange,
}: {
  clientes: { id: string; nombre: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [term, setTerm] = useState("");

  // si hay id seleccionado, refleja el nombre
  useEffect(() => {
    const curr = clientes.find((c) => c.id === value);
    if (curr && curr.nombre !== term) setTerm(curr.nombre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, clientes]);

  const names = useMemo(() => clientes.map((c) => c.nombre), [clientes]);

  function handleChange(v: string) {
    setTerm(v);
    const exact = clientes.find((c) => c.nombre.toLowerCase() === v.trim().toLowerCase());
    if (exact) onChange(exact.id);
    else onChange(""); // aún no seleccionado
  }

  return (
    <label className="grid grid-cols-4 items-center gap-2">
      <span className="col-span-1">Cliente</span>
      <div className="col-span-3">
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="Buscar y seleccionar cliente…"
          value={term}
          onChange={(e) => handleChange(e.target.value)}
          list="clientes-suggest"
        />
        <datalist id="clientes-suggest">
          {names.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <div className="mt-1 text-[11px] text-slate-500">
          Escribe y selecciona del listado. Debe quedar el nombre exacto.
        </div>
      </div>
    </label>
  );
}
