-- Migración del sistema de usuarios a Supabase
-- Ejecutar en Supabase SQL Editor

-- 1. Crear tabla de usuarios con autenticación
CREATE TABLE IF NOT EXISTS auth_users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'tech',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,
  login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP
);

-- 2. Insertar usuarios actuales con contraseñas en texto plano (Supabase las hasheará)
INSERT INTO auth_users (username, password_hash, role, active) VALUES 
  ('misael', crypt('owner', gen_salt('bf')), 'owner', true),
  ('gaby', crypt('gaby12345', gen_salt('bf')), 'tech', true),
  ('kenny', crypt('kenny123', gen_salt('bf')), 'tech', true),
  ('thalia', crypt('thalia123', gen_salt('bf')), 'envios', true)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  active = EXCLUDED.active;

-- 3. Función para autenticar usuarios
CREATE OR REPLACE FUNCTION authenticate_user(
  p_username VARCHAR(50),
  p_password VARCHAR(255)
)
RETURNS TABLE(
  user_id UUID,
  username VARCHAR(50),
  role VARCHAR(20),
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  user_record RECORD;
  max_attempts INTEGER := 5;
  lockout_duration INTERVAL := '15 minutes';
BEGIN
  -- Buscar usuario
  SELECT * INTO user_record 
  FROM auth_users 
  WHERE auth_users.username = p_username AND active = true;
  
  -- Usuario no encontrado
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      NULL::UUID, 
      p_username, 
      ''::VARCHAR(20), 
      false, 
      'Usuario no encontrado'::TEXT;
    RETURN;
  END IF;
  
  -- Verificar si está bloqueado
  IF user_record.locked_until IS NOT NULL AND user_record.locked_until > NOW() THEN
    RETURN QUERY SELECT 
      user_record.id, 
      user_record.username, 
      user_record.role, 
      false, 
      'Usuario bloqueado temporalmente'::TEXT;
    RETURN;
  END IF;
  
  -- Verificar contraseña
  IF user_record.password_hash = crypt(p_password, user_record.password_hash) THEN
    -- Contraseña correcta - resetear intentos y actualizar último login
    UPDATE auth_users 
    SET 
      login_attempts = 0,
      locked_until = NULL,
      last_login = NOW(),
      updated_at = NOW()
    WHERE id = user_record.id;
    
    RETURN QUERY SELECT 
      user_record.id, 
      user_record.username, 
      user_record.role, 
      true, 
      'Login exitoso'::TEXT;
  ELSE
    -- Contraseña incorrecta - incrementar intentos
    UPDATE auth_users 
    SET 
      login_attempts = login_attempts + 1,
      locked_until = CASE 
        WHEN login_attempts + 1 >= max_attempts THEN NOW() + lockout_duration
        ELSE locked_until
      END,
      updated_at = NOW()
    WHERE id = user_record.id;
    
    RETURN QUERY SELECT 
      user_record.id, 
      user_record.username, 
      user_record.role, 
      false, 
      CASE 
        WHEN user_record.login_attempts + 1 >= max_attempts THEN 'Usuario bloqueado por múltiples intentos fallidos'
        ELSE 'Contraseña incorrecta'
      END::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Función para cambiar contraseñas
CREATE OR REPLACE FUNCTION change_password(
  p_username VARCHAR(50),
  p_old_password VARCHAR(255),
  p_new_password VARCHAR(255)
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Buscar usuario y verificar contraseña actual
  SELECT * INTO user_record 
  FROM auth_users 
  WHERE username = p_username AND active = true;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Usuario no encontrado'::TEXT;
    RETURN;
  END IF;
  
  IF user_record.password_hash != crypt(p_old_password, user_record.password_hash) THEN
    RETURN QUERY SELECT false, 'Contraseña actual incorrecta'::TEXT;
    RETURN;
  END IF;
  
  -- Actualizar contraseña
  UPDATE auth_users 
  SET 
    password_hash = crypt(p_new_password, gen_salt('bf')),
    updated_at = NOW()
  WHERE id = user_record.id;
  
  RETURN QUERY SELECT true, 'Contraseña actualizada correctamente'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger para updated_at
CREATE TRIGGER update_auth_users_updated_at 
  BEFORE UPDATE ON auth_users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Desactivar RLS para la tabla de usuarios (desarrollo)
ALTER TABLE auth_users DISABLE ROW LEVEL SECURITY;

-- 7. Crear índices para performance
CREATE INDEX IF NOT EXISTS idx_auth_users_username ON auth_users(username);
CREATE INDEX IF NOT EXISTS idx_auth_users_active ON auth_users(active);
CREATE INDEX IF NOT EXISTS idx_auth_users_role ON auth_users(role);
