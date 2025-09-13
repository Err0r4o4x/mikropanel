"use client";

// Componente temporal para diagnosticar variables de entorno
export default function EnvDiagnostic() {
  // Debug completado - Panel desactivado
  return null;

  const envVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 
      `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 10)}...` : 'NO DEFINIDA',
    NODE_ENV: process.env.NODE_ENV,
  };

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px',
      fontSize: '12px',
      borderRadius: '5px',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <h4>🔧 Debug Variables de Entorno:</h4>
      {Object.entries(envVars).map(([key, value]) => (
        <div key={key}>
          <strong>{key}:</strong> {value || 'NO DEFINIDA'}
        </div>
      ))}
      <div style={{ marginTop: '10px', fontSize: '10px' }}>
        <em>Este panel se eliminará después del debug</em>
      </div>
    </div>
  );
}
