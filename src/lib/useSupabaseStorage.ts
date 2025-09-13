// Hook personalizado para usar Supabase Storage de forma transparente
import { useState, useEffect, useCallback } from 'react';
import { SupabaseStorage, SyncSupabaseStorage } from './supabase-storage';

// Hook que simula useState + localStorage pero usa Supabase
export function useSupabaseStorage<T>(
  key: string, 
  initialValue: T,
  options: {
    sync?: boolean; // Si true, usa la versión síncrona con cache
    serialize?: (value: T) => string;
    deserialize?: (value: string) => T;
  } = {}
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  
  const { 
    sync = true, 
    serialize = JSON.stringify, 
    deserialize = JSON.parse 
  } = options;

  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar valor inicial
  useEffect(() => {
    async function loadInitialValue() {
      try {
        setIsLoading(true);
        
        if (sync) {
          // Asegurar que el cache esté inicializado
          await SyncSupabaseStorage.init();
          const item = SyncSupabaseStorage.getItem(key);
          if (item !== null) {
            setStoredValue(deserialize(item));
          }
        } else {
          const item = await SupabaseStorage.getItem(key);
          if (item !== null) {
            setStoredValue(deserialize(item));
          }
        }
      } catch (error) {
        console.error(`Error loading ${key} from Supabase:`, error);
        // En caso de error, usar valor inicial
      } finally {
        setIsLoading(false);
      }
    }

    loadInitialValue();
  }, [key, sync, deserialize]);

  // Función para actualizar valor
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      // Calcular nuevo valor
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Actualizar estado local inmediatamente
      setStoredValue(valueToStore);
      
      // Guardar en Supabase
      const serializedValue = serialize(valueToStore);
      
      if (sync) {
        SyncSupabaseStorage.setItem(key, serializedValue);
      } else {
        SupabaseStorage.setItem(key, serializedValue).catch(error => {
          console.error(`Error saving ${key} to Supabase:`, error);
        });
      }
    } catch (error) {
      console.error(`Error setting value for ${key}:`, error);
    }
  }, [key, storedValue, sync, serialize]);

  return [storedValue, setValue, isLoading];
}

// Hook específico para arrays (muy usado en el proyecto)
export function useSupabaseStorageArray<T>(
  key: string,
  initialValue: T[] = []
): [T[], (value: T[] | ((prev: T[]) => T[])) => void, boolean] {
  return useSupabaseStorage(key, initialValue);
}

// Hook específico para objetos
export function useSupabaseStorageObject<T extends Record<string, any>>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  return useSupabaseStorage(key, initialValue);
}

// Utilidad para obtener un valor directamente (sin hook)
export async function getSupabaseStorageValue<T>(
  key: string, 
  defaultValue: T,
  deserialize: (value: string) => T = JSON.parse
): Promise<T> {
  try {
    const item = await SupabaseStorage.getItem(key);
    return item !== null ? deserialize(item) : defaultValue;
  } catch (error) {
    console.error(`Error getting ${key} from Supabase:`, error);
    return defaultValue;
  }
}

// Utilidad para establecer un valor directamente
export async function setSupabaseStorageValue<T>(
  key: string,
  value: T,
  serialize: (value: T) => string = JSON.stringify
): Promise<void> {
  try {
    await SupabaseStorage.setItem(key, serialize(value));
  } catch (error) {
    console.error(`Error setting ${key} in Supabase:`, error);
    throw error;
  }
}

// Hook para múltiples claves (útil para cargar datos relacionados)
export function useSupabaseStorageMultiple<T extends Record<string, any>>(
  keys: (keyof T)[],
  initialValues: T
): [T, (key: keyof T, value: any) => void, boolean] {
  const [values, setValues] = useState<T>(initialValues);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadMultipleValues() {
      try {
        setIsLoading(true);
        await SyncSupabaseStorage.init();
        
        const loadedValues = { ...initialValues };
        
        for (const key of keys) {
          const item = SyncSupabaseStorage.getItem(key as string);
          if (item !== null) {
            try {
              loadedValues[key] = JSON.parse(item);
            } catch {
              loadedValues[key] = item;
            }
          }
        }
        
        setValues(loadedValues);
      } catch (error) {
        console.error('Error loading multiple values from Supabase:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadMultipleValues();
  }, [keys.join(',')]); // Re-ejecutar si cambian las claves

  const updateValue = useCallback((key: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [key]: value }));
    SyncSupabaseStorage.setItem(key as string, JSON.stringify(value));
  }, []);

  return [values, updateValue, isLoading];
}
