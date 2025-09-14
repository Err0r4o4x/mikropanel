import { useState, useEffect, useCallback } from 'react';
import { syncFromSupabase, syncToSupabase } from '@/lib/sync-manager';

export function useSyncedData<T>(
  localStorageKey: string, 
  defaultValue: T[] = []
): [T[], (data: T[]) => Promise<void>, boolean] {
  const [data, setData] = useState<T[]>(defaultValue);
  const [isLoaded, setIsLoaded] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    const loadData = async () => {
      console.log(`🔍 [SYNCED-DATA] Cargando ${localStorageKey}...`);
      
      // Primero cargar desde localStorage (cache)
      try {
        const raw = localStorage.getItem(localStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setData(parsed);
            console.log(`✅ [SYNCED-DATA] ${localStorageKey} cargado desde cache: ${parsed.length} items`);
          }
        }
      } catch (error) {
        console.error(`❌ [SYNCED-DATA] Error cargando cache ${localStorageKey}:`, error);
      }

      // Luego sincronizar desde Supabase
      try {
        const syncSuccess = await syncFromSupabase(localStorageKey);
        if (syncSuccess) {
          // Recargar desde localStorage después de la sincronización
          const raw = localStorage.getItem(localStorageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              setData(parsed);
              console.log(`✅ [SYNCED-DATA] ${localStorageKey} sincronizado: ${parsed.length} items`);
            }
          }
        }
      } catch (error) {
        console.error(`❌ [SYNCED-DATA] Error sincronizando ${localStorageKey}:`, error);
      }

      setIsLoaded(true);
    };

    loadData();
  }, [localStorageKey]);

  // Escuchar cambios de storage (de otras pestañas o sincronización)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === localStorageKey && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setData(parsed);
            console.log(`🔄 [SYNCED-DATA] ${localStorageKey} actualizado desde storage: ${parsed.length} items`);
          }
        } catch (error) {
          console.error(`❌ [SYNCED-DATA] Error procesando cambio de storage:`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [localStorageKey]);

  // Función para actualizar datos
  const updateData = useCallback(async (newData: T[]) => {
    console.log(`🔍 [SYNCED-DATA] Actualizando ${localStorageKey}: ${newData.length} items`);
    
    // Actualizar estado local inmediatamente
    setData(newData);
    
    // Guardar en localStorage
    try {
      localStorage.setItem(localStorageKey, JSON.stringify(newData));
    } catch (error) {
      console.error(`❌ [SYNCED-DATA] Error guardando en localStorage:`, error);
    }
    
    // Sincronizar con Supabase en background
    try {
      const syncSuccess = await syncToSupabase(localStorageKey, newData);
      if (syncSuccess) {
        console.log(`✅ [SYNCED-DATA] ${localStorageKey} sincronizado con Supabase`);
        
        // Disparar evento para notificar a otras pestañas
        window.dispatchEvent(new StorageEvent('storage', { 
          key: localStorageKey, 
          newValue: JSON.stringify(newData) 
        }));
      }
    } catch (error) {
      console.error(`❌ [SYNCED-DATA] Error sincronizando con Supabase:`, error);
    }
  }, [localStorageKey]);

  return [data, updateData, isLoaded];
}
