import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

type ZonaId = string;
type TarifasRecord = Record<ZonaId, number>;

// Hook específico para tarifas (maneja objeto en lugar de array)
export function useTarifas(defaultValue: TarifasRecord = {}): [TarifasRecord, (tarifas: TarifasRecord) => Promise<void>, boolean, string | null] {
  const [tarifas, setTarifas] = useState<TarifasRecord>(defaultValue);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar tarifas desde Supabase
  const loadTarifas = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔍 [TARIFAS] Cargando tarifas...');
      
      const { data: result, error: supabaseError } = await supabase
        .from('tarifas')
        .select('*')
        .order('zona_id', { ascending: true });

      if (supabaseError) {
        console.error('❌ [TARIFAS] Error cargando tarifas:', supabaseError);
        setError(`Error cargando tarifas: ${supabaseError.message}`);
        return;
      }

      // Convertir array de BD a objeto Record<ZonaId, number>
      const tarifasObj: TarifasRecord = {};
      (result || []).forEach((item: { zona_id?: string; precio_mb?: number }) => {
        if (item.zona_id && typeof item.precio_mb === 'number') {
          tarifasObj[item.zona_id] = item.precio_mb;
        }
      });

      console.log(`✅ [TARIFAS] Tarifas cargadas: ${Object.keys(tarifasObj).length} zonas`);
      setTarifas(tarifasObj);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      console.error('❌ [TARIFAS] Error crítico cargando tarifas:', err);
      setError(`Error crítico: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Cargar tarifas al montar el componente
  useEffect(() => {
    loadTarifas();
  }, [loadTarifas]);

  // Función para actualizar tarifas
  const updateTarifas = useCallback(async (newTarifas: TarifasRecord) => {
    try {
      setError(null);
      console.log('🔍 [TARIFAS] Actualizando tarifas:', Object.keys(newTarifas).length, 'zonas');
      
      // Actualizar estado local inmediatamente
      setTarifas(newTarifas);
      
      // Convertir objeto a array para BD
      const tarifasArray = Object.entries(newTarifas).map(([zona_id, precio_mb]) => ({
        zona_id,
        precio_mb,
        updated_at: new Date().toISOString()
      }));
      
      // Eliminar todas las tarifas existentes
      const { error: deleteError } = await supabase
        .from('tarifas')
        .delete()
        .neq('zona_id', ''); // Eliminar todos los registros
      
      if (deleteError) {
        console.error('❌ [TARIFAS] Error eliminando tarifas existentes:', deleteError);
        throw new Error(`Error eliminando tarifas: ${deleteError.message}`);
      }
      
      // Insertar nuevas tarifas
      if (tarifasArray.length > 0) {
        const { error: insertError } = await supabase
          .from('tarifas')
          .insert(tarifasArray);
        
        if (insertError) {
          console.error('❌ [TARIFAS] Error insertando tarifas:', insertError);
          throw new Error(`Error insertando tarifas: ${insertError.message}`);
        }
      }
      
      console.log('✅ [TARIFAS] Tarifas actualizadas exitosamente');
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      console.error('❌ [TARIFAS] Error crítico actualizando tarifas:', err);
      setError(`Error actualizando tarifas: ${errorMsg}`);
      
      // Recargar tarifas desde BD en caso de error
      await loadTarifas();
    }
  }, [loadTarifas]);

  return [tarifas, updateTarifas, isLoading, error];
}
