"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Search } from "lucide-react";
import { getRole } from "@/lib/admin";
import { useClientes, useZonas } from "@/hooks/useSupabaseData";

/* ===== Funciones de datos ===== */

// function monthKey(d: Date | string = new Date()) {
//   const dt = typeof d === "string" ? new Date(d) : d;
//   return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
// }
// function round2(n: number) {
//   return Math.round(n * 100) / 100;
// }

/* ===== Tipos ===== */
type ZonaId = string;

type Cliente = {
  id: string;
  nombre: string;
  ip: string;
  mac: string;
  servicio: number; // Mb
  router: boolean;
  switch: boolean;
  zona_id: ZonaId;
  activo: boolean;
};

// type Equipo = {
//   id: string;
//   etiqueta: string;
//   precio_usd?: number;
//   estado_tipo: string;
//   estado_fecha?: string;
//   estado_cliente_id?: string;
//   estado_cliente_nombre?: string;
//   placeholder?: boolean;
//   created_at: string;
// };

// type MovimientoBase = {
//   id: string;
//   fecha: string;
//   equipo_id: string;
//   equipo_etiqueta: string;
//   actor: string;
// };
// type MovimientoVenta = MovimientoBase & { tipo: "venta" };
// type MovimientoAsignacion = MovimientoBase & {
//   tipo: "asignacion";
//   cliente_id: string;
//   cliente_nombre: string;
//   pagado?: boolean; // solo router
// };
// type Movimiento = MovimientoVenta | MovimientoAsignacion;

// type AjusteCobro = {
//   id: string;
//   yyyymm: string;
//   amount: number;
//   label: string;
//   createdISO: string;
//   actor?: string;
//   ref?: { movId?: string; equipo?: string; type?: "manual" | "auto" };
// };

// type CobroMes = {
//   yyyymm: string;
//   lote: string;
//   createdISO: string;
//   actor: string;
// };

/* ===== Reglas de negocio ===== */
// const AJUSTE_ROUTER_PAGADO_USD = 15;

/* ===== Página ===== */
export default function UsuariosPage() {
  // Datos directos de Supabase
  const [clientes, setClientes, clientesLoading] = useClientes();
  const [zonas, , zonasLoading] = useZonas();

  // Estado de carga combinado
  const loaded = !clientesLoading && !zonasLoading;

  // ==== Estados de la UI ====
  const [filtro, setFiltro] = useState("");
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  // ==== Modal de nuevo cliente ====
  const [dlgNuevo, setDlgNuevo] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoIp, setNuevoIp] = useState("");
  const [nuevoMac, setNuevoMac] = useState("");
  const [nuevoServicio, setNuevoServicio] = useState("");
  const [nuevoZona, setNuevoZona] = useState("");
  const [nuevoRouter, setNuevoRouter] = useState(false);
  const [nuevoSwitch, setNuevoSwitch] = useState(false);
  const [errNuevo, setErrNuevo] = useState<string | null>(null);

  // ==== Modal de editar cliente ====
  const [dlgEditar, setDlgEditar] = useState(false);
  const [editarId, setEditarId] = useState<string | null>(null);
  const [editarNombre, setEditarNombre] = useState("");
  const [editarIp, setEditarIp] = useState("");
  const [editarMac, setEditarMac] = useState("");
  const [editarServicio, setEditarServicio] = useState("");
  const [editarZona, setEditarZona] = useState("");
  const [editarRouter, setEditarRouter] = useState(false);
  const [editarSwitch, setEditarSwitch] = useState(false);
  const [editarActivo, setEditarActivo] = useState(true);
  const [errEditar, setErrEditar] = useState<string | null>(null);

  // ==== Roles y permisos ====
  const [role, setRole] = useState<ReturnType<typeof getRole>>("");

  useEffect(() => {
    const update = () => {
      setRole(getRole());
    };
    update();
  }, []);

  const canCreateUsuario = role !== "envios";
  const canEditUsuario = role === "owner" || role === "admin" || role === "tech";
  const canDeleteUsuario = role === "owner" || role === "admin";

  // ==== Funciones simplificadas (sin localStorage) ====
  // function hayStock(etiqueta: "router" | "switch") {
  //   // Función simplificada - ya no usamos localStorage
  //   return true; // Asumir que hay stock por ahora
  // }

  // function asignarEquipoACliente(etiqueta: "router" | "switch", cliente: Cliente) {
  //   // Función simplificada - ya no usamos localStorage
  //   console.log(`Asignando ${etiqueta} a cliente ${cliente.nombre}`);
  //   return false; // Por ahora no asignamos equipos
  // }

  // function crearAjusteCobro(ajuste: AjusteCobro) {
  //   // Función simplificada - ya no usamos localStorage
  //   console.log("Creando ajuste de cobro:", ajuste);
  // }

  // function procesarCobranzaMensual() {
  //   // Función simplificada - ya no usamos localStorage
  //   console.log("Procesando cobranza mensual");
  // }

  // ==== Filtros ====
  const clientesFiltrados = useMemo(() => {
    if (!loaded) return [];
    
    return clientes.filter((c) => {
      const matchFiltro = !filtro || 
        c.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
        c.ip.includes(filtro) ||
        c.mac.toLowerCase().includes(filtro.toLowerCase());
      
      const matchActivo = mostrarInactivos || c.activo;
      
      return matchFiltro && matchActivo;
    });
  }, [clientes, filtro, mostrarInactivos, loaded]);

  // ==== Funciones de UI ====
  function abrirNuevo() {
    setDlgNuevo(true);
    setNuevoNombre("");
    setNuevoIp("");
    setNuevoMac("");
    setNuevoServicio("");
    setNuevoZona("");
    setNuevoRouter(false);
    setNuevoSwitch(false);
    setErrNuevo(null);
  }

  function cerrarNuevo() {
    setDlgNuevo(false);
    setErrNuevo(null);
  }

  function abrirEditar(cliente: Cliente) {
    setDlgEditar(true);
    setEditarId(cliente.id);
    setEditarNombre(cliente.nombre);
    setEditarIp(cliente.ip);
    setEditarMac(cliente.mac);
    setEditarServicio(cliente.servicio.toString());
    setEditarZona(cliente.zona_id);
    setEditarRouter(cliente.router);
    setEditarSwitch(cliente.switch);
    setEditarActivo(cliente.activo);
    setErrEditar(null);
  }

  function cerrarEditar() {
    setDlgEditar(false);
    setEditarId(null);
    setErrEditar(null);
  }

  async function guardarNuevo() {
    if (!nuevoNombre.trim()) {
      setErrNuevo("El nombre es requerido");
      return;
    }
    if (!nuevoServicio || isNaN(Number(nuevoServicio)) || Number(nuevoServicio) <= 0) {
      setErrNuevo("El servicio debe ser un número positivo");
      return;
    }
    if (!nuevoZona) {
      setErrNuevo("La zona es requerida");
      return;
    }

    try {
      const nuevoCliente: Cliente = {
      id: crypto.randomUUID(),
        nombre: nuevoNombre.trim(),
        ip: nuevoIp.trim(),
        mac: nuevoMac.trim(),
        servicio: Number(nuevoServicio),
        router: nuevoRouter,
        switch: nuevoSwitch,
        zona_id: nuevoZona,
      activo: true,
    };

      // Asignar equipos si es necesario
      // if (nuevoRouter) {
      //   asignarEquipoACliente("router", nuevoCliente);
      // }
      // if (nuevoSwitch) {
      //   asignarEquipoACliente("switch", nuevoCliente);
      // }

      // Agregar a la lista
      const next = [...clientes, nuevoCliente];
      await setClientes(next);

      cerrarNuevo();
    } catch {
      setErrNuevo("Error al crear cliente");
    }
  }

  async function guardarEditar() {
    if (!editarId) return;
    if (!editarNombre.trim()) {
      setErrEditar("El nombre es requerido");
      return;
    }
    if (!editarServicio || isNaN(Number(editarServicio)) || Number(editarServicio) <= 0) {
      setErrEditar("El servicio debe ser un número positivo");
      return;
    }
    if (!editarZona) {
      setErrEditar("La zona es requerida");
      return;
    }

    try {
      const next = clientes.map((c) =>
        c.id === editarId
          ? {
              ...c,
              nombre: editarNombre.trim(),
              ip: editarIp.trim(),
              mac: editarMac.trim(),
              servicio: Number(editarServicio),
              router: editarRouter,
              switch: editarSwitch,
              zona_id: editarZona,
              activo: editarActivo,
            }
          : c
      );
      await setClientes(next);
      cerrarEditar();
    } catch {
      setErrEditar("Error al actualizar cliente");
    }
  }

  async function eliminarCliente(cliente: Cliente) {
    if (!confirm(`¿Eliminar cliente "${cliente.nombre}"?`)) return;
    
    try {
      const next = clientes.filter((c) => c.id !== cliente.id);
      await setClientes(next);
    } catch {
      alert("Error al eliminar cliente");
    }
  }

  // ==== Render ====
  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Cargando clientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
      {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-600 mt-2">Gestiona los clientes del sistema</p>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, IP o MAC..."
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
        </div>
      </div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={mostrarInactivos}
                onChange={(e) => setMostrarInactivos(e.target.checked)}
                className="mr-2"
              />
              Mostrar inactivos
            </label>
            {canCreateUsuario && (
                <button
                onClick={abrirNuevo}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Nuevo Cliente
                </button>
              )}
                </div>
      </div>

        {/* Lista de clientes */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP / MAC
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Servicio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Zona
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Equipos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {clientesFiltrados.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {cliente.nombre}
            </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{cliente.ip}</div>
                      <div className="text-sm text-gray-500">{cliente.mac}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{cliente.servicio} Mb</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {zonas.find((z) => z.id === cliente.zona_id)?.nombre || "Desconocida"}
          </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        {cliente.router && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Router
                          </span>
                        )}
                        {cliente.switch && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Switch
                          </span>
                        )}
            </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          cliente.activo
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {cliente.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        {canEditUsuario && (
                          <button
                            onClick={() => abrirEditar(cliente)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canDeleteUsuario && (
                          <button
                            onClick={() => eliminarCliente(cliente)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                      )}
                    </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
                    </div>
          </div>

        {/* Modal Nuevo Cliente */}
        {dlgNuevo && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Nuevo Cliente</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
            </label>
              <input
                    type="text"
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nombre del cliente"
                  />
          </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      IP
            </label>
              <input
                      type="text"
                      value={nuevoIp}
                      onChange={(e) => setNuevoIp(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="192.168.1.1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      MAC
            </label>
              <input
                      type="text"
                      value={nuevoMac}
                      onChange={(e) => setNuevoMac(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="00:11:22:33:44:55"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Servicio (Mb) *
            </label>
              <input
                type="number"
                    value={nuevoServicio}
                    onChange={(e) => setNuevoServicio(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="100"
                  />
              </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Zona *
                  </label>
              <select
                    value={nuevoZona}
                    onChange={(e) => setNuevoZona(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar zona</option>
                    {zonas.map((zona) => (
                      <option key={zona.id} value={zona.id}>
                        {zona.nombre}
                    </option>
                  ))}
              </select>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={nuevoRouter}
                      onChange={(e) => setNuevoRouter(e.target.checked)}
                      className="mr-2"
                    />
                    Router
            </label>
                  <label className="flex items-center">
                <input
                  type="checkbox"
                      checked={nuevoSwitch}
                      onChange={(e) => setNuevoSwitch(e.target.checked)}
                      className="mr-2"
                    />
                    Switch
              </label>
            </div>
                {errNuevo && (
                  <div className="text-red-600 text-sm">{errNuevo}</div>
                )}
          </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={cerrarNuevo}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
              Cancelar
            </button>
                <button
                  onClick={guardarNuevo}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
              Guardar
            </button>
          </div>
            </div>
          </div>
        )}

        {/* Modal Editar Cliente */}
        {dlgEditar && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Editar Cliente</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
              <input
                    type="text"
                    value={editarNombre}
                    onChange={(e) => setEditarNombre(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nombre del cliente"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      IP
            </label>
              <input
                      type="text"
                      value={editarIp}
                      onChange={(e) => setEditarIp(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="192.168.1.1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      MAC
            </label>
              <input
                      type="text"
                      value={editarMac}
                      onChange={(e) => setEditarMac(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="00:11:22:33:44:55"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Servicio (Mb) *
            </label>
              <input
                type="number"
                    value={editarServicio}
                    onChange={(e) => setEditarServicio(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Zona *
            </label>
                  <select
                    value={editarZona}
                    onChange={(e) => setEditarZona(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar zona</option>
                    {zonas.map((zona) => (
                      <option key={zona.id} value={zona.id}>
                        {zona.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center">
                  <input
                    type="checkbox"
                      checked={editarRouter}
                      onChange={(e) => setEditarRouter(e.target.checked)}
                      className="mr-2"
                    />
                    Router
                </label>
                  <label className="flex items-center">
                  <input
                    type="checkbox"
                      checked={editarSwitch}
                      onChange={(e) => setEditarSwitch(e.target.checked)}
                      className="mr-2"
                    />
                    Switch
                </label>
              </div>
                <div>
                  <label className="flex items-center">
              <input
                type="checkbox"
                      checked={editarActivo}
                      onChange={(e) => setEditarActivo(e.target.checked)}
                      className="mr-2"
                    />
                    Activo
            </label>
          </div>
                {errEditar && (
                  <div className="text-red-600 text-sm">{errEditar}</div>
                )}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={cerrarEditar}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
              Cancelar
            </button>
            <button
                  onClick={guardarEditar}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Guardar
            </button>
          </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}