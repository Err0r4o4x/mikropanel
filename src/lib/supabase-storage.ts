// Capa de abstracción que simula localStorage pero usa Supabase
import { supabase } from './supabase/client';
import { supabaseAdmin } from './supabase/server';

// Cache en memoria para mejorar rendimiento
const cache = new Map<string, any>();
const cacheTimestamps = new Map<string, number>();
const CACHE_TTL = 30000; // 30 segundos

// Determinar si estamos en servidor o cliente
const isServer = typeof window === 'undefined';

// Obtener el cliente correcto según el contexto
function getSupabaseClient() {
  return isServer ? supabaseAdmin : supabase;
}

// Verificar si el cache es válido
function isCacheValid(key: string): boolean {
  const timestamp = cacheTimestamps.get(key);
  if (!timestamp) return false;
  return (Date.now() - timestamp) < CACHE_TTL;
}

// Guardar en cache
function setCache(key: string, value: any) {
  cache.set(key, value);
  cacheTimestamps.set(key, Date.now());
}

// Limpiar cache
function clearCache(key?: string) {
  if (key) {
    cache.delete(key);
    cacheTimestamps.delete(key);
  } else {
    cache.clear();
    cacheTimestamps.clear();
  }
}

// Simulador de localStorage que usa Supabase
export class SupabaseStorage {
  
  // Obtener un item (simula localStorage.getItem)
  static async getItem(key: string): Promise<string | null> {
    try {
      // Verificar cache primero
      if (isCacheValid(key)) {
        const cached = cache.get(key);
        return cached ? JSON.stringify(cached) : null;
      }

      const client = getSupabaseClient();
      const { data, error } = await client
        .from('app_storage')
        .select('value_data')
        .eq('key_name', key)
        .single();

      if (error || !data) {
        // Si no existe, intentar migrar desde localStorage real (solo en cliente)
        if (!isServer && typeof window !== 'undefined') {
          const localValue = window.localStorage.getItem(key);
          if (localValue) {
            // Migrar a Supabase
            await this.setItem(key, localValue);
            return localValue;
          }
        }
        return null;
      }

      const value = data.value_data;
      setCache(key, value);
      return JSON.stringify(value);
    } catch (error) {
      console.error('Error getting item from Supabase:', error);
      return null;
    }
  }

  // Guardar un item (simula localStorage.setItem)
  static async setItem(key: string, value: string): Promise<void> {
    try {
      let parsedValue;
      try {
        parsedValue = JSON.parse(value);
      } catch {
        parsedValue = value; // Si no es JSON válido, guardar como string
      }

      const client = getSupabaseClient();
      const { error } = await client
        .from('app_storage')
        .upsert({
          key_name: key,
          value_data: parsedValue
        }, {
          onConflict: 'key_name'
        });

      if (error) {
        throw error;
      }

      // Actualizar cache
      setCache(key, parsedValue);

      // También mantener en localStorage real como backup (solo en cliente)
      if (!isServer && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(key, value);
        } catch {
          // Ignorar errores de localStorage (quota exceeded, etc.)
        }
      }
    } catch (error) {
      console.error('Error setting item in Supabase:', error);
      throw error;
    }
  }

  // Eliminar un item (simula localStorage.removeItem)
  static async removeItem(key: string): Promise<void> {
    try {
      const client = getSupabaseClient();
      const { error } = await client
        .from('app_storage')
        .delete()
        .eq('key_name', key);

      if (error) {
        throw error;
      }

      // Limpiar cache
      clearCache(key);

      // También eliminar de localStorage real (solo en cliente)
      if (!isServer && typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem(key);
        } catch {
          // Ignorar errores
        }
      }
    } catch (error) {
      console.error('Error removing item from Supabase:', error);
      throw error;
    }
  }

  // Limpiar todo (simula localStorage.clear)
  static async clear(): Promise<void> {
    try {
      const client = getSupabaseClient();
      const { error } = await client
        .from('app_storage')
        .delete()
        .neq('key_name', ''); // Eliminar todo

      if (error) {
        throw error;
      }

      // Limpiar cache
      clearCache();

      // También limpiar localStorage real (solo en cliente)
      if (!isServer && typeof window !== 'undefined') {
        try {
          window.localStorage.clear();
        } catch {
          // Ignorar errores
        }
      }
    } catch (error) {
      console.error('Error clearing Supabase storage:', error);
      throw error;
    }
  }

  // Obtener todas las claves
  static async keys(): Promise<string[]> {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('app_storage')
        .select('key_name');

      if (error) {
        throw error;
      }

      return data?.map(item => item.key_name) || [];
    } catch (error) {
      console.error('Error getting keys from Supabase:', error);
      return [];
    }
  }

  // Obtener el tamaño aproximado
  static async length(): Promise<number> {
    try {
      const keys = await this.keys();
      return keys.length;
    } catch {
      return 0;
    }
  }
}

// Helper para migrar datos existentes de localStorage a Supabase
export async function migrateLocalStorageToSupabase() {
  if (isServer || typeof window === 'undefined') return;

  const keysToMigrate = [
    'app_users',
    'app_zonas', 
    'app_tarifas',
    'app_clientes',
    'app_equipos',
    'app_movimientos',
    'app_gastos',
    'app_cobros_ajustes',
    'app_cobros_mes',
    'app_cobros_cortes',
    'app_envios'
  ];

  for (const key of keysToMigrate) {
    try {
      const localValue = window.localStorage.getItem(key);
      if (localValue) {
        console.log(`Migrando ${key} a Supabase...`);
        await SupabaseStorage.setItem(key, localValue);
      }
    } catch (error) {
      console.error(`Error migrando ${key}:`, error);
    }
  }

  console.log('Migración completada');
}

// Wrapper síncrono para compatibilidad (usa cache)
export class SyncSupabaseStorage {
  private static initialized = false;
  private static initPromise: Promise<void> | null = null;

  // Inicializar cache con datos de Supabase
  static async init() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInit();
    await this.initPromise;
  }

  private static async _doInit() {
    try {
      const keys = await SupabaseStorage.keys();
      for (const key of keys) {
        await SupabaseStorage.getItem(key); // Esto carga en cache
      }
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing Supabase storage:', error);
    }
  }

  // Métodos síncronos que usan cache (para compatibilidad)
  static getItem(key: string): string | null {
    if (!isCacheValid(key)) {
      // Si no está en cache, intentar cargar de forma asíncrona
      SupabaseStorage.getItem(key).catch(console.error);
      return null;
    }
    const cached = cache.get(key);
    return cached ? JSON.stringify(cached) : null;
  }

  static setItem(key: string, value: string): void {
    // Actualizar cache inmediatamente
    try {
      const parsedValue = JSON.parse(value);
      setCache(key, parsedValue);
    } catch {
      setCache(key, value);
    }
    
    // Guardar en Supabase de forma asíncrona
    SupabaseStorage.setItem(key, value).catch(console.error);
  }

  static removeItem(key: string): void {
    clearCache(key);
    SupabaseStorage.removeItem(key).catch(console.error);
  }

  static clear(): void {
    clearCache();
    SupabaseStorage.clear().catch(console.error);
  }
}

export default SupabaseStorage;
