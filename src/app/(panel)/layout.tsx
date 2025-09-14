"use client";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/ui/Sidebar";
import LogoutFab from "@/components/ui/LogoutFab";
import SeedUsers from "@/components/ui/SeedUsers";
import { isAuthenticated } from "@/lib/fetch-interceptor";

export default function PanelLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const authenticated = isAuthenticated();
      console.log('🔍 [PANEL-LAYOUT] Verificando autenticación:', { authenticated });
      
      if (!authenticated) {
        console.log('❌ [PANEL-LAYOUT] No autenticado, redirigiendo a login');
        router.replace("/login");
        return;
      }
      
      setIsAuth(true);
      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-slate-600">Verificando autenticación...</div>
      </div>
    );
  }

  if (!isAuth) {
    return null; // Se está redirigiendo
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <main className="flex-1 p-6 relative">
        <SeedUsers />
        {children}
        <LogoutFab />
      </main>
    </div>
  );
}
