"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Home, Users, Boxes, Wallet, Receipt, Settings, Truck, Inbox } from "lucide-react";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { isAdminUser } from "@/lib/admin";
import type { Role } from "@/lib/admin";

/* ========= Helpers de UI ========= */
function titleCase(s: string) {
  return (s || "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toLocaleUpperCase("es-ES") + w.slice(1).toLocaleLowerCase("es-ES"))
    .join(" ");
}
function roleChipClasses(role: string) {
  switch (role) {
    case "owner":
      return "bg-purple-50 border-purple-200 text-purple-700";
    case "admin":
      return "bg-emerald-50 border-emerald-200 text-emerald-700";
    case "tech":
      return "bg-blue-50 border-blue-200 text-blue-700";
    case "envios":
      return "bg-amber-50 border-amber-200 text-amber-700";
    default:
      return "bg-slate-100 border-slate-200 text-slate-600";
  }
}

/* ========= Cobranza helpers ========= */
// Ya no usamos localStorage - los datos vienen de Supabase

/* ========= Envíos helpers ========= */
// Ya no usamos localStorage - los datos vienen de Supabase

// function monthKey(d: Date | string = new Date()) {
//   const dt = typeof d === "string" ? new Date(d) : d;
//   return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
// }

/** Visibilidad de “Cobranza” para NO admin */
function shouldShowCobranzaForNonAdmin(): boolean {
  // Ya no usamos localStorage - los datos vienen de Supabase
  return false; // Simplificado por ahora
}

export default function Sidebar() {
  const pathname = usePathname();

  // Usuario/rol desde BD
  const { user, isLoading: userLoading } = useCurrentUser();
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [role, setRole] = useState<Role | "">("");

  // Visibilidad "Cobranza"
  const [showCobranza, setShowCobranza] = useState(false);

  // Hay envíos pendientes (no recogidos)
  const [hasPendingEnvios, setHasPendingEnvios] = useState(false);

  /* === Efecto 1: sincroniza usuario/rol === */
  useEffect(() => {
    if (userLoading) return;

    const admin = isAdminUser(user);
    const userRole = user?.rol as Role || "";
    
    console.log('🔍 [SIDEBAR] Usuario actual:', user);
    console.log('🔍 [SIDEBAR] Es admin:', admin);
    console.log('🔍 [SIDEBAR] Rol:', userRole);
    
    setIsAdmin(admin);
    setUserName(titleCase(user?.username ?? "")); // nombre con mayúsculas
    setRole(userRole);
    setChecked(true);
  }, [user, userLoading]);

  /* === Efecto 2: calcula visibilidad de "Cobranza" === */
  useEffect(() => {
    if (userLoading) return;

    const admin = isAdminUser(user);
    setShowCobranza(admin ? true : shouldShowCobranzaForNonAdmin());
  }, [user, userLoading]);

  /* === Efecto 3: detecta si hay envíos pendientes === */
  useEffect(() => {
    if (userLoading) return;

    // Ya no usamos localStorage - los datos vienen de Supabase
    const pending = false; // Simplificado por ahora
    setHasPendingEnvios(Boolean(pending));
  }, [userLoading]);

  /* === Menú según permisos === */
  const isEnviosUser = role === "owner" || role === "admin" || role === "envios";

  const navItems = [
    { href: "/", label: "Pantalla principal", icon: Home },
    { href: "/usuarios", label: "Usuarios", icon: Users },
    { href: "/inventario", label: "Inventario", icon: Boxes },

    // Gestión envío (solo admin/envios)
    ...(isEnviosUser ? [{ href: "/envios", label: "Gestión envío", icon: Truck }] : []),

    // Envíos pendientes (si hay alguno no recogido) — visible para todos
    ...(hasPendingEnvios ? [{ href: "/envios", label: "Envíos pendientes", icon: Inbox }] : []),

    // Cobranza: admin siempre; no-admin según regla
    ...(showCobranza ? [{ href: "/cobranza", label: "Cobranza", icon: Wallet }] : []),

    // Cobros: SOLO admin
    ...(isAdmin ? [{ href: "/cobros", label: "Cobros", icon: Wallet }] : []),

    { href: "/gastos", label: "Gastos", icon: Receipt },
  ] as { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 border-r bg-white">
      {/* Header: usuario + rol */}
      <div className="p-4 flex items-center justify-between gap-2">
        <span className="font-semibold truncate" title={userName}>
          {userName}
        </span>
        {checked && role && (
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full border ${roleChipClasses(role)}`}
            title={`Rol: ${titleCase(role)}`}
          >
            {titleCase(role)}
          </span>
        )}
      </div>

      <Separator />

      <nav className="p-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href}>
              <Button
                variant={active ? "default" : "ghost"}
                className="w-full justify-start gap-2"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            </Link>
          );
        })}

        {/* Configuración: SOLO admin */}
        {checked && isAdmin && (
          <Link href="/configuracion">
            <Button
              variant={pathname === "/configuracion" ? "default" : "ghost"}
              className="w-full justify-start gap-2"
              title="Configuración (solo admin)"
            >
              <Settings className="h-4 w-4" />
              Configuración
            </Button>
          </Link>
        )}
      </nav>
    </aside>
  );
}
