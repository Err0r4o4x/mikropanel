// Capa simplificada para usar Supabase como storage
import { supabase } from './supabase/client';
import { supabaseAdmin } from './supabase/server';

// Determinar si estamos en servidor o cliente
const isServer = typeof window === 'undefined';

// Obtener el cliente correcto según el contexto
function getSupabaseClient() {
  return isServer ? supabaseAdmin : supabase;
}

// Storage simplificado que usa Supabase directamente
export class SupabaseStorage {
  
  // Obtener un item
  static async getItem(key: string): Promise<string | null> {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('app_storage')
        .select('value_data')
        .eq('key_name', key)
        .single();

      if (error || !data) {
        return null;
      }

      return JSON.stringify(data.value_data);
    } catch (error) {
      console.error('Error getting item from Supabase:', error);
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
    } catch (error) {
      console.error('Error setting item in Supabase:', error);
      throw error;
    }
  }

  // Eliminar un item
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
    } catch (error) {
      console.error('Error removing item from Supabase:', error);
      throw error;
    }
  }

  // Limpiar todo
  static async clear(): Promise<void> {
    try {
      const client = getSupabaseClient();
      const { error } = await client
        .from('app_storage')
        .delete()
        .neq('key_name', '');

      if (error) {
        throw error;
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
}

export default SupabaseStorage;
