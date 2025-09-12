import type { ReactNode } from "react";
import Sidebar from "@/components/ui/Sidebar";
import LogoutFab from "@/components/ui/LogoutFab";
import { redirect } from "next/navigation";
import { getUserFromCookie } from "@/lib/auth";
import SeedUsers from "@/components/ui/SeedUsers"; // ajusta el path si lo creaste fuera de /ui

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await getUserFromCookie();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <main className="flex-1 p-6 relative">
        {/* Crea app_users en localStorage si no existe */}
        <SeedUsers />
        {children}
        <LogoutFab />
      </main>
    </div>
  );
}
