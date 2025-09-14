"use client";

import { LogOut } from "lucide-react";
import { logout } from "@/lib/fetch-interceptor";

export default function LogoutFab() {
  function handleLogout() {
    console.log('🔍 [LOGOUT] Cerrando sesión...');
    logout();
  }

  return (
    <button
      onClick={handleLogout}
      title="Cerrar sesión"
      className="fixed bottom-4 left-4 z-50 h-10 w-10 rounded-full bg-black text-white flex items-center justify-center shadow hover:bg-neutral-800 active:scale-95 transition"
    >
      <LogOut className="h-5 w-5" />
    </button>
  );
}
