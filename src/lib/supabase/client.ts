import { createClient } from '@supabase/supabase-js'

// Validar variables de entorno con fallbacks para debugging
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://eejaqsqhsnljydylcuey.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlamFxc3Foc25sanlkeWxjdWV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3ODUwNjEsImV4cCI6MjA3MzM2MTA2MX0.-C00cUJcgrXsYw_LMrjUrEB-y9vTH1ulEytUgRx0j6k';

if (!supabaseUrl || supabaseUrl === 'undefined') {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL no está configurada');
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
}

if (!supabaseAnonKey || supabaseAnonKey === 'undefined') {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY no está configurada');
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
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
})
