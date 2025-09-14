// Sistema de sincronización entre localStorage y Supabase
import { supabase } from './supabase/client';

type SyncableTable = 
  | 'clientes' 
  | 'equipos' 
  | 'zonas' 
  | 'tarifas' 
  | 'movimientos' 
  | 'gastos'
  | 'ajustes_cobros'
  | 'envios';

// Mapeo de localStorage keys a tablas de Supabase
const TABLE_MAPPING: Record<string, SyncableTable> = {
  'app_clientes': 'clientes',
  'app_equipos': 'equipos', 
  'app_zonas': 'zonas',
  'app_tarifas': 'tarifas',
  'app_movimientos': 'movimientos',
  'app_gastos': 'gastos',
  'app_cobros_ajustes': 'ajustes_cobros',
  'app_envios': 'envios'
};

// Timestamp de última sincronización
const SYNC_TIMESTAMPS = 'sync_timestamps';

interface SyncTimestamps {
  [key: string]: string; // ISO timestamp
}

function getSyncTimestamps(): SyncTimestamps {
  try {
    const raw = localStorage.getItem(SYNC_TIMESTAMPS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setSyncTimestamp(table: string, timestamp: string) {
  try {
    const current = getSyncTimestamps();
    current[table] = timestamp;
    localStorage.setItem(SYNC_TIMESTAMPS, JSON.stringify(current));
  } catch {}
}

// Cargar datos desde Supabase y actualizar localStorage
export async function syncFromSupabase(localStorageKey: string): Promise<boolean> {
  try {
    const table = TABLE_MAPPING[localStorageKey];
    if (!table) {
      console.log(`🔍 [SYNC] Tabla no mapeada para ${localStorageKey}`);
      return false;
    }

    console.log(`🔍 [SYNC] Sincronizando ${table} desde Supabase...`);

    // Obtener timestamp de última sincronización
    const timestamps = getSyncTimestamps();
    const lastSync = timestamps[table];

    let query = supabase.from(table).select('*');
    
    // Si tenemos timestamp, solo obtener cambios recientes
    if (lastSync) {
      query = query.gt('updated_at', lastSync);
    }

    const { data, error } = await query.order('updated_at', { ascending: true });

    if (error) {
      console.error(`❌ [SYNC] Error sincronizando ${table}:`, error);
      return false;
    }

    if (!data || data.length === 0) {
      console.log(`✅ [SYNC] ${table} ya está actualizado`);
      return true;
    }

    // Actualizar localStorage
    let currentData: any[] = [];
    try {
      const raw = localStorage.getItem(localStorageKey);
      currentData = raw ? JSON.parse(raw) : [];
    } catch {}

    // Merge de datos (actualizar existentes, agregar nuevos)
    const updatedData = [...currentData];
    
    for (const newItem of data) {
      const existingIndex = updatedData.findIndex(item => item.id === newItem.id);
      if (existingIndex >= 0) {
        updatedData[existingIndex] = newItem;
      } else {
        updatedData.push(newItem);
      }
    }

    localStorage.setItem(localStorageKey, JSON.stringify(updatedData));
    
    // Actualizar timestamp
    const latestTimestamp = data[data.length - 1]?.updated_at || new Date().toISOString();
    setSyncTimestamp(table, latestTimestamp);

    console.log(`✅ [SYNC] ${table} sincronizado: ${data.length} cambios aplicados`);
    
    // Disparar evento para que los componentes se actualicen
    window.dispatchEvent(new StorageEvent('storage', { 
      key: localStorageKey, 
      newValue: JSON.stringify(updatedData) 
    }));

    return true;
  } catch (error) {
    console.error(`❌ [SYNC] Error crítico sincronizando ${localStorageKey}:`, error);
    return false;
  }
}

// Guardar datos en Supabase cuando se actualiza localStorage
export async function syncToSupabase(localStorageKey: string, data: any[]): Promise<boolean> {
  try {
    const table = TABLE_MAPPING[localStorageKey];
    if (!table) {
      console.log(`🔍 [SYNC] Tabla no mapeada para ${localStorageKey}`);
      return false;
    }

    console.log(`🔍 [SYNC] Guardando ${table} en Supabase...`);

    // Para simplificar, vamos a hacer upsert de todos los datos
    // En una implementación más sofisticada, solo enviaríamos los cambios
    const { error } = await supabase
      .from(table)
      .upsert(data, { onConflict: 'id' });

    if (error) {
      console.error(`❌ [SYNC] Error guardando ${table}:`, error);
      return false;
    }

    console.log(`✅ [SYNC] ${table} guardado en Supabase`);
    
    // Actualizar timestamp
    setSyncTimestamp(table, new Date().toISOString());
    
    return true;
  } catch (error) {
    console.error(`❌ [SYNC] Error crítico guardando ${localStorageKey}:`, error);
    return false;
  }
}

// Sincronización inicial de todas las tablas
export async function initialSync(): Promise<void> {
  console.log('🔍 [SYNC] Iniciando sincronización inicial...');
  
  const tables = Object.keys(TABLE_MAPPING);
  const promises = tables.map(key => syncFromSupabase(key));
  
  try {
    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
    
    console.log(`✅ [SYNC] Sincronización inicial completada: ${successful}/${tables.length} tablas`);
  } catch (error) {
    console.error('❌ [SYNC] Error en sincronización inicial:', error);
  }
}

// Sincronización periódica (cada 30 segundos)
export function startPeriodicSync(): () => void {
  console.log('🔍 [SYNC] Iniciando sincronización periódica...');
  
  const interval = setInterval(async () => {
    const tables = Object.keys(TABLE_MAPPING);
    for (const key of tables) {
      await syncFromSupabase(key);
    }
  }, 30000); // 30 segundos

  // Retornar función para detener la sincronización
  return () => {
    console.log('🔍 [SYNC] Deteniendo sincronización periódica');
    clearInterval(interval);
  };
}

// Hook personalizado para usar en componentes
export function useSyncedData<T>(localStorageKey: string, defaultValue: T[] = []): [T[], (data: T[]) => void] {
  const [data, setData] = React.useState<T[]>(defaultValue);
  const [isLoaded, setIsLoaded] = React.useState(false);

  // Cargar datos iniciales
  React.useEffect(() => {
    const loadData = async () => {
      // Primero cargar desde localStorage
      try {
        const raw = localStorage.getItem(localStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setData(parsed);
          }
        }
      } catch {}

      // Luego sincronizar desde Supabase
      await syncFromSupabase(localStorageKey);
      setIsLoaded(true);
    };

    loadData();
  }, [localStorageKey]);

  // Escuchar cambios de storage
  React.useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === localStorageKey && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setData(parsed);
          }
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [localStorageKey]);

  // Función para actualizar datos
  const updateData = React.useCallback(async (newData: T[]) => {
    setData(newData);
    localStorage.setItem(localStorageKey, JSON.stringify(newData));
    
    // Sincronizar con Supabase en background
    syncToSupabase(localStorageKey, newData);
  }, [localStorageKey]);

  return [data, updateData];
}

// Importar React para el hook
import React from 'react';
