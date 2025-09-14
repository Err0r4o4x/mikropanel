"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { initialSync, startPeriodicSync } from '@/lib/sync-manager';

interface SyncContextType {
  isInitialSyncComplete: boolean;
  lastSyncTime: Date | null;
  syncStatus: 'idle' | 'syncing' | 'error';
}

const SyncContext = createContext<SyncContextType>({
  isInitialSyncComplete: false,
  lastSyncTime: null,
  syncStatus: 'idle'
});

export function useSyncStatus() {
  return useContext(SyncContext);
}

interface SyncProviderProps {
  children: React.ReactNode;
}

export default function SyncProvider({ children }: SyncProviderProps) {
  const [isInitialSyncComplete, setIsInitialSyncComplete] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');

  useEffect(() => {
    let stopPeriodicSync: (() => void) | null = null;

    const initializeSync = async () => {
      try {
        setSyncStatus('syncing');
        console.log('🔍 [SYNC-PROVIDER] Iniciando sincronización inicial...');
        
        await initialSync();
        
        setIsInitialSyncComplete(true);
        setLastSyncTime(new Date());
        setSyncStatus('idle');
        
        console.log('✅ [SYNC-PROVIDER] Sincronización inicial completada');
        
        // Iniciar sincronización periódica
        stopPeriodicSync = startPeriodicSync();
        
        // Actualizar timestamp cada vez que se sincroniza
        const updateSyncTime = () => setLastSyncTime(new Date());
        window.addEventListener('sync-completed', updateSyncTime);
        
        return () => {
          window.removeEventListener('sync-completed', updateSyncTime);
        };
        
      } catch (error) {
        console.error('❌ [SYNC-PROVIDER] Error en sincronización inicial:', error);
        setSyncStatus('error');
      }
    };

    initializeSync();

    // Cleanup
    return () => {
      if (stopPeriodicSync) {
        stopPeriodicSync();
      }
    };
  }, []);

  const contextValue: SyncContextType = {
    isInitialSyncComplete,
    lastSyncTime,
    syncStatus
  };

  return (
    <SyncContext.Provider value={contextValue}>
      {children}
      {/* Indicador visual de sincronización */}
      {syncStatus === 'syncing' && (
        <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Sincronizando...
          </div>
        </div>
      )}
      {syncStatus === 'error' && (
        <div className="fixed top-4 right-4 z-50 bg-red-600 text-white px-3 py-2 rounded-lg shadow-lg text-sm">
          Error de sincronización
        </div>
      )}
    </SyncContext.Provider>
  );
}
