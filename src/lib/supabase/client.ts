import { createClient } from '@supabase/supabase-js'

// Validar variables de entorno - Cliente necesita NEXT_PUBLIC_
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || supabaseUrl === 'undefined') {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL no está configurada');
  throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is required');
}

if (!supabaseAnonKey || supabaseAnonKey === 'undefined') {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_ANON_KEY no está configurada');
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY is required');
}

console.log('✅ Supabase client configurado:', { 
  url: supabaseUrl, 
  keyLength: supabaseAnonKey.length,
  env: process.env.NODE_ENV
});

// Crear cliente único con configuración específica para evitar múltiples instancias
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// DEBUG: Probar conexión básica
console.log('🔍 Probando conexión con Supabase...');
(async () => {
  try {
    const result = await supabase.from('zonas').select('count').single();
    if (result.error) {
      console.error('❌ Error de conexión:', result.error);
    } else {
      console.log('✅ Conexión exitosa con Supabase');
    }
  } catch (err) {
    console.error('❌ Failed to fetch - Error de red:', err);
  }
})();
