// src/lib/admin.ts

// ========= Tipos =========
export type AppUser = {
  id: string;
  username: string;
  name?: string;
  email?: string;
  rol?: string;          // "admin" | "tech" | "envios" | "viewer"
  isAdmin?: boolean;
  role?: string;         // alias de rol
};

// Roles soportados (incluyo "viewer" por si lo usas en otros lados)
export type Role = "admin" | "tech" | "envios" | "viewer";

// ========= Utils de formato =========
function toTitle(s: string): string {
  const clean = String(s ?? "").trim();
  if (!clean) return "";
  // Capitaliza cada palabra separada por espacios o guiones
  return clean
    .split(/[\s-]+/g)
    .map(w => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

/** Nombre para mostrar: username > name > local-part de email; capitalizado */
export function getDisplayName(u: AppUser | null): string {
  if (!u) return "Invitado";
  const base =
    u.username?.trim() ||
    u.name?.trim() ||
    (typeof u.email === "string" ? u.email.split("@")[0] : "");
  return toTitle(base || "Invitado");
}

// ========= Storage =========
export const APP_USER_KEY = "app_user";

function lsGet(): string | null {
  // Ya no usamos localStorage - los datos vienen de Supabase
  return null;
}
function lsSet(v: string) {
  // Ya no guardamos en localStorage - los datos se guardan en Supabase
  console.log("Guardando usuario:", v);
}
function lsDel() {
  // Ya no usamos localStorage - los datos se guardan en Supabase
  console.log("Eliminando usuario");
}

// ========= Normalización de rol =========
function normalizeRole(raw?: string, isAdminFlag?: boolean): Role | "" {
  const r = String(raw ?? "").toLowerCase();
  if (r === "admin" || isAdminFlag) return "admin";
  if (r === "tech") return "tech";
  if (r === "envios") return "envios";
  if (r === "viewer") return "viewer";
  return "";
}

// ========= API de usuario actual =========
export function getCurrentUser(): AppUser | null {
  const raw = lsGet();
  if (!raw) return null;

  try {
    const u = JSON.parse(raw);

    // Si estaba guardado como string simple
    if (typeof u === "string") {
      return {
        id: `u-${u}`,
        username: u,
        rol: u.toLowerCase() === "misael" ? "admin" : "tech",
      };
    }

    // Normaliza username
    const username =
      u?.username ??
      u?.name ??
      u?.user ??
      (typeof u?.email === "string" ? u.email.split("@")[0] : undefined);

    return {
      id: u?.id ?? `u-${String(username ?? "user").trim()}`,
      username: String(username ?? "").trim(),
      rol: u?.rol ?? u?.role,
      isAdmin: u?.isAdmin === true,
      email: u?.email,
      name: u?.name,
    };
  } catch {
    // Si era un JSON inválido, usa como fallback
    const s = raw.toLowerCase();
    return { id: `u-${s}`, username: s, rol: s === "misael" ? "admin" : "tech" };
  }
}

export function setCurrentUser(u: AppUser | string) {
  if (typeof u === "string") {
    const user: AppUser = {
      id: `u-${u}`,
      username: u,
      rol: u.toLowerCase() === "misael" ? "admin" : "tech",
    };
    lsSet(JSON.stringify(user));
    return;
  }
  // Asegura que tenga id/username mínimos
  const normalized: AppUser = {
    id: u.id || `u-${(u.username || u.name || u.email || "user").toString()}`,
    username: u.username || u.name || (u.email ? u.email.split("@")[0] : "") || "user",
    rol: u.rol ?? u.role,
    isAdmin: u.isAdmin,
    email: u.email,
    name: u.name,
  };
  lsSet(JSON.stringify(normalized));
}

export function clearCurrentUser() {
  lsDel();
}

/** Admin si: username === "misael" || rol === "admin" || isAdmin === true */
export function isAdminUser(u: AppUser | null): boolean {
  if (!u) return false;
  const uname = (u.username ?? "").toLowerCase();
  const role = String(u.rol ?? u.role ?? "").toLowerCase();
  return uname === "misael" || role === "admin" || u.isAdmin === true;
}

// ========= RBAC =========
export function getRole(): Role | "" {
  const u = getCurrentUser();
  // prioridad: flag admin -> admin; luego rol declarado
  const norm = normalizeRole(u?.rol ?? u?.role, u?.isAdmin);
  // también tratamos username "misael" como admin
  if ((u?.username ?? "").toLowerCase() === "misael") return "admin";
  return norm;
}

/**
 * PERM: matriz de permisos
 * - envíos NO puede crear usuarios ni gastos ni equipos
 * - envíos SÍ puede registrar movimientos en inventario
 */
export const PERM = {
  // Configuración / administración general
  viewConfig:   (r: Role | "") => r === "admin",

  // Inventario
  newEquipo:    (r: Role | "") => r === "admin",                               // envíos NO
  deleteEquipo: (r: Role | "") => r === "admin",                               // envíos NO
  registrarMov: (r: Role | "") => r === "admin" || r === "tech" || r === "envios", // envíos SÍ

  // Usuarios
  addUsuario:   (r: Role | "") => r === "admin",                               // envíos NO
  editUsuario:  (r: Role | "") => r === "admin",                               // cambia si quieres permitir a tech

  // Gastos / Cobros
  addGasto:     (r: Role | "") => r === "admin" || r === "tech",               // envíos NO
  viewCobros:   (r: Role | "") => r === "admin",             // si no quieres que vea, deja solo "admin"

  // Lectura pura
  readOnly:     (r: Role | "") => r === "viewer",
  //eliminar usuario 
  deleteUsuario: (r: Role | "") => r === "admin",
  // 👇 NUEVO
  crearEnvio:      (r: Role | "") => r === "admin" || r === "envios",
  marcarDisponible:(r: Role | "") => r === "admin" || r === "envios", // llegada a depósito
  recogerEnvio:    (r: Role | "") => r === "admin" || r === "tech",   // retiro por técnicos
};


