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
        // ✅ Obtener datos del usuario desde la respuesta de la API
        try {
          const data = await res.json();
          const user = data.user;

          // Guardar usuario en localStorage para la UI (sidebar, permisos)
          setCurrentUser({
            id: user.id,
            username: user.username,
            rol: user.role,
            isAdmin: user.role === "admin" || user.role === "owner",
          });
        } catch (error) {
          console.error('Error procesando respuesta de login:', error);
          // Continuar aunque falle el localStorage
        }

        // La API ya estableció la cookie JWT → redirigir al panel
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
