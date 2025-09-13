"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

// Componente que verifica la conexión con Supabase
export default function SupabaseStorageProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkConnection() {
      try {
        console.log('🚀 Verificando conexión con Supabase...');
        
        // Verificar conexión básica
        const { error } = await supabase.from('zonas').select('count').limit(1);
        
        if (error) {
          throw error;
        }
        
        setIsInitialized(true);
        console.log('✅ Conexión con Supabase establecida');
      } catch (err) {
        console.error('Error conectando con Supabase:', err);
        setError('Error conectando con la base de datos');
        setIsInitialized(true); // Continuar aunque haya error
      }
    }

    checkConnection();
  }, []);

  // Mostrar loading mientras se verifica la conexión
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Conectando con la base de datos...</p>
          {error && (
            <p className="text-xs text-red-500 mt-2">{error}</p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
