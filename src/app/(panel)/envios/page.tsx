"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getRole, PERM, isAdminUser } from "@/lib/admin";
import { Plus, CheckCheck, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { useEquipos } from "@/hooks/useSupabaseData";

/* ===== Tipos ===== */
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

type Envio = {
  id: string;
  created_iso: string;
  created_by: string;
  items: Array<{ key: string; display: string; qty: number }>;
  status: "en_camino" | "recogido" | "disponible";
  arrived_iso?: string;
  inventory_added: boolean;
};

type Grupo = {
  key: string;
  display: string;
  cantidad: number;
  hasPlaceholder: boolean;
};

/* ===== Página ===== */
export default function EnviosPage() {
  // Usuario actual desde BD
  const { user } = useCurrentUser();
  
  // Datos directos de Supabase
  const [equipos, , equiposLoading] = useEquipos();
  
  // Estados locales
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);

  // Estados de UI
  const [openNew, setOpenNew] = useState(false);
  const [rowsNew, setRowsNew] = useState<{ key: string; display: string; qty: string; checked: boolean }[]>([]);
  const [openEdit, setOpenEdit] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rowsEdit, setRowsEdit] = useState<{ key: string; display: string; qty: string; checked: boolean }[]>([]);

  // Roles y permisos
  const isAdmin = isAdminUser(user);
  const role = user?.rol as ReturnType<typeof getRole> || "";
  const canCrear = PERM.crearEnvio(role);
  const canRecoger = PERM.recogerEnvio(role);
  const canEditar = isAdmin;
  const canEliminar = isAdmin;

  // Función para leer grupos de equipos
  function readGrupos(equipos: Equipo[]): Grupo[] {
    const map = new Map<string, Grupo>();
    
    for (const e of equipos) {
      const key = e.etiqueta.trim().toLowerCase();
      const display = e.etiqueta.trim();

      if (!map.has(key)) {
        map.set(key, {
          key,
          display,
          cantidad: 0,
          hasPlaceholder: false,
        });
      }
      
      const g = map.get(key)!;
      if (e.placeholder) {
        g.hasPlaceholder = true;
      } else if (e.estado_tipo === "disponible") {
        g.cantidad += 1;
      }
    }
    
    return Array.from(map.values()).sort((a, b) => a.display.localeCompare(b.display));
  }

  // Cargar grupos cuando cambien los equipos
  useEffect(() => {
    if (!equiposLoading) {
      setGrupos(readGrupos(equipos));
    }
  }, [equiposLoading, equipos]);

  // Función para crear nuevo envío
  function crearEnvio() {
    if (!canCrear) return;
    
    const toSend = rowsNew
      .filter(r => r.checked && Number(r.qty) > 0)
      .map(r => ({ key: r.key, display: r.display, qty: Number(r.qty) }));

    if (toSend.length === 0) return;

    const nuevo: Envio = {
      id: crypto.randomUUID(),
      created_iso: new Date().toISOString(),
      created_by: (user?.username || "admin").toString(),
      items: toSend,
      status: "en_camino",
      inventory_added: false,
    };
    
    const next = [nuevo, ...envios];
    setEnvios(next);
    setOpenNew(false);
  }

  // Función para marcar como recogido
  function marcarRecogido(id: string) {
    if (!canRecoger) return;
    
    const next = envios.map(e =>
      e.id === id ? { ...e, status: "recogido" as const, arrived_iso: new Date().toISOString() } : e
    );
    setEnvios(next);
  }

  // Función para marcar como disponible
  function marcarDisponible(id: string) {
    if (!canRecoger) return;
    
    const next = envios.map(e =>
      e.id === id ? { ...e, status: "disponible" as const, arrived_iso: new Date().toISOString() } : e
    );
    setEnvios(next);
  }

  // Función para eliminar envío
  function eliminarEnvio(id: string) {
    if (!canEliminar) return;
    
    const next = envios.filter(e => e.id !== id);
    setEnvios(next);
  }

  // Función para abrir modal de edición
  function abrirEditar(envio: Envio) {
    if (!canEditar) return;
    
    setEditingId(envio.id);
    setRowsEdit(envio.items.map(item => ({
      key: item.key,
      display: item.display,
      qty: item.qty.toString(),
      checked: true
    })));
    setOpenEdit(true);
  }

  // Función para cerrar modal de edición
  function cerrarEditar() {
    setOpenEdit(false);
    setEditingId(null);
    setRowsEdit([]);
  }

  // Función para guardar edición
  function guardarEdicion() {
    if (!editingId) return;
    
    const toSend = rowsEdit
      .filter(r => r.checked && Number(r.qty) > 0)
      .map(r => ({ key: r.key, display: r.display, qty: Number(r.qty) }));
    
    const next = envios.map(e =>
      e.id === editingId ? { ...e, items: toSend } : e
    );
      setEnvios(next);
    cerrarEditar();
  }

  // Función para abrir modal de nuevo
  function abrirNuevo() {
    if (!canCrear) return;
    
    setRowsNew(grupos.map(g => ({ key: g.key, display: g.display, qty: "0", checked: false })));
    setOpenNew(true);
  }

  // Función para cerrar modal de nuevo
  function cerrarNuevo() {
    setOpenNew(false);
    setRowsNew([]);
  }

  // Render
  if (equiposLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Cargando envíos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Envíos</h1>
          <p className="text-gray-600 mt-2">Gestiona los envíos de equipos</p>
        </div>

        {/* Botón de nuevo envío */}
        {canCrear && (
          <div className="mb-6">
          <button
              onClick={abrirNuevo}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
              Nuevo Envío
          </button>
          </div>
        )}

        {/* Lista de envíos */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Creado por
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
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
                {envios.map((envio) => (
                  <tr key={envio.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(envio.created_iso).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(envio.created_iso).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{envio.created_by}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {envio.items.map((item, idx) => (
                          <div key={idx}>
                            {item.display} x{item.qty}
                          </div>
                        ))}
      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          envio.status === "en_camino"
                            ? "bg-yellow-100 text-yellow-800"
                            : envio.status === "recogido"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {envio.status === "en_camino" && "En Camino"}
                        {envio.status === "recogido" && "Recogido"}
                        {envio.status === "disponible" && "Disponible"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
            <div className="flex gap-2">
                        {canRecoger && envio.status === "en_camino" && (
                <button
                            onClick={() => marcarRecogido(envio.id)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Marcar como recogido"
                          >
                            <CheckCheck className="h-4 w-4" />
                </button>
              )}
                        {canRecoger && envio.status === "recogido" && (
                  <button
                            onClick={() => marcarDisponible(envio.id)}
                            className="text-green-600 hover:text-green-900"
                            title="Marcar como disponible"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                </button>
              )}
                        {canEditar && (
                  <button
                            onClick={() => abrirEditar(envio)}
                            className="text-yellow-600 hover:text-yellow-900"
                    title="Editar envío"
                  >
                            <Pencil className="h-4 w-4" />
                  </button>
                        )}
                        {canEliminar && (
                  <button
                            onClick={() => eliminarEnvio(envio.id)}
                            className="text-red-600 hover:text-red-900"
                    title="Eliminar envío"
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

        {/* Modal Nuevo Envío */}
      {openNew && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
              <h2 className="text-xl font-bold mb-4">Nuevo Envío</h2>
              <div className="space-y-4">
                {rowsNew.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={row.checked}
                      onChange={(e) => {
                        const next = [...rowsNew];
                        next[idx].checked = e.target.checked;
                        setRowsNew(next);
                      }}
                      className="h-4 w-4"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{row.display}</div>
                      <div className="text-sm text-gray-500">Disponibles: {grupos.find(g => g.key === row.key)?.cantidad || 0}</div>
    </div>
                    <input
                      type="number"
                      value={row.qty}
                      onChange={(e) => {
                        const next = [...rowsNew];
                        next[idx].qty = e.target.value;
                        setRowsNew(next);
                      }}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                      disabled={!row.checked}
                    />
          </div>
        ))}
      </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={cerrarNuevo}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={crearEnvio}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Crear Envío
                </button>
    </div>
      </div>
    </div>
        )}

        {/* Modal Editar Envío */}
        {openEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
              <h2 className="text-xl font-bold mb-4">Editar Envío</h2>
              <div className="space-y-4">
                {rowsEdit.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-4">
            <input
              type="checkbox"
                      checked={row.checked}
                      onChange={(e) => {
                        const next = [...rowsEdit];
                        next[idx].checked = e.target.checked;
                        setRowsEdit(next);
                      }}
                      className="h-4 w-4"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{row.display}</div>
          </div>
          <input
            type="number"
                      value={row.qty}
                      onChange={(e) => {
                        const next = [...rowsEdit];
                        next[idx].qty = e.target.value;
                        setRowsEdit(next);
                      }}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                      disabled={!row.checked}
                    />
                  </div>
                ))}
    </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={cerrarEditar}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
        Cancelar
      </button>
                <button
                  onClick={guardarEdicion}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Guardar Cambios
      </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}