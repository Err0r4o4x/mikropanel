import { createClient } from '@supabase/supabase-js'

// Validar variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL no está configurada');
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
}

if (!supabaseAnonKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY no está configurada');
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
}

console.log('✅ Supabase client configurado:', { 
  url: supabaseUrl, 
  keyLength: supabaseAnonKey.length 
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
