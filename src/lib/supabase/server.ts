import { createClient } from '@supabase/supabase-js'

console.log('🚀 [SERVER] Iniciando configuración de Supabase server...');
console.log('🔍 [SERVER] Variables de entorno disponibles:', {
  'process.env.SUPABASE_URL': process.env.SUPABASE_URL,
  'process.env.NEXT_PUBLIC_SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL,
  'process.env.SUPABASE_SERVICE_ROLE': process.env.SUPABASE_SERVICE_ROLE ? `${process.env.SUPABASE_SERVICE_ROLE.substring(0, 20)}...` : 'NO DEFINIDA',
  'process.env.NODE_ENV': process.env.NODE_ENV,
  'typeof window': typeof window
});

// Validar variables de entorno - Servidor puede usar ambas
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE;

console.log('🔍 [SERVER] Después de asignación:', {
  supabaseUrl: supabaseUrl,
  supabaseServiceRole: supabaseServiceRole ? `${supabaseServiceRole.substring(0, 20)}...` : 'NO DEFINIDA',
  urlLength: supabaseUrl?.length || 0,
  serviceRoleLength: supabaseServiceRole?.length || 0
});

if (!supabaseUrl || supabaseUrl === 'undefined') {
  console.error('❌ [SERVER] SUPABASE_URL o NEXT_PUBLIC_SUPABASE_URL no está configurada');
  console.error('❌ [SERVER] Valores recibidos:', {
    'SUPABASE_URL': process.env.SUPABASE_URL,
    'NEXT_PUBLIC_SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL
  });
  throw new Error('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required');
}

if (!supabaseServiceRole || supabaseServiceRole === 'undefined') {
  console.error('❌ [SERVER] SUPABASE_SERVICE_ROLE no está configurada');
  console.error('❌ [SERVER] Valores recibidos:', {
    'SUPABASE_SERVICE_ROLE': process.env.SUPABASE_SERVICE_ROLE
  });
  throw new Error('SUPABASE_SERVICE_ROLE is required');
}

console.log('✅ [SERVER] Variables validadas correctamente');
console.log('✅ [SERVER] Supabase admin configurado:', { 
  url: supabaseUrl, 
  serviceRoleLength: supabaseServiceRole.length,
  env: process.env.NODE_ENV,
  timestamp: new Date().toISOString()
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
