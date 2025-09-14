import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

// Hook genérico para trabajar directamente con Supabase
export function useSupabaseData<T extends { id: string }>(
  tableName: string,
  defaultValue: T[] = []
): [T[], (data: T[]) => Promise<void>, boolean, string | null] {
  const [data, setData] = useState<T[]>(defaultValue);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar datos desde Supabase
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log(`🔍 [SUPABASE-DATA] Cargando ${tableName}...`);
      
      const { data: result, error: supabaseError } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: true });

      if (supabaseError) {
        console.error(`❌ [SUPABASE-DATA] Error cargando ${tableName}:`, supabaseError);
        setError(`Error cargando ${tableName}: ${supabaseError.message}`);
        return;
      }

      console.log(`✅ [SUPABASE-DATA] ${tableName} cargado: ${result?.length || 0} items`);
      setData(result || []);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      console.error(`❌ [SUPABASE-DATA] Error crítico cargando ${tableName}:`, err);
      setError(`Error crítico: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  }, [tableName]);

  // Cargar datos al montar el componente
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Función para actualizar datos
  const updateData = useCallback(async (newData: T[]) => {
    try {
      setError(null);
      console.log(`🔍 [SUPABASE-DATA] Actualizando ${tableName}: ${newData.length} items`);
      
      // Actualizar estado local inmediatamente para UI responsiva
      setData(newData);
      
      // Obtener datos actuales de la BD para comparar
      const { data: currentData } = await supabase
        .from(tableName)
        .select('*');
      
      const currentIds = new Set((currentData || []).map(item => item.id));
      const newIds = new Set(newData.map(item => item.id));
      
      // Elementos a insertar (nuevos)
      const toInsert = newData.filter(item => !currentIds.has(item.id));
      
      // Elementos a actualizar (existentes)
      const toUpdate = newData.filter(item => currentIds.has(item.id));
      
      // Elementos a eliminar (que ya no están en newData)
      const toDelete = Array.from(currentIds).filter(id => !newIds.has(id));
      
      // Ejecutar operaciones
      if (toInsert.length > 0) {
        console.log(`🔍 [SUPABASE-DATA] Insertando ${toInsert.length} items en ${tableName}`);
        const { error: insertError } = await supabase
          .from(tableName)
          .insert(toInsert);
        
        if (insertError) {
          console.error(`❌ [SUPABASE-DATA] Error insertando en ${tableName}:`, insertError);
          throw new Error(`Error insertando: ${insertError.message}`);
        }
      }
      
      if (toUpdate.length > 0) {
        console.log(`🔍 [SUPABASE-DATA] Actualizando ${toUpdate.length} items en ${tableName}`);
        for (const item of toUpdate) {
          const { error: updateError } = await supabase
            .from(tableName)
            .update(item)
            .eq('id', item.id);
          
          if (updateError) {
            console.error(`❌ [SUPABASE-DATA] Error actualizando item ${item.id} en ${tableName}:`, updateError);
            throw new Error(`Error actualizando: ${updateError.message}`);
          }
        }
      }
      
      if (toDelete.length > 0) {
        console.log(`🔍 [SUPABASE-DATA] Eliminando ${toDelete.length} items de ${tableName}`);
        const { error: deleteError } = await supabase
          .from(tableName)
          .delete()
          .in('id', toDelete);
        
        if (deleteError) {
          console.error(`❌ [SUPABASE-DATA] Error eliminando de ${tableName}:`, deleteError);
          throw new Error(`Error eliminando: ${deleteError.message}`);
        }
      }
      
      console.log(`✅ [SUPABASE-DATA] ${tableName} actualizado exitosamente`);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      console.error(`❌ [SUPABASE-DATA] Error crítico actualizando ${tableName}:`, err);
      setError(`Error actualizando: ${errorMsg}`);
      
      // Recargar datos desde BD en caso de error
      await loadData();
    }
  }, [tableName, loadData]);

  return [data, updateData, isLoading, error];
}

// Hook específico para clientes
export function useClientes() {
  return useSupabaseData('clientes', []);
}

// Hook específico para zonas
export function useZonas() {
  return useSupabaseData('zonas', []);
}

// Hook específico para equipos
export function useEquipos() {
  return useSupabaseData('equipos', []);
}

// Hook específico para movimientos
export function useMovimientos() {
  return useSupabaseData('movimientos', []);
}

// Hook específico para gastos
export function useGastos() {
  return useSupabaseData('gastos', []);
}
