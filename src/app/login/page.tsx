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

    console.log('🔍 [LOGIN] Iniciando proceso de login...', { username: username.toLowerCase().trim() });
    setLoading(true);
    
    try {
      console.log('🔍 [LOGIN] Enviando request a /api/login...');
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      console.log('🔍 [LOGIN] Respuesta recibida:', { 
        status: res.status, 
        ok: res.ok,
        statusText: res.statusText 
      });

      if (res.ok) {
        console.log('✅ [LOGIN] Respuesta exitosa, procesando datos...');
        try {
          const data = await res.json();
          console.log('🔍 [LOGIN] Datos recibidos:', { 
            ok: data.ok, 
            hasToken: !!data.token,
            tokenLength: data.token?.length,
            user: data.user 
          });
          
          const user = data.user;
          const token = data.token;

          if (!token) {
            setError("No se recibió token de autenticación");
            return;
          }

          // Ya no guardamos en localStorage - los datos se guardan en Supabase
          console.log('✅ [LOGIN] Token recibido');

          // Guardar usuario en localStorage para la UI (sidebar, permisos)
          setCurrentUser({
            id: user.id,
            username: user.username,
            rol: user.role,
            isAdmin: user.role === "admin" || user.role === "owner",
          });
          
          console.log('✅ [LOGIN] Usuario guardado en localStorage');
        } catch (error) {
          console.error('❌ [LOGIN] Error procesando respuesta de login:', error);
          setError("Error procesando respuesta del servidor");
          return;
        }

        console.log('🔍 [LOGIN] Redirigiendo a dashboard...');
        router.replace("/");
        return;
      }

      console.log('❌ [LOGIN] Respuesta no exitosa, procesando error...');
      const data = await res.json().catch(() => ({}));
      console.log('🔍 [LOGIN] Error recibido:', data);
      setError(data?.error ?? "Credenciales inválidas");
    } catch (error) {
      console.error('❌ [LOGIN] Error de conexión:', error);
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
