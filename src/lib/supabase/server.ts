import { createClient } from '@supabase/supabase-js'

// Validar variables de entorno con fallbacks para debugging
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://eejaqsqhsnljydylcuey.supabase.co';
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlamFxc3Foc25sanlkeWxjdWV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzc4NTA2MSwiZXhwIjoyMDczMzYxMDYxfQ.7zSD3UHMjPiNGaxdn0e8op50QEvASkvYA7en8aUrDc8';

if (!supabaseUrl || supabaseUrl === 'undefined') {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL no está configurada');
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
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
