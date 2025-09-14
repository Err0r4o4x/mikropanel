import { createClient } from '@supabase/supabase-js'

// Validar variables de entorno - Servidor puede usar ambas
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || supabaseUrl === 'undefined') {
  console.error('❌ SUPABASE_URL o NEXT_PUBLIC_SUPABASE_URL no está configurada');
  throw new Error('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required');
}

if (!supabaseServiceRole || supabaseServiceRole === 'undefined') {
  console.error('❌ SUPABASE_SERVICE_ROLE no está configurada');
  throw new Error('SUPABASE_SERVICE_ROLE is required');
}

console.log('✅ Supabase admin configurado:', { 
  url: supabaseUrl, 
  serviceRoleLength: supabaseServiceRole.length,
  env: process.env.NODE_ENV
});

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRole, // solo backend
  { 
    auth: { 
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
)
