// Interceptor para agregar Authorization header automáticamente a todas las requests

// Función para obtener el token del localStorage
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('auth_token');
  } catch {
    return null;
  }
}

// Función para limpiar el token y redirigir al login
function clearAuthAndRedirect() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('app_user');
    window.location.href = '/login';
  } catch {}
}

// Wrapper para fetch que agrega Authorization header automáticamente
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  
  const headers = new Headers(options.headers);
  
  // Agregar Authorization header si tenemos token
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  // Si recibimos 401, limpiar token y redirigir
  if (response.status === 401) {
    console.log('🔍 [AUTH-FETCH] Token expirado o inválido, limpiando y redirigiendo');
    clearAuthAndRedirect();
  }
  
  return response;
}

// Hook para usar en componentes React
export function useAuthFetch() {
  return authFetch;
}

// Función para verificar si el usuario está autenticado
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

// Función para logout
export function logout() {
  clearAuthAndRedirect();
}
