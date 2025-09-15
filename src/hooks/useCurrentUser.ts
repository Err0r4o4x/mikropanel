import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { AppUser } from '@/lib/admin';

// Hook para obtener el usuario actual desde la BD
export function useCurrentUser() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        setIsLoading(true);
        setError(null);

        // Obtener el token JWT del localStorage
        const token = localStorage.getItem('auth_token');
        if (!token) {
          setUser(null);
          return;
        }

        // Decodificar el token para obtener el user_id
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userId = payload.id;

        if (!userId) {
          setUser(null);
          return;
        }

        // Consultar la BD para obtener los datos del usuario
        const { data, error: supabaseError } = await supabase
          .from('auth_users')
          .select('id, username, role, active')
          .eq('id', userId)
          .single();

        if (supabaseError) {
          console.error('Error obteniendo usuario:', supabaseError);
          setError('Error obteniendo datos del usuario');
          setUser(null);
          return;
        }

        if (!data || !data.active) {
          setUser(null);
          return;
        }

        // Convertir a formato AppUser
        const appUser: AppUser = {
          id: data.id,
          username: data.username,
          rol: data.role,
          isAdmin: data.role === 'owner' || data.role === 'admin'
        };

        setUser(appUser);
        console.log('✅ [USE-CURRENT-USER] Usuario cargado:', appUser);

      } catch (err) {
        console.error('Error crítico obteniendo usuario:', err);
        setError('Error crítico obteniendo usuario');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCurrentUser();
  }, []);

  return { user, isLoading, error };
}
