// Override global de localStorage para usar Supabase de forma transparente
import { SyncOptimizedSupabaseStorage } from './supabase-storage-optimized';

// Bandera para controlar si el override está activo
let overrideActive = false;

// Referencia al localStorage original
const originalLocalStorage = typeof window !== 'undefined' ? window.localStorage : null;

// Implementación que intercepta localStorage y lo redirige a Supabase
const supabaseLocalStorageProxy: Storage = {
  get length() {
    // Esta es síncrona, así que devolvemos lo que tengamos en cache
    return 0; // No es crítico para el funcionamiento
  },

  getItem(key: string): string | null {
    if (!overrideActive) {
      return originalLocalStorage?.getItem(key) || null;
    }
    
    // Usar la versión síncrona que usa cache
    return SyncOptimizedSupabaseStorage.getItem(key);
  },

  setItem(key: string, value: string): void {
    if (!overrideActive) {
      originalLocalStorage?.setItem(key, value);
      return;
    }
    
    // Usar la versión síncrona que actualiza cache y Supabase
    SyncOptimizedSupabaseStorage.setItem(key, value);
  },

  removeItem(key: string): void {
    if (!overrideActive) {
      originalLocalStorage?.removeItem(key);
      return;
    }
    
    SyncOptimizedSupabaseStorage.removeItem(key);
  },

  clear(): void {
    if (!overrideActive) {
      originalLocalStorage?.clear();
      return;
    }
    
    SyncOptimizedSupabaseStorage.clear();
  },

  key(index: number): string | null {
    // No es crítico para el funcionamiento actual
    return null;
  }
};

// Función para activar el override
export async function enableSupabaseStorage(): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    // Inicializar el storage de Supabase
    await SyncOptimizedSupabaseStorage.init();
    
    // Activar el override
    overrideActive = true;
    
    // Reemplazar localStorage globalmente
    Object.defineProperty(window, 'localStorage', {
      value: supabaseLocalStorageProxy,
      writable: false,
      configurable: true
    });
    
    console.log('✅ Supabase Storage activado - localStorage ahora usa Supabase');
  } catch (error) {
    console.error('❌ Error activando Supabase Storage:', error);
    throw error;
  }
}

// Función para desactivar el override (útil para debugging)
export function disableSupabaseStorage(): void {
  if (typeof window === 'undefined') return;
  
  overrideActive = false;
  
  if (originalLocalStorage) {
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: false,
      configurable: true
    });
  }
  
  console.log('⚠️ Supabase Storage desactivado - volviendo a localStorage normal');
}

// Función para verificar si el override está activo
export function isSupabaseStorageEnabled(): boolean {
  return overrideActive;
}

// Función para obtener estadísticas del storage
export async function getStorageStats() {
  try {
    const keys = await SyncOptimizedSupabaseStorage.keys?.() || [];
    const stats = {
      totalKeys: keys.length,
      keys: keys,
      overrideActive,
      cacheSize: 0 // Se podría implementar si necesitas esta info
    };
    
    return stats;
  } catch (error) {
    console.error('Error getting storage stats:', error);
    return {
      totalKeys: 0,
      keys: [],
      overrideActive,
      cacheSize: 0
    };
  }
}

// Función de migración automática
export async function migrateAndActivate(): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    console.log('🔄 Iniciando migración de localStorage a Supabase...');
    
    // Lista de claves importantes del proyecto
    const importantKeys = [
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
      'app_envios',
      'app_cobros_envio_state',
      'app_cobros_envio_movs'
    ];
    
    // Migrar datos existentes
    let migratedCount = 0;
    for (const key of importantKeys) {
      try {
        const existingValue = originalLocalStorage?.getItem(key);
        if (existingValue) {
          await SyncOptimizedSupabaseStorage.setItem(key, existingValue);
          migratedCount++;
          console.log(`✅ Migrado: ${key}`);
        }
      } catch (error) {
        console.error(`❌ Error migrando ${key}:`, error);
      }
    }
    
    // Activar el override
    await enableSupabaseStorage();
    
    console.log(`🎉 Migración completada: ${migratedCount} claves migradas`);
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  }
}

export default {
  enable: enableSupabaseStorage,
  disable: disableSupabaseStorage,
  isEnabled: isSupabaseStorageEnabled,
  getStats: getStorageStats,
  migrateAndActivate
};
