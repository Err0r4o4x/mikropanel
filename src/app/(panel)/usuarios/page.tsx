"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Plus, Trash2, Pencil, Search } from "lucide-react";
import { getCurrentUser, isAdminUser, getRole  } from "@/lib/admin";
import { useClientes, useZonas } from "@/hooks/useSupabaseData";
import { useTarifas } from "@/hooks/useTarifas";

/* ===== LocalStorage keys ===== */
const LS_ZONAS = "app_zonas";
const LS_TARIFAS = "app_tarifas";
const LS_CLIENTES = "app_clientes";

/* ===== Inventario / Movs / Cobros keys ===== */
const LS_EQUIPOS = "app_equipos";
const LS_MOVS = "app_movimientos";
const LS_AJUSTES_COBROS = "app_cobros_ajustes";
const TOUCH_MOVS = "__touch_movs";

// --- Cobranza ---
const LS_COBROS_MES = "app_cobros_mes";
const LS_FORCE_COBRANZA = "app_force_cobranza";

function monthKey(d: Date | string = new Date()) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/* ===== Tipos ===== */
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

type EstadoEquipo =
  | { tipo: "disponible" }
  | { tipo: "vendido"; fechaISO: string }
  | { tipo: "asignado"; fechaISO: string; clienteId: string; clienteNombre: string };

type Equipo = {
  id: string;
  etiqueta: string;
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
type MovimientoAsignacion = MovimientoBase & {
  tipo: "asignacion";
  clienteId: string;
  clienteNombre: string;
  pagado?: boolean; // solo router
};
type MovimientoVenta = MovimientoBase & { tipo: "venta" };
type Movimiento = MovimientoAsignacion | MovimientoVenta;

/* ===== Datos base ===== */
const ZONAS_BASE: Zona[] = [
  { id: "carvajal", nombre: "Carvajal" },
  { id: "santos-suarez", nombre: "Santos Suarez" },
  { id: "san-francisco", nombre: "San Francisco" },
  { id: "buenos-aires", nombre: "Buenos Aires" },
];

const TARIFA_BASE: Record<ZonaId, number> = {
  carvajal: 5,
  "santos-suarez": 7,
  "san-francisco": 5,
  "buenos-aires": 5,
};

/* ===== Utils ===== */
function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
function validateIp192(ip: string): boolean {
  const segs = ip.trim().split(".");
  if (segs.length !== 4) return false;
  if (segs[0] !== "192" || segs[1] !== "168" || segs[2] !== "10") return false;
  const last = Number(segs[3]);
  return Number.isInteger(last) && last >= 1 && last <= 254;
}
const macRegex = /^(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;
const isRouterName = (s?: string) => (s ?? "").trim().toLowerCase() === "router";
const isSwitchName = (s?: string) => (s ?? "").trim().toLowerCase() === "switch";

/* ===== Página ===== */
export default function UsuariosPage() {
  // datos directos de Supabase
  const [selectedZona, setSelectedZona] = useState<ZonaId | null>(null);
  const [zonas, setZonas, zonasLoading, zonasError] = useZonas();
  const [tarifas, setTarifas, tarifasLoading, tarifasError] = useTarifas(TARIFA_BASE);
  const [clientes, setClientes, clientesLoading, clientesError] = useClientes();
  
  // Estado de carga combinado
  const loaded = !zonasLoading && !tarifasLoading && !clientesLoading;
  const loadingError = zonasError || tarifasError || clientesError;

  // rol
  const [isAdmin, setIsAdmin] = useState(false);
  // Permiso: 'envios' NO puede crear usuarios
  const role = getRole();
  const canCreateUsuario = role !== "envios";

  useEffect(() => {
    const update = () => setIsAdmin(isAdminUser(getCurrentUser()));
    update();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "app_user") update();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // dialogs
  const dlgClienteRef = useRef<HTMLDialogElement | null>(null);
  const dlgCalleRef = useRef<HTMLDialogElement | null>(null);
  const dlgEditRef = useRef<HTMLDialogElement | null>(null);

  // form cliente (nuevo)
  const [form, setForm] = useState<{
    nombre: string;
    ip: string;
    mac: string;
    servicio: string;
    router: boolean;
    switch: boolean;
    zona: "" | ZonaId;
    prorratear: boolean; // <<— NUEVO
  }>({
    nombre: "",
    ip: "",
    mac: "",
    servicio: "",
    router: false,
    switch: false,
    zona: "",
    prorratear: false, // por defecto marcado
  });
  const [error, setError] = useState<string | null>(null);

  // búsqueda (sólo por nombre)
  const [q, setQ] = useState("");

  // sort
  type SortKey = "nombre" | "ip" | "mac" | "servicio" | "estado";
  const [sortKey, setSortKey] = useState<SortKey>("nombre");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // form zona (nueva)
  const [nuevaCalle, setNuevaCalle] = useState({ nombre: "", tarifa: "5" });
  const [calleError, setCalleError] = useState<string | null>(null);

  // modal edición (sólo admin)
  const [editForm, setEditForm] = useState<{
    id: string;
    nombre: string;
    ip: string;
    mac: string;
    servicio: string;
    router: boolean;
    switch: boolean;
    zona: ZonaId | "";
    activo: boolean;
  }>({
    id: "",
    nombre: "",
    ip: "",
    mac: "",
    servicio: "",
    router: false,
    switch: false,
    zona: "",
    activo: true,
  });

  // Los datos se cargan y guardan automáticamente con hooks de Supabase

  /* ===== Helpers Inventario/Cobros ===== */
  function readEquipos(): Equipo[] {
    try {
      const raw = localStorage.getItem(LS_EQUIPOS);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? (list as Equipo[]) : [];
    } catch {
      return [];
    }
  }
  function writeEquipos(list: Equipo[]) {
    localStorage.setItem(LS_EQUIPOS, JSON.stringify(list));
  }
  function readMovs(): Movimiento[] {
    try {
      const raw = localStorage.getItem(LS_MOVS);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? (list as Movimiento[]) : [];
    } catch {
      return [];
    }
  }
  function writeMovs(list: Movimiento[]) {
    localStorage.setItem(LS_MOVS, JSON.stringify(list));
    localStorage.setItem(TOUCH_MOVS, String(Date.now()));
  }

  /** Hay stock disponible para la etiqueta dada */
  function hayStock(etiqueta: "router" | "switch") {
    const equipos = readEquipos();
    const target = etiqueta === "router" ? isRouterName : isSwitchName;
    return equipos.some((e) => target(e.etiqueta) && e.estado.tipo === "disponible" && !e.placeholder);
  }

  /** Asigna una unidad y crea movimiento (Router: pagado=false SIEMPRE). No crea ajustes aquí. */
  function asignarEquipoACliente(etiqueta: "router" | "switch", cliente: Cliente) {
    const equipos = readEquipos();
    const target = etiqueta === "router" ? isRouterName : isSwitchName;
    const unit = equipos.find((e) => target(e.etiqueta) && e.estado.tipo === "disponible" && !e.placeholder);
    if (!unit) return false;

    const nowISO = new Date().toISOString();
    const actor = (getCurrentUser()?.username || getCurrentUser()?.name || "tech").toString().toLowerCase();

    // Actualiza equipo -> asignado
    const equiposNext: Equipo[] = equipos.map((e) =>
      e.id === unit.id
        ? {
            ...e,
            estado: {
              tipo: "asignado" as const,
              fechaISO: nowISO,
              clienteId: cliente.id,
              clienteNombre: cliente.nombre,
            },
          }
        : e
    );
    writeEquipos(equiposNext);

    // Movimiento (router con pagado=false)
    const movId = crypto.randomUUID();
    const mov: MovimientoAsignacion = {
      id: movId,
      fechaISO: nowISO,
      equipoId: unit.id,
      equipoEtiqueta: unit.etiqueta,
      actor,
      tipo: "asignacion",
      clienteId: cliente.id,
      clienteNombre: cliente.nombre,
      pagado: etiqueta === "router" ? false : undefined,
    };
    const movsNext = [mov, ...readMovs()];
    writeMovs(movsNext);
    return true;
  }

  /* ===== PRORRATEO (Ajustar pago de hoy) ===== */
  function createProrrateoIfChecked(nuevo: Cliente) {
    if (!form.prorratear) return;

    const today = new Date();
    const tarifa = Number(tarifas[nuevo.zona] ?? 0);
    const mensual = tarifa * Number(nuevo.servicio || 0);
    if (!Number.isFinite(mensual) || mensual <= 0) return;

    // límites de ciclo [5 anterior, 5 siguiente)
    const year = today.getFullYear();
    const month = today.getMonth();
    const fifthThis = new Date(year, month, 5);
    const prev5 = today.getDate() >= 5 ? fifthThis : new Date(year, month - 1, 5);
    const next5 = new Date(prev5.getFullYear(), prev5.getMonth() + 1, 5);

    const msDay = 24 * 60 * 60 * 1000;
    const start = new Date(prev5.getFullYear(), prev5.getMonth(), prev5.getDate());
    const end = new Date(next5.getFullYear(), next5.getMonth(), next5.getDate());
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const daysTotal = Math.max(1, Math.round((end.getTime() - start.getTime()) / msDay));
    const daysUsed = Math.min(daysTotal, Math.max(0, Math.round((todayMid.getTime() - start.getTime()) / msDay)));
    const daysRemaining = Math.max(0, daysTotal - daysUsed);

    const amount = round2((mensual * daysRemaining) / daysTotal);
    if (amount <= 0) return;

    const actor = (getCurrentUser()?.username || getCurrentUser()?.name || "admin").toString().toLowerCase();

    const ajuste = {
      id: `prorrateo-${nuevo.id}-${Date.now()}`,
      yyyymm: monthKey(today),
      amount,
      label: `Ajuste prorrateo (${nuevo.nombre}) hasta día 5`,
      createdISO: new Date().toISOString(),
      actor,
      meta: { type: "instalacion" as const },
    };

    try {
      const raw = localStorage.getItem(LS_AJUSTES_COBROS);
      const list = raw ? JSON.parse(raw) : [];
      const next = Array.isArray(list) ? [ajuste, ...list] : [ajuste];
      localStorage.setItem(LS_AJUSTES_COBROS, JSON.stringify(next));
      // notificar a otras pestañas
      try { window.dispatchEvent(new StorageEvent("storage", { key: LS_AJUSTES_COBROS })); } catch {}
    } catch {}
  }

  /* ===== Resumen por zona ===== */
  const resumenZona = useMemo(() => {
    const base: Record<ZonaId, { total: number; activos: number; mb: number }> = {};
    zonas.forEach((z) => (base[z.id] = { total: 0, activos: 0, mb: 0 }));
    for (const c of clientes) {
      if (!base[c.zona]) base[c.zona] = { total: 0, activos: 0, mb: 0 };
      base[c.zona].total += 1;
      if (c.activo) {
        base[c.zona].activos += 1;
        base[c.zona].mb += Number(c.servicio) || 0;
      }
    }
    return base;
  }, [clientes, zonas]);

  /* ===== Listado por zona + búsqueda nombre + orden ===== */
  const clientesZonaSel = useMemo(() => {
    if (!selectedZona) return [];
    const list = clientes.filter((c) => c.zona === selectedZona);

    const ql = q.trim().toLowerCase();
    const filtered = ql ? list.filter((c) => c.nombre.toLowerCase().includes(ql)) : list;

    const sorted = filtered.slice().sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "nombre":
          return a.nombre.localeCompare(b.nombre) * dir;
        case "ip":
          return a.ip.localeCompare(b.ip) * dir;
        case "mac":
          return a.mac.localeCompare(b.mac) * dir;
        case "servicio":
          return (a.servicio - b.servicio) * dir;
        case "estado":
          if (a.activo === b.activo) return a.nombre.localeCompare(b.nombre) * dir;
          return (a.activo ? -1 : 1) * (sortDir === "asc" ? 1 : -1);
        default:
          return 0;
      }
    });

    return sorted;
  }, [clientes, selectedZona, q, sortKey, sortDir]);

  const totalMb = useMemo(
    () =>
      clientesZonaSel
        .filter((c) => c.activo)
        .reduce((acc, c) => acc + (Number(c.servicio) || 0), 0),
    [clientesZonaSel]
  );

  const tarifaZona = selectedZona ? tarifas[selectedZona] ?? 0 : 0;
  const ingresoEstimado = totalMb * tarifaZona;

  /* ===== Dialogs ===== */
  const openClienteDialog = () => {
    setError(null);
    setForm({
      nombre: "",
      ip: "",
      mac: "",
      servicio: "",
      router: false,
      switch: false,
      zona: selectedZona ?? "",
      prorratear: false,
    });
    dlgClienteRef.current?.showModal();
  };
  const closeClienteDialog = () => dlgClienteRef.current?.close();

  const openCalleDialog = () => {
    if (!isAdmin) return;
    setCalleError(null);
    setNuevaCalle({ nombre: "", tarifa: "5" });
    dlgCalleRef.current?.showModal();
  };
  const closeCalleDialog = () => dlgCalleRef.current?.close();

  const openEditDialog = (c: Cliente) => {
    if (!isAdmin) return;
    setError(null);
    setEditForm({
      id: c.id,
      nombre: c.nombre,
      ip: c.ip,
      mac: c.mac,
      servicio: String(c.servicio),
      router: c.router,
      switch: c.switch,
      zona: c.zona,
      activo: c.activo,
    });
    dlgEditRef.current?.showModal();
  };
  const closeEditDialog = () => dlgEditRef.current?.close();

  /* ===== Acciones ===== */
  async function toggleActivo(id: string) {
    const updated = clientes.map((c) => (c.id === id ? { ...c, activo: !c.activo } : c));
    await setClientes(updated);
  }
  
  async function eliminarUsuario(id: string) {
    if (!isAdmin) return;
    if (!confirm("¿Seguro que deseas eliminar este usuario?")) return;

    const updated = clientes.filter((c) => c.id !== id);
    await setClientes(updated);
  }

  function toggleForceCobranza() {
    try {
      // 1) Leemos clientes activos
      const rawC = localStorage.getItem(LS_CLIENTES);
      const clientes: Array<{ id?: string; activo?: boolean; zona?: string; servicio?: number; nombre?: string }> = rawC ? JSON.parse(rawC) : [];
      const activos = Array.isArray(clientes) ? clientes.filter(c => c?.activo) : [];

      // 2) Leemos tarifas por zona
      const rawT = localStorage.getItem(LS_TARIFAS);
      const tarifas: Record<string, number> = rawT ? JSON.parse(rawT) : {};

      // 3) Construimos el lote del mes YYYY-MM
      const yyyymm = monthKey();
      const lote = activos.map(c => {
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
          pagado: false, // TODOS en pendiente (desmarcados)
        };
      });

      // 4) Guardamos/Reseteamos el lote de este mes
      const rawAll = localStorage.getItem(LS_COBROS_MES);
      const all = rawAll ? JSON.parse(rawAll) : {};
      all[yyyymm] = lote;
      localStorage.setItem(LS_COBROS_MES, JSON.stringify(all));

      // 5) Bandera de “forzado” para que la sidebar muestre Cobranza a tech/envíos
      localStorage.setItem(LS_FORCE_COBRANZA, "1");

      // 6) Notificar a otras pestañas / sidebar
      try {
        window.dispatchEvent(new StorageEvent("storage", { key: LS_COBROS_MES }));
        window.dispatchEvent(new StorageEvent("storage", { key: LS_FORCE_COBRANZA }));
      } catch {}

      // 7) Refrescar esta pestaña para que el menú se actualice YA
      setTimeout(() => {
        try { window.location.reload(); } catch {}
      }, 150);

      alert("Cobranza forzada: todos en pendiente y visible en el menú para tech/envíos.");
    } catch (e) {
      console.error(e);
      alert("No se pudo preparar la cobranza.");
    }
  }

  async function handleSubmitCliente(e?: React.FormEvent) {
    e?.preventDefault();

    if (!form.nombre.trim()) return setError("El nombre es obligatorio.");
    if (!validateIp192(form.ip)) return setError("IP inválida. Debe ser 192.168.10.X");
    if (!macRegex.test(form.mac)) return setError("MAC inválida.");

    const servicioNum = Number(form.servicio);
    if (!Number.isInteger(servicioNum) || servicioNum < 1 || servicioNum > 50) {
      return setError("Servicio debe ser un entero entre 4 y 50 Mb.");
    }
    if (!form.zona) return setError("Selecciona una zona.");

    // Validación de stock según checks
    if (form.router && !hayStock("router")) {
      return setError("No hay stock de Router para asignar.");
    }
    if (form.switch && !hayStock("switch")) {
      return setError("No hay stock de Switch para asignar.");
    }

    const nuevo: Cliente = {
      id: crypto.randomUUID(),
      nombre: form.nombre.trim(),
      ip: form.ip.trim(),
      mac: form.mac.trim().toUpperCase(),
      servicio: servicioNum,
      router: form.router,
      switch: form.switch,
      zona: form.zona,
      activo: true,
    };

    // Persistimos cliente (se sincroniza automáticamente)
    await setClientes([...clientes, nuevo]);

    // Asignaciones automáticas según checks
    try {
      if (nuevo.router) asignarEquipoACliente("router", nuevo); // pagado=false
      if (nuevo.switch) asignarEquipoACliente("switch", nuevo); // gratis, sin ajuste
    } catch (err) {
      console.error(err);
    }

    // PRORRATEO si el checkbox está marcado
    try {
      createProrrateoIfChecked(nuevo);
    } catch (err) {
      console.error(err);
    }

    if (!selectedZona) setSelectedZona(nuevo.zona);
    closeClienteDialog();
  }

  async function handleSubmitCalle(e?: React.FormEvent) {
    e?.preventDefault();
    if (!isAdmin) return;

    const nombreTrim = nuevaCalle.nombre.trim();
    if (!nombreTrim) return setCalleError("El nombre de la red/calle es obligatorio.");

    const id = slugify(nombreTrim);
    if (!id) return setCalleError("Nombre inválido.");
    if (zonas.some((z) => z.id === id)) return setCalleError("Ya existe una red/calle con ese nombre.");

    const tarifaNum = Number(nuevaCalle.tarifa);
    if (!Number.isFinite(tarifaNum) || tarifaNum <= 0) return setCalleError("Tarifa inválida.");

    const nuevaZona = { id, nombre: nombreTrim };
    const zonasNext = [...zonas, nuevaZona];
    const tarifasNext = { ...tarifas, [id]: tarifaNum };

    await setZonas(zonasNext);
    await setTarifas(tarifasNext);
    setSelectedZona(id);

    closeCalleDialog();
  }

  async function eliminarZona(id: ZonaId) {
    if (!isAdmin) return;
    const stats = resumenZona[id] ?? { total: 0 };
    if ((stats as { total: number }).total > 0) {
      alert("No puedes eliminar la red: aún tiene clientes.");
      return;
    }
    if (!confirm("¿Eliminar esta red/calle?")) return;

    const zonasNext = zonas.filter((z) => z.id !== id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [id]: _, ...tarifasNext } = tarifas;
    
    await setZonas(zonasNext);
    await setTarifas(tarifasNext);
    if (selectedZona === id) setSelectedZona(null);
  }

  async function handleSubmitEdit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!isAdmin) return;

    if (!editForm.nombre.trim()) return setError("El nombre es obligatorio.");
    if (!validateIp192(editForm.ip)) return setError("IP inválida. Debe ser 192.168.10.X");
    if (!macRegex.test(editForm.mac)) return setError("MAC inválida.");
    const servicioNum = Number(editForm.servicio);
    if (!Number.isInteger(servicioNum) || servicioNum < 1 || servicioNum > 50) {
      return setError("Servicio debe ser un entero entre 4 y 50 Mb.");
    }
    if (!editForm.zona) return setError("Selecciona una zona.");

    // Detectar cambios vs registro actual
    const original = clientes.find((c) => c.id === editForm.id);
    if (!original) return setError("Cliente no encontrado.");

    // Si se activa Router/Switch aquí, validar stock y asignar
    if (!original.router && editForm.router && !hayStock("router")) {
      return setError("No hay stock de Router para asignar.");
    }
    if (!original.switch && editForm.switch && !hayStock("switch")) {
      return setError("No hay stock de Switch para asignar.");
    }

    const actualizado: Cliente = {
      ...original,
      nombre: editForm.nombre.trim(),
      ip: editForm.ip.trim(),
      mac: editForm.mac.trim().toUpperCase(),
      servicio: servicioNum,
      router: editForm.router,
      switch: editForm.switch,
      zona: editForm.zona as ZonaId,
      activo: editForm.activo,
    };

    const clientesNext = clientes.map((c) => (c.id === actualizado.id ? actualizado : c));
    await setClientes(clientesNext);

    // Asignaciones si pasaron de false -> true
    try {
      if (!original.router && actualizado.router) asignarEquipoACliente("router", actualizado); // pagado=false
      if (!original.switch && actualizado.switch) asignarEquipoACliente("switch", actualizado);
    } catch (err) {
      console.error(err);
    }

    closeEditDialog();
  }

  /* ===== Helpers UI ===== */
  const sortIndicator = (k: SortKey) => (sortKey === k ? (sortDir === "asc" ? " ↑" : " ↓") : "");
  const requestSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  /* ===== UI ===== */
  
  // Mostrar pantalla de carga o error
  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          {loadingError ? (
            <>
              <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-sm">!</span>
              </div>
              <p className="text-red-600 mb-2">Error cargando datos</p>
              <p className="text-gray-600 text-sm">{loadingError}</p>
            </>
          ) : (
            <>
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando datos desde la base de datos...</p>
            </>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Usuarios por calles</h2>
          <p className="text-sm text-slate-500">Gestiona redes/calles y clientes</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={toggleForceCobranza}
              className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow text-sm"
              title="Forzar visibilidad de Cobranza para pruebas (solo admin)"
            >
              Forzar Cobranza
            </button>
          )}

          {isAdmin && (
            <button
              onClick={openCalleDialog}
              className="px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-900 shadow"
              title="Agregar nueva red/calle (solo admin)"
            >
              Nueva red
            </button>
          )}
          {canCreateUsuario && (
            <button
              onClick={openClienteDialog}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 shadow"
            >
              <Plus className="h-5 w-5" /> Nuevo cliente
            </button>
          )}
        </div>
      </div>

      {/* Grid de zonas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {zonas.map(({ id, nombre }) => {
          const stats = resumenZona[id] ?? { total: 0, activos: 0, mb: 0 };
          const active = selectedZona === id;
          return (
            <div
              key={id}
              className={`relative rounded-2xl border shadow-sm p-4 transition cursor-pointer ${
                active ? "bg-blue-50 border-blue-200" : "bg-white border-slate-200 hover:bg-slate-50"
              }`}
              onClick={() => setSelectedZona(id)}
            >
              {isAdmin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    eliminarZona(id);
                  }}
                  className="absolute top-2 right-2 px-2 py-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs inline-flex items-center gap-1"
                  title="Eliminar red (solo admin)"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar
                </button>
              )}

              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-slate-100">
                  <MapPin className="h-7 w-7 text-slate-600" />
                </div>
                <div>
                  <div className="font-medium text-slate-900">{nombre}</div>
                  <div className="text-xs text-slate-500">
                    {stats.activos} activos / {stats.total} total · {stats.mb} Mb
                  </div>
                  <div className="text-[11px] text-slate-500">Tarifa: ${tarifas[id] ?? 0}/Mb</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabla de clientes por zona */}
      {selectedZona && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{zonas.find((z) => z.id === selectedZona)?.nombre}</h3>

            {/* Búsqueda sólo por nombre */}
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                className="pl-8 pr-3 py-2 border rounded-lg w-56"
                placeholder="Buscar por nombre…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          {/* Encabezado */}
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-2">
            <div className="grid grid-cols-12 text-sm font-medium text-slate-600">
              <button className="col-span-3 text-left hover:underline" onClick={() => requestSort("nombre")}>
                Nombre{sortIndicator("nombre")}
              </button>
              <button className="col-span-3 text-left hover:underline" onClick={() => requestSort("ip")}>
                IP{sortIndicator("ip")}
              </button>
              <button className="col-span-3 text-left hover:underline" onClick={() => requestSort("mac")}>
                MAC{sortIndicator("mac")}
              </button>
              <button className="col-span-2 text-right hover:underline" onClick={() => requestSort("servicio")}>
                Servicio (Mb){sortIndicator("servicio")}
              </button>
              <button className="col-span-1 text-right hover:underline" onClick={() => requestSort("estado")}>
                Estado{sortIndicator("estado")}
              </button>
            </div>
          </div>

          {/* Filas */}
          <div className="space-y-2">
            {clientesZonaSel.length === 0 ? (
              <div className="text-sm text-slate-500">No hay clientes que coincidan.</div>
            ) : (
              clientesZonaSel.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-xl bg-white border border-slate-200 px-4 py-3 ${c.activo ? "" : "opacity-60"}`}
                >
                  <div className="grid grid-cols-12 items-center text-sm text-slate-700 gap-2">
                    <div className="col-span-3 font-medium truncate flex items-center gap-2">
                      {c.nombre}
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => openEditDialog(c)}
                            className="ml-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs inline-flex items-center gap-1"
                            title="Editar (solo admin)"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </button>

                          <button
                            onClick={() => eliminarUsuario(c.id)}
                            className="px-2 py-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs inline-flex items-center gap-1"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Eliminar
                          </button>
                        </>
                      )}
                    </div>

                    <div className="col-span-3 truncate">{c.ip}</div>
                    <div className="col-span-3 truncate">{c.mac}</div>
                    <div className="col-span-2 text-right">{c.servicio}</div>
                    <div className="col-span-1 flex justify-end">
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={c.activo}
                          onChange={() => toggleActivo(c.id)}
                          className="peer sr-only"
                        />
                        <span className="w-9 h-5 rounded-full bg-slate-300 relative transition peer-checked:bg-blue-600">
                          <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totales */}
          <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
            <div className="grid grid-cols-12 text-sm font-semibold text-blue-900">
              <div className="col-span-6 text-right">Total Mb contratados (activos):</div>
              <div className="col-span-2 text-right">{totalMb}</div>
              <div className="col-span-2 text-right">Tarifa ($/Mb):</div>
              <div className="col-span-2 text-right">{tarifaZona}</div>
            </div>
            <div className="grid grid-cols-12 text-sm font-bold text-blue-900 mt-1">
              <div className="col-span-10 text-right">Ingreso estimado (USD):</div>
              <div className="col-span-2 text-right">${ingresoEstimado}</div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nueva red/calle */}
      <dialog ref={dlgCalleRef} className="rounded-xl p-0 w-[92vw] max-w-md backdrop:bg-black/30">
        <form method="dialog" onSubmit={handleSubmitCalle} className="p-5 bg-white rounded-xl text-slate-800">
          <div className="text-lg font-semibold mb-3">Nueva red / calle</div>
          {calleError && <div className="text-red-600 text-sm mb-2">{calleError}</div>}

          <div className="space-y-3">
            <label className="grid grid-cols-4 items-center gap-2">
              <span className="col-span-1">Nombre</span>
              <input
                className="col-span-3 border rounded px-3 py-2"
                placeholder="Ej. Calle 10"
                value={nuevaCalle.nombre}
                onChange={(e) => setNuevaCalle((f) => ({ ...f, nombre: e.target.value }))}
                required
              />
            </label>

            <label className="grid grid-cols-4 items-center gap-2">
              <span className="col-span-1">Tarifa</span>
              <input
                className="col-span-3 border rounded px-3 py-2"
                type="number"
                min={1}
                step={1}
                value={nuevaCalle.tarifa}
                onChange={(e) => setNuevaCalle((f) => ({ ...f, tarifa: e.target.value }))}
                required
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={closeCalleDialog} className="px-3 py-2 rounded border">
              Cancelar
            </button>
            <button
              type="submit"
              className={`px-3 py-2 rounded ${
                isAdmin ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-slate-400 text-white cursor-not-allowed"
              }`}
              disabled={!isAdmin}
              title={isAdmin ? "" : "Solo admin puede crear redes"}
            >
              Guardar
            </button>
          </div>
        </form>
      </dialog>

      {/* Modal Nuevo cliente */}
      <dialog ref={dlgClienteRef} className="rounded-xl p-0 w-[92vw] max-w-md backdrop:bg-black/30">
        <form method="dialog" onSubmit={handleSubmitCliente} className="p-5 bg-white rounded-xl text-slate-800">
          <div className="text-lg font-semibold mb-3">Nuevo cliente</div>
          {error && <div className="text-red-600 text-sm mb-2">{error}</div>}

          <div className="space-y-3">
            <label className="grid grid-cols-4 items-center gap-2">
              <span className="col-span-1">Nombre</span>
              <input
                className="col-span-3 border rounded px-3 py-2"
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                required
              />
            </label>

            <label className="grid grid-cols-4 items-center gap-2">
              <span className="col-span-1">IP</span>
              <input
                className="col-span-3 border rounded px-3 py-2"
                placeholder="192.168.10.X"
                value={form.ip}
                onChange={(e) => setForm((f) => ({ ...f, ip: e.target.value }))}
                required
              />
            </label>

            <label className="grid grid-cols-4 items-center gap-2">
              <span className="col-span-1">MAC</span>
              <input
                className="col-span-3 border rounded px-3 py-2"
                placeholder="AA:BB:CC:DD:EE:FF"
                value={form.mac}
                onChange={(e) => setForm((f) => ({ ...f, mac: e.target.value }))}
                required
              />
            </label>

            <label className="grid grid-cols-4 items-center gap-2">
              <span className="col-span-2">Servicio (Mb)</span>
              <input
                className="col-span-2 border rounded px-3 py-2"
                type="number"
                min={1}
                max={50}
                step={1}
                value={form.servicio}
                onChange={(e) => setForm((f) => ({ ...f, servicio: e.target.value }))}
                required
              />
            </label>

            <div className="grid grid-cols-4 items-center gap-2">
              <span className="col-span-1">Equipo</span>
              <div className="col-span-3 flex items-center gap-4">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.router}
                    onChange={(e) => setForm((f) => ({ ...f, router: e.target.checked }))}
                  />
                  <span>Router</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.switch}
                    onChange={(e) => setForm((f) => ({ ...f, switch: e.target.checked }))}
                  />
                  <span>Switch</span>
                </label>
              </div>
            </div>

            <label className="grid grid-cols-4 items-center gap-2">
              <span className="col-span-1">Zona</span>
              <select
                className="col-span-3 border rounded px-3 py-2 bg-white"
                value={form.zona}
                onChange={(e) => setForm((f) => ({ ...f, zona: e.target.value as ZonaId }))}
                required
              >
                <option value="" disabled>
                  Selecciona una zona
                </option>
                {zonas
                  .slice()
                  .sort((a, b) => a.nombre.localeCompare(b.nombre))
                  .map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.nombre}
                    </option>
                  ))}
              </select>
            </label>

            {/* NUEVO: Ajustar pago de hoy (prorrateo) */}
            <div className="grid grid-cols-4 items-start gap-2">
              <span className="col-span-1">Cobro</span>
              <label className="col-span-3 inline-flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.prorratear}
                  onChange={(e) => setForm((f) => ({ ...f, prorratear: e.target.checked }))}
                />
                <div>
                  <div className="font-medium">Ajustar pago de hoy (prorrateo)</div>
                  <div className="text-xs text-slate-500">
                    Cobra proporcional desde hoy hasta el próximo día 5 según Mb y tarifa de la zona.
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={closeClienteDialog} className="px-3 py-2 rounded border">
              Cancelar
            </button>
            <button type="submit" className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white">
              Guardar
            </button>
          </div>
        </form>
      </dialog>

      {/* Modal Editar cliente (solo admin) */}
      <dialog ref={dlgEditRef} className="rounded-xl p-0 w-[92vw] max-w-md backdrop:bg-black/30">
        <form method="dialog" onSubmit={handleSubmitEdit} className="p-5 bg-white rounded-xl text-slate-800">
          <div className="text-lg font-semibold mb-3">Editar cliente</div>
          {error && <div className="text-red-600 text-sm mb-2">{error}</div>}

          <div className="space-y-3">
            <label className="grid grid-cols-4 items-center gap-2">
              <span className="col-span-1">Nombre</span>
              <input
                className="col-span-3 border rounded px-3 py-2"
                value={editForm.nombre}
                onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))}
                required
                disabled={!isAdmin}
              />
            </label>

            <label className="grid grid-cols-4 items-center gap-2">
              <span className="col-span-1">IP</span>
              <input
                className="col-span-3 border rounded px-3 py-2"
                value={editForm.ip}
                onChange={(e) => setEditForm((f) => ({ ...f, ip: e.target.value }))}
                required
                disabled={!isAdmin}
              />
            </label>

            <label className="grid grid-cols-4 items-center gap-2">
              <span className="col-span-1">MAC</span>
              <input
                className="col-span-3 border rounded px-3 py-2"
                value={editForm.mac}
                onChange={(e) => setEditForm((f) => ({ ...f, mac: e.target.value }))}
                required
                disabled={!isAdmin}
              />
            </label>

            <label className="grid grid-cols-4 items-center gap-2">
              <span className="col-span-2">Servicio (Mb)</span>
              <input
                className="col-span-2 border rounded px-3 py-2"
                type="number"
                min={1}
                max={50}
                step={1}
                value={editForm.servicio}
                onChange={(e) => setEditForm((f) => ({ ...f, servicio: e.target.value }))}
                required
                disabled={!isAdmin}
              />
            </label>

            <div className="grid grid-cols-4 items-center gap-2">
              <span className="col-span-1">Equipo</span>
              <div className="col-span-3 flex items-center gap-4">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.router}
                    onChange={(e) => setEditForm((f) => ({ ...f, router: e.target.checked }))}
                    disabled={!isAdmin}
                  />
                  <span>Router</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.switch}
                    onChange={(e) => setEditForm((f) => ({ ...f, switch: e.target.checked }))}
                    disabled={!isAdmin}
                  />
                  <span>Switch</span>
                </label>
              </div>
            </div>

            <label className="grid grid-cols-4 items-center gap-2">
              <span className="col-span-1">Zona</span>
              <select
                className="col-span-3 border rounded px-3 py-2 bg-white"
                value={editForm.zona}
                onChange={(e) => setEditForm((f) => ({ ...f, zona: e.target.value as ZonaId }))}
                required
                disabled={!isAdmin}
              >
                <option value="" disabled>
                  Selecciona una zona
                </option>
                {zonas
                  .slice()
                  .sort((a, b) => a.nombre.localeCompare(b.nombre))
                  .map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.nombre}
                    </option>
                  ))}
              </select>
            </label>

            <label className="grid grid-cols-4 items-center gap-2">
              <span className="col-span-1">Activo</span>
              <input
                className="col-span-3"
                type="checkbox"
                checked={editForm.activo}
                onChange={(e) => setEditForm((f) => ({ ...f, activo: e.target.checked }))}
                disabled={!isAdmin}
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={closeEditDialog} className="px-3 py-2 rounded border">
              Cancelar
            </button>
            <button
              type="submit"
              className={`px-3 py-2 rounded ${
                isAdmin ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-slate-400 text-white cursor-not-allowed"
              }`}
              disabled={!isAdmin}
              title={isAdmin ? "" : "Solo admin puede editar"}
            >
              Guardar cambios
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
