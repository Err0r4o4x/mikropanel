"use client";

import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getRole } from "@/lib/admin";
import { Plus, Trash2, Download, Upload, Calendar } from "lucide-react";

/* ===== Tipos ===== */
type Ajuste = {
  id: string;
  yyyymm: string;
  amount: number;
  label: string;
  createdISO: string;
  actor?: string;
  ref?: { movId?: string; equipo?: string; type?: "manual" | "auto" };
};

type Corte = {
  id: string;
  ym: string;
  total: number;
  createdISO: string;
  actor: string;
};

type EnvioState = {
  [yyyymm: string]: {
    total: number;
    remaining: number;
    createdISO: string;
    updatedISO: string;
  };
};

type EnvioMov = {
  id: string;
  yyyymm: string;
  amount: number;
  note: string;
  createdISO: string;
};

/* ===== Página ===== */
export default function CobrosPage() {
  // Usuario actual desde BD
  const { user } = useCurrentUser();
  
  // Estados locales
  const [ajustes, setAjustes] = useState<Ajuste[]>([]);
  const [cortes, setCortes] = useState<Corte[]>([]);
  const [envState, setEnvState] = useState<EnvioState>({});
  const [envMovs, setEnvMovs] = useState<EnvioMov[]>([]);
  
  // Estados de UI
  const [loading, setLoading] = useState(true);
  
  // Roles y permisos
  const role = user?.rol as ReturnType<typeof getRole> || "";

  const canCreateAjuste = role === "owner" || role === "admin" || role === "tech";
  const canDeleteAjuste = role === "owner" || role === "admin";
  const canCreateCorte = role === "owner" || role === "admin" || role === "tech";
  const canDeleteCorte = role === "owner" || role === "admin";

  // Cargar datos al montar
  useEffect(() => {
    // Ya no usamos localStorage - los datos vienen de Supabase
    setLoading(false);
  }, []);

  // Función para crear nuevo ajuste
  function crearAjuste() {
    if (!canCreateAjuste) return;
    
    const nuevo: Ajuste = {
      id: crypto.randomUUID(),
      yyyymm: monthKey(),
      amount: 0,
      label: "Nuevo ajuste",
      createdISO: new Date().toISOString(),
      actor: user?.username || "admin",
    };
    
    setAjustes(prev => [nuevo, ...prev]);
  }

  // Función para eliminar ajuste
  function eliminarAjuste(id: string) {
    if (!canDeleteAjuste) return;
    if (!confirm("¿Eliminar este ajuste?")) return;
    
    setAjustes(prev => prev.filter(a => a.id !== id));
  }

  // Función para crear nuevo corte
  function crearCorte() {
    if (!canCreateCorte) return;
    
    const ym = monthKey();
    const total = ajustes.reduce((sum, a) => sum + a.amount, 0);
    
        const nuevo: Corte = {
      id: crypto.randomUUID(),
          ym,
      total,
          createdISO: new Date().toISOString(),
      actor: user?.username || "admin",
    };
    
    setCortes(prev => [...prev, nuevo].sort((a, b) => a.ym.localeCompare(b.ym)));
  }

  // Función para eliminar corte
  function eliminarCorte(id: string) {
    if (!canDeleteCorte) return;
    if (!confirm("¿Eliminar este corte?")) return;
    
    setCortes(prev => prev.filter(c => c.id !== id));
  }

  // Función para exportar datos
  function exportarDatos() {
    const data = {
      ajustes,
      cortes,
      envState,
      envMovs,
      exportado: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cobros-${monthKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Función para importar datos
  function importarDatos(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.ajustes) setAjustes(data.ajustes);
        if (data.cortes) setCortes(data.cortes);
        if (data.envState) setEnvState(data.envState);
        if (data.envMovs) setEnvMovs(data.envMovs);
      } catch {
        alert("Error al importar el archivo");
      }
    };
    reader.readAsText(file);
  }

  // Función para obtener el mes actual
  function monthKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  // Calcular totales
  const totales = useMemo(() => {
    const totalAjustes = ajustes.reduce((sum, a) => sum + a.amount, 0);
    const totalCortes = cortes.reduce((sum, c) => sum + c.total, 0);
    const totalEnvios = Object.values(envState).reduce((sum, e) => sum + e.total, 0);
    
    return {
      ajustes: totalAjustes,
      cortes: totalCortes,
      envios: totalEnvios,
      total: totalAjustes + totalCortes + totalEnvios,
    };
  }, [ajustes, cortes, envState]);

  // Render
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Cargando cobros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
      {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Cobros</h1>
          <p className="text-gray-600 mt-2">Gestiona los ajustes y cortes de cobros</p>
      </div>

        {/* Totales */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm font-medium text-gray-500">Ajustes</div>
            <div className="text-2xl font-bold text-gray-900">
              ${totales.ajustes.toLocaleString()}
        </div>
        </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm font-medium text-gray-500">Cortes</div>
            <div className="text-2xl font-bold text-gray-900">
              ${totales.cortes.toLocaleString()}
        </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm font-medium text-gray-500">Envíos</div>
            <div className="text-2xl font-bold text-gray-900">
              ${totales.envios.toLocaleString()}
          </div>
        </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm font-medium text-gray-500">Total</div>
            <div className="text-2xl font-bold text-blue-600">
              ${totales.total.toLocaleString()}
          </div>
        </div>
      </div>

        {/* Acciones */}
        <div className="flex gap-4 mb-6">
          {canCreateAjuste && (
          <button
              onClick={crearAjuste}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
              <Plus className="h-4 w-4" />
              Nuevo Ajuste
          </button>
          )}
          {canCreateCorte && (
          <button
              onClick={crearCorte}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
              <Calendar className="h-4 w-4" />
              Nuevo Corte
          </button>
          )}
              <button
            onClick={exportarDatos}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2"
              >
            <Download className="h-4 w-4" />
            Exportar
              </button>
          <label className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2 cursor-pointer">
            <Upload className="h-4 w-4" />
            Importar
            <input
              type="file"
              accept=".json"
              onChange={importarDatos}
              className="hidden"
            />
          </label>
          </div>

        {/* Ajustes */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Ajustes</h2>
                </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Label
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {ajustes.map((ajuste) => (
                  <tr key={ajuste.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(ajuste.createdISO).toLocaleDateString()}
                  </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{ajuste.label}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        ${ajuste.amount.toLocaleString()}
              </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{ajuste.actor}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {canDeleteAjuste && (
                        <button
                          onClick={() => eliminarAjuste(ajuste.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      </div>

        {/* Cortes */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Cortes</h2>
                      </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {cortes.map((corte) => (
                  <tr key={corte.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{corte.ym}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        ${corte.total.toLocaleString()}
                              </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(corte.createdISO).toLocaleDateString()}
                              </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{corte.actor}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {canDeleteCorte && (
                  <button
                          onClick={() => eliminarCorte(corte.id)}
                          className="text-red-600 hover:text-red-900"
                  >
                          <Trash2 className="h-4 w-4" />
                  </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
                </div>
              </div>
      </div>
    </div>
  );
}