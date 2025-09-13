import { createClient } from '@supabase/supabase-js'

// Validar variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL no está configurada');
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
}

if (!supabaseServiceRole) {
  console.error('❌ SUPABASE_SERVICE_ROLE no está configurada');
  throw new Error('SUPABASE_SERVICE_ROLE is required');
}

console.log('✅ Supabase admin configurado:', { 
  url: supabaseUrl, 
  serviceRoleLength: supabaseServiceRole.length 
});

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRole, // solo backend
  { auth: { persistSession: false } }
)
