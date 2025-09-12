"use client";
import { useRouter } from "next/navigation";
import { setCurrentUser } from "@/lib/admin";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Completa usuario y contraseña");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        // ✅ Guardar usuario con ROL en localStorage para la UI (sidebar, permisos)
        try {
          const uname = username.trim().toLowerCase();

          // Lee la "semilla" de usuarios persistida por SeedUsers
          const seedRaw = localStorage.getItem("app_users");
          const seed = seedRaw ? JSON.parse(seedRaw) : [];
          const found = Array.isArray(seed)
            ? seed.find((u: any) => (u?.username || "").toLowerCase() === uname)
            : null;

          // Rol por seed; si no hay seed, default: misael=admin, otros=tech
          const rol: string = found?.rol || (uname === "misael" ? "admin" : "tech");

          setCurrentUser({
            id: `u-${uname}`,
            username: uname,            // lo mostramos Capitalizado en el Sidebar
            rol,
            isAdmin: rol === "admin",
          });
        } catch {
          // Si por alguna razón falla la semilla, igual seguimos: la cookie ya está
        }

        // La API ya te setea cookie 'auth' → redirige al panel
        router.replace("/");
        return;
      }

      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "Credenciales inválidas");
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Iniciar sesión</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-3">
            <div className="space-y-2">
              <Input
                name="username"
                placeholder="Usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
              <Input
                name="password"
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
