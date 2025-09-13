"use client";

import { useEffect, useState } from 'react';
import { migrateAndActivate } from '@/lib/storage-override';

// Componente que inicializa Supabase Storage automáticamente
export default function SupabaseStorageProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initializeStorage() {
      try {
        // Variables de entorno correctas - Reactivando Supabase Storage
        console.log('🚀 Iniciando migración a Supabase Storage...');
        await migrateAndActivate();
        setIsInitialized(true);
        console.log('✅ Supabase Storage activado correctamente');
      } catch (err) {
        console.error('Error inicializando Supabase Storage:', err);
        setError('Error conectando con la base de datos');
        setIsInitialized(true);
      }
    }

    initializeStorage();
  }, []);

  // Mostrar loading mientras se inicializa
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
