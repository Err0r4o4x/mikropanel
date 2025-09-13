// Capa de abstracción optimizada que mapea localStorage a tablas específicas de Supabase
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

// Mapeo de claves localStorage a tablas/estrategias específicas
const storageMapping: Record<string, {
  type: 'table' | 'storage';
  table?: string;
  transform?: {
    toDb: (data: any) => any;
    fromDb: (data: any) => any;
  };
}> = {
  // Datos que van a tablas específicas
  'app_zonas': {
    type: 'table',
    table: 'zonas',
    transform: {
      toDb: (zonas: any[]) => zonas.map(z => ({ id: z.id, nombre: z.nombre })),
      fromDb: (rows: any[]) => rows.map(r => ({ id: r.id, nombre: r.nombre }))
    }
  },
  'app_tarifas': {
    type: 'table',
    table: 'tarifas',
    transform: {
      toDb: (tarifas: Record<string, number>) => 
        Object.entries(tarifas).map(([zona_id, precio_mb]) => ({ zona_id, precio_mb })),
      fromDb: (rows: any[]) => 
        rows.reduce((acc, r) => ({ ...acc, [r.zona_id]: r.precio_mb }), {})
    }
  },
  'app_clientes': {
    type: 'table',
    table: 'clientes',
    transform: {
      toDb: (clientes: any[]) => clientes.map(c => ({
        id: c.id,
        nombre: c.nombre,
        ip: c.ip,
        mac: c.mac,
        servicio: c.servicio,
        router: c.router,
        switch: c.switch,
        zona_id: c.zona, // Mapear zona -> zona_id
        activo: c.activo
      })),
      fromDb: (rows: any[]) => rows.map(r => ({
        id: r.id,
        nombre: r.nombre,
        ip: r.ip,
        mac: r.mac,
        servicio: r.servicio,
        router: r.router,
        switch: r.switch,
        zona: r.zona_id, // Mapear zona_id -> zona
        activo: r.activo
      }))
    }
  },
  'app_equipos': {
    type: 'table',
    table: 'equipos',
    transform: {
      toDb: (equipos: any[]) => equipos.map(e => ({
        id: e.id,
        etiqueta: e.etiqueta,
        categoria: e.categoria,
        precio_usd: e.precioUSD,
        estado_tipo: e.estado.tipo,
        estado_fecha: e.estado.fechaISO || null,
        estado_cliente_id: e.estado.clienteId || null,
        estado_cliente_nombre: e.estado.clienteNombre || null,
        placeholder: e.placeholder || false
      })),
      fromDb: (rows: any[]) => rows.map(r => ({
        id: r.id,
        etiqueta: r.etiqueta,
        categoria: r.categoria,
        precioUSD: r.precio_usd,
        estado: {
          tipo: r.estado_tipo,
          ...(r.estado_fecha && { fechaISO: r.estado_fecha }),
          ...(r.estado_cliente_id && { clienteId: r.estado_cliente_id }),
          ...(r.estado_cliente_nombre && { clienteNombre: r.estado_cliente_nombre })
        },
        creadoISO: r.created_at,
        placeholder: r.placeholder
      }))
    }
  },
  'app_movimientos': {
    type: 'table',
    table: 'movimientos',
    transform: {
      toDb: (movimientos: any[]) => movimientos.map(m => ({
        id: m.id,
        fecha: m.fechaISO,
        equipo_id: m.equipoId,
        equipo_etiqueta: m.equipoEtiqueta,
        actor: m.actor,
        tipo: m.tipo,
        cliente_id: m.clienteId || null,
        cliente_nombre: m.clienteNombre || null,
        pagado: m.pagado || null
      })),
      fromDb: (rows: any[]) => rows.map(r => ({
        id: r.id,
        fechaISO: r.fecha,
        equipoId: r.equipo_id,
        equipoEtiqueta: r.equipo_etiqueta,
        actor: r.actor,
        tipo: r.tipo,
        ...(r.cliente_id && { clienteId: r.cliente_id }),
        ...(r.cliente_nombre && { clienteNombre: r.cliente_nombre }),
        ...(r.pagado !== null && { pagado: r.pagado })
      }))
    }
  },
  'app_gastos': {
    type: 'table',
    table: 'gastos',
    transform: {
      toDb: (gastos: any[]) => gastos.map(g => ({
        id: g.id,
        fecha: g.fechaISO,
        motivo: g.motivo,
        monto_usd: g.montoUSD,
        usuario: g.usuario
      })),
      fromDb: (rows: any[]) => rows.map(r => ({
        id: r.id,
        fechaISO: r.fecha,
        motivo: r.motivo,
        montoUSD: r.monto_usd,
        usuario: r.usuario
      }))
    }
  },
  'app_cobros_ajustes': {
    type: 'table',
    table: 'ajustes_cobros',
    transform: {
      toDb: (ajustes: any[]) => ajustes.map(a => ({
        id: a.id,
        yyyymm: a.yyyymm,
        amount: a.amount,
        label: a.label,
        created_iso: a.createdISO,
        actor: a.actor,
        meta: a.meta || {}
      })),
      fromDb: (rows: any[]) => rows.map(r => ({
        id: r.id,
        yyyymm: r.yyyymm,
        amount: r.amount,
        label: r.label,
        createdISO: r.created_iso,
        actor: r.actor,
        meta: r.meta
      }))
    }
  },
  'app_cobros_mes': {
    type: 'table',
    table: 'cobros_mes',
    transform: {
      toDb: (cobros: Record<string, any[]>) => {
        const result: any[] = [];
        Object.entries(cobros).forEach(([yyyymm, items]) => {
          items.forEach(item => {
            result.push({
              id: item.id,
              yyyymm,
              cliente_id: item.clienteId,
              nombre: item.nombre,
              zona_id: item.zona,
              mb: item.mb,
              tarifa: item.tarifa,
              amount: item.amount,
              pagado: item.pagado
            });
          });
        });
        return result;
      },
      fromDb: (rows: any[]) => {
        const result: Record<string, any[]> = {};
        rows.forEach(r => {
          if (!result[r.yyyymm]) result[r.yyyymm] = [];
          result[r.yyyymm].push({
            id: r.id,
            clienteId: r.cliente_id,
            nombre: r.nombre,
            zona: r.zona_id,
            mb: r.mb,
            tarifa: r.tarifa,
            amount: r.amount,
            pagado: r.pagado
          });
        });
        return result;
      }
    }
  },
  'app_cobros_cortes': {
    type: 'table',
    table: 'cobros_cortes',
    transform: {
      toDb: (cortes: any[]) => cortes.map(c => ({
        ym: c.ym,
        ingreso: c.ingreso,
        tecnicos: c.tecnicos,
        neto: c.neto,
        created_iso: c.createdISO
      })),
      fromDb: (rows: any[]) => rows.map(r => ({
        ym: r.ym,
        ingreso: r.ingreso,
        tecnicos: r.tecnicos,
        neto: r.neto,
        createdISO: r.created_iso
      }))
    }
  },
  'app_envios': {
    type: 'table',
    table: 'envios',
    transform: {
      toDb: (envios: any[]) => envios.map(e => ({
        id: e.id,
        created_iso: e.createdISO,
        created_by: e.createdBy,
        items: e.items,
        status: e.status,
        arrived_iso: e.arrivedISO || null,
        picked_iso: e.pickedISO || null,
        picked_by: e.pickedBy || null,
        inventory_added: e.inventoryAdded || false
      })),
      fromDb: (rows: any[]) => rows.map(r => ({
        id: r.id,
        createdISO: r.created_iso,
        createdBy: r.created_by,
        items: r.items,
        status: r.status,
        ...(r.arrived_iso && { arrivedISO: r.arrived_iso }),
        ...(r.picked_iso && { pickedISO: r.picked_iso }),
        ...(r.picked_by && { pickedBy: r.picked_by }),
        inventoryAdded: r.inventory_added
      }))
    }
  },
  'app_cobros_envio_state': {
    type: 'table',
    table: 'envios_state',
    transform: {
      toDb: (state: Record<string, any>) => 
        Object.entries(state).map(([yyyymm, data]) => ({
          yyyymm,
          total: data.total,
          remaining: data.remaining,
          created_iso: data.createdISO,
          updated_iso: data.updatedISO
        })),
      fromDb: (rows: any[]) => 
        rows.reduce((acc, r) => ({
          ...acc,
          [r.yyyymm]: {
            total: r.total,
            remaining: r.remaining,
            createdISO: r.created_iso,
            updatedISO: r.updated_iso
          }
        }), {})
    }
  },
  'app_cobros_envio_movs': {
    type: 'table',
    table: 'envios_movimientos',
    transform: {
      toDb: (movs: any[]) => movs.map(m => ({
        id: m.id,
        yyyymm: m.yyyymm,
        amount: m.amount,
        note: m.note || null,
        created_iso: m.createdISO
      })),
      fromDb: (rows: any[]) => rows.map(r => ({
        id: r.id,
        yyyymm: r.yyyymm,
        amount: r.amount,
        note: r.note,
        createdISO: r.created_iso
      }))
    }
  }
};

// Las claves que van a app_storage (datos que no tienen tabla específica)
const fallbackKeys = [
  'app_users', 
  'app_user', // Usuario actual logueado
  'app_force_cobranza', // Bandera para forzar cobranza
  'app_cobros_ajustes_archive', // Archivo de ajustes de cobros
  'app_touch_movs' // Touch para sincronizar movimientos
];

// Simulador de localStorage optimizado que usa tablas específicas
export class OptimizedSupabaseStorage {
  
  // Obtener un item
  static async getItem(key: string): Promise<string | null> {
    try {
      // Verificar cache primero
      if (isCacheValid(key)) {
        const cached = cache.get(key);
        return cached ? JSON.stringify(cached) : null;
      }

      const mapping = storageMapping[key];
      const client = getSupabaseClient();

      // Verificar si es una clave con prefijo dinámico o sin mapeo
      const isDynamicKey = key.startsWith('app_cobros_autosave_') || 
                          key.startsWith('app_cobros_reset_') ||
                          fallbackKeys.includes(key) ||
                          !mapping;

      if (mapping && mapping.type === 'table' && !isDynamicKey) {
        // Obtener de tabla específica
        const { data, error } = await client
          .from(mapping.table!)
          .select('*');

        if (error) throw error;

        const transformed = mapping.transform?.fromDb(data || []) || data;
        setCache(key, transformed);
        return JSON.stringify(transformed);
      } else {
        // Fallback a app_storage
        const { data, error } = await client
          .from('app_storage')
          .select('value_data')
          .eq('key_name', key)
          .single();

        if (error || !data) {
          // Intentar migrar desde localStorage real (solo en cliente)
          if (!isServer && typeof window !== 'undefined') {
            const localValue = window.localStorage.getItem(key);
            if (localValue) {
              await this.setItem(key, localValue);
              return localValue;
            }
          }
          return null;
        }

        const value = data.value_data;
        setCache(key, value);
        return JSON.stringify(value);
      }
    } catch (error) {
      console.error(`Error getting ${key} from Supabase:`, error);
      return null;
    }
  }

  // Guardar un item
  static async setItem(key: string, value: string): Promise<void> {
    try {
      let parsedValue;
      try {
        parsedValue = JSON.parse(value);
      } catch {
        parsedValue = value;
      }

      const mapping = storageMapping[key];
      const client = getSupabaseClient();

      // Verificar si es una clave con prefijo dinámico o sin mapeo
      const isDynamicKey = key.startsWith('app_cobros_autosave_') || 
                          key.startsWith('app_cobros_reset_') ||
                          fallbackKeys.includes(key) ||
                          !mapping;

      if (mapping && mapping.type === 'table' && !isDynamicKey) {
        // Guardar en tabla específica
        const transformed = mapping.transform?.toDb(parsedValue) || parsedValue;
        
        // Limpiar tabla y insertar nuevos datos
        await client.from(mapping.table!).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        if (Array.isArray(transformed) && transformed.length > 0) {
          const { error } = await client.from(mapping.table!).insert(transformed);
          if (error) throw error;
        }
      } else {
        // Guardar en app_storage
        const { error } = await client
          .from('app_storage')
          .upsert({
            key_name: key,
            value_data: parsedValue
          }, {
            onConflict: 'key_name'
          });

        if (error) throw error;
      }

      // Actualizar cache
      setCache(key, parsedValue);

      // Mantener en localStorage real como backup (solo en cliente)
      if (!isServer && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(key, value);
        } catch {
          // Ignorar errores de localStorage
        }
      }
    } catch (error) {
      console.error(`Error setting ${key} in Supabase:`, error);
      throw error;
    }
  }

  // Eliminar un item
  static async removeItem(key: string): Promise<void> {
    try {
      const mapping = storageMapping[key];
      const client = getSupabaseClient();

      if (mapping && mapping.type === 'table') {
        // Limpiar tabla específica
        await client.from(mapping.table!).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } else {
        // Eliminar de app_storage
        const { error } = await client
          .from('app_storage')
          .delete()
          .eq('key_name', key);

        if (error) throw error;
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
      console.error(`Error removing ${key} from Supabase:`, error);
      throw error;
    }
  }

  // Limpiar todo
  static async clear(): Promise<void> {
    try {
      const client = getSupabaseClient();

      // Limpiar todas las tablas específicas
      for (const [key, mapping] of Object.entries(storageMapping)) {
        if (mapping.type === 'table') {
          await client.from(mapping.table!).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        }
      }

      // Limpiar app_storage
      await client.from('app_storage').delete().neq('key_name', '');

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
      const keys = Object.keys(storageMapping);
      
      // Agregar claves de app_storage
      const client = getSupabaseClient();
      const { data } = await client.from('app_storage').select('key_name');
      
      if (data) {
        keys.push(...data.map(item => item.key_name));
      }

      return [...new Set(keys)]; // Eliminar duplicados
    } catch (error) {
      console.error('Error getting keys from Supabase:', error);
      return [];
    }
  }
}

// Versión síncrona para compatibilidad
export class SyncOptimizedSupabaseStorage {
  private static initialized = false;
  private static initPromise: Promise<void> | null = null;

  static async init() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInit();
    await this.initPromise;
  }

  private static async _doInit() {
    try {
      // Cargar todas las claves importantes en cache
      const importantKeys = Object.keys(storageMapping);
      
      for (const key of importantKeys) {
        await OptimizedSupabaseStorage.getItem(key);
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing optimized Supabase storage:', error);
    }
  }

  static getItem(key: string): string | null {
    if (!isCacheValid(key)) {
      OptimizedSupabaseStorage.getItem(key).catch(console.error);
      return null;
    }
    const cached = cache.get(key);
    return cached ? JSON.stringify(cached) : null;
  }

  static setItem(key: string, value: string): void {
    try {
      const parsedValue = JSON.parse(value);
      setCache(key, parsedValue);
    } catch {
      setCache(key, value);
    }
    
    OptimizedSupabaseStorage.setItem(key, value).catch(console.error);
  }

  static removeItem(key: string): void {
    clearCache(key);
    OptimizedSupabaseStorage.removeItem(key).catch(console.error);
  }

  static clear(): void {
    clearCache();
    OptimizedSupabaseStorage.clear().catch(console.error);
  }
}

export default OptimizedSupabaseStorage;
