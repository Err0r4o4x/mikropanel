import { createClient } from '@supabase/supabase-js'

console.log('🚀 [CLIENT] Iniciando configuración de Supabase client...');
console.log('🔍 [CLIENT] Variables de entorno disponibles:', {
  'process.env.NEXT_PUBLIC_SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL,
  'process.env.SUPABASE_URL': process.env.SUPABASE_URL,
  'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...` : 'NO DEFINIDA',
  'process.env.SUPABASE_ANON_KEY': process.env.SUPABASE_ANON_KEY ? `${process.env.SUPABASE_ANON_KEY.substring(0, 20)}...` : 'NO DEFINIDA',
  'process.env.NODE_ENV': process.env.NODE_ENV,
  'typeof window': typeof window
});

// Validar variables de entorno - Cliente necesita NEXT_PUBLIC_
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

console.log('🔍 [CLIENT] Después de asignación:', {
  supabaseUrl: supabaseUrl,
  supabaseAnonKey: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'NO DEFINIDA',
  urlLength: supabaseUrl?.length || 0,
  keyLength: supabaseAnonKey?.length || 0
});

if (!supabaseUrl || supabaseUrl === 'undefined') {
  console.error('❌ [CLIENT] NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL no está configurada');
  console.error('❌ [CLIENT] Valores recibidos:', {
    'NEXT_PUBLIC_SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL,
    'SUPABASE_URL': process.env.SUPABASE_URL
  });
  throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is required');
}

if (!supabaseAnonKey || supabaseAnonKey === 'undefined') {
  console.error('❌ [CLIENT] NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_ANON_KEY no está configurada');
  console.error('❌ [CLIENT] Valores recibidos:', {
    'NEXT_PUBLIC_SUPABASE_ANON_KEY': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    'SUPABASE_ANON_KEY': process.env.SUPABASE_ANON_KEY
  });
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY is required');
}

console.log('✅ [CLIENT] Variables validadas correctamente');
console.log('🔍 [CLIENT] DEBUG Variables de entorno finales:', {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_URL: process.env.SUPABASE_URL,
  urlUsada: supabaseUrl,
  env: process.env.NODE_ENV,
  timestamp: new Date().toISOString()
});

console.log('✅ [CLIENT] Supabase client configurado:', { 
  url: supabaseUrl, 
  keyLength: supabaseAnonKey.length,
  env: process.env.NODE_ENV,
  timestamp: new Date().toISOString()
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
