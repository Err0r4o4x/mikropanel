-- ========================================
-- MIKROPANEL - ESQUEMA COMPLETO SUPABASE
-- ========================================
-- Ejecutar este script completo en un NUEVO proyecto de Supabase
-- Incluye: Tablas, Datos iniciales, Usuarios, Permisos y Funciones

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================
-- 1. TABLAS PRINCIPALES DEL NEGOCIO
-- ========================================

-- 1.1 Zonas/Calles
CREATE TABLE zonas (
  id VARCHAR PRIMARY KEY,
  nombre VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 1.2 Tarifas por zona
CREATE TABLE tarifas (
  zona_id VARCHAR PRIMARY KEY REFERENCES zonas(id) ON DELETE CASCADE,
  precio_mb DECIMAL NOT NULL DEFAULT 5,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 1.3 Clientes
CREATE TABLE clientes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre VARCHAR NOT NULL,
  ip VARCHAR,
  mac VARCHAR,
  servicio INTEGER NOT NULL, -- Mb contratados
  router BOOLEAN DEFAULT false,
  switch BOOLEAN DEFAULT false,
  zona_id VARCHAR NOT NULL REFERENCES zonas(id),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 1.4 Equipos (Inventario)
CREATE TABLE equipos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  etiqueta VARCHAR NOT NULL,
  categoria VARCHAR DEFAULT 'general',
  precio_usd DECIMAL,
  estado_tipo VARCHAR NOT NULL DEFAULT 'disponible', -- 'disponible', 'vendido', 'asignado'
  estado_fecha TIMESTAMP,
  estado_cliente_id UUID REFERENCES clientes(id),
  estado_cliente_nombre VARCHAR,
  placeholder BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 1.5 Movimientos de inventario
CREATE TABLE movimientos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  fecha TIMESTAMP DEFAULT NOW(),
  equipo_id UUID NOT NULL REFERENCES equipos(id),
  equipo_etiqueta VARCHAR NOT NULL,
  actor VARCHAR NOT NULL,
  tipo VARCHAR NOT NULL, -- 'venta', 'asignacion'
  cliente_id UUID REFERENCES clientes(id),
  cliente_nombre VARCHAR,
  pagado BOOLEAN, -- solo para router
  created_at TIMESTAMP DEFAULT NOW()
);

-- 1.6 Gastos
CREATE TABLE gastos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  fecha TIMESTAMP DEFAULT NOW(),
  motivo VARCHAR NOT NULL,
  monto_usd DECIMAL NOT NULL,
  usuario VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 1.7 Ajustes de cobros
CREATE TABLE ajustes_cobros (
  id VARCHAR PRIMARY KEY, -- para mantener compatibilidad con IDs existentes
  yyyymm VARCHAR NOT NULL, -- YYYY-MM
  amount DECIMAL NOT NULL,
  label VARCHAR NOT NULL,
  created_iso TIMESTAMP DEFAULT NOW(),
  actor VARCHAR,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 1.8 Cortes mensuales
CREATE TABLE cobros_cortes (
  ym VARCHAR PRIMARY KEY, -- YYYY-MM
  ingreso DECIMAL NOT NULL,
  tecnicos DECIMAL NOT NULL,
  neto DECIMAL NOT NULL,
  created_iso TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 1.9 Cobros mensuales (cobranza)
CREATE TABLE cobros_mes (
  id VARCHAR PRIMARY KEY, -- yyyymm-clienteId
  yyyymm VARCHAR NOT NULL,
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  nombre VARCHAR NOT NULL,
  zona_id VARCHAR NOT NULL,
  mb INTEGER NOT NULL,
  tarifa DECIMAL NOT NULL,
  amount DECIMAL NOT NULL,
  pagado BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 1.10 Envíos
CREATE TABLE envios (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_iso TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR NOT NULL,
  items JSONB NOT NULL, -- Array de {key, display, qty}
  status VARCHAR NOT NULL DEFAULT 'en_camino', -- 'en_camino', 'disponible', 'recogido'
  arrived_iso TIMESTAMP,
  picked_iso TIMESTAMP,
  picked_by VARCHAR,
  inventory_added BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 1.11 Estado de envíos para cobros
CREATE TABLE envios_state (
  yyyymm VARCHAR PRIMARY KEY,
  total DECIMAL NOT NULL,
  remaining DECIMAL NOT NULL,
  created_iso TIMESTAMP DEFAULT NOW(),
  updated_iso TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 1.12 Movimientos de envíos
CREATE TABLE envios_movimientos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  yyyymm VARCHAR NOT NULL,
  amount DECIMAL NOT NULL,
  note VARCHAR,
  created_iso TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- 2. SISTEMA DE AUTENTICACIÓN
-- ========================================

-- 2.1 Tabla de usuarios con autenticación
CREATE TABLE auth_users (
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

-- ========================================
-- 3. STORAGE GENÉRICO (FALLBACK)
-- ========================================

-- 3.1 Tabla para datos sin tabla específica
CREATE TABLE app_storage (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key_name VARCHAR NOT NULL UNIQUE,
  value_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- 4. DATOS INICIALES
-- ========================================

-- 4.1 Zonas por defecto
INSERT INTO zonas (id, nombre) VALUES 
  ('carvajal', 'Carvajal'),
  ('santos-suarez', 'Santos Suarez'),
  ('san-francisco', 'San Francisco'),
  ('buenos-aires', 'Buenos Aires');

-- 4.2 Tarifas por defecto
INSERT INTO tarifas (zona_id, precio_mb) VALUES 
  ('carvajal', 5),
  ('santos-suarez', 7),
  ('san-francisco', 5),
  ('buenos-aires', 5);

-- 4.3 Usuarios del sistema
INSERT INTO auth_users (username, password_hash, role, active) VALUES 
  ('misael', crypt('owner', gen_salt('bf')), 'owner', true),
  ('gaby', crypt('gaby12345', gen_salt('bf')), 'tech', true),
  ('kenny', crypt('kenny123', gen_salt('bf')), 'tech', true),
  ('thalia', crypt('thalia123', gen_salt('bf')), 'envios', true);

-- ========================================
-- 5. FUNCIONES DE AUTENTICACIÓN
-- ========================================

-- 5.1 Función para autenticar usuarios
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

-- 5.2 Función para cambiar contraseñas
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

-- ========================================
-- 6. ÍNDICES PARA OPTIMIZACIÓN
-- ========================================

CREATE INDEX idx_clientes_zona ON clientes(zona_id);
CREATE INDEX idx_clientes_activo ON clientes(activo);
CREATE INDEX idx_equipos_etiqueta ON equipos(etiqueta);
CREATE INDEX idx_equipos_estado ON equipos(estado_tipo);
CREATE INDEX idx_movimientos_fecha ON movimientos(fecha);
CREATE INDEX idx_movimientos_equipo ON movimientos(equipo_id);
CREATE INDEX idx_gastos_fecha ON gastos(fecha);
CREATE INDEX idx_ajustes_yyyymm ON ajustes_cobros(yyyymm);
CREATE INDEX idx_cobros_mes_yyyymm ON cobros_mes(yyyymm);
CREATE INDEX idx_cobros_mes_pagado ON cobros_mes(pagado);
CREATE INDEX idx_auth_users_username ON auth_users(username);
CREATE INDEX idx_auth_users_active ON auth_users(active);
CREATE INDEX idx_auth_users_role ON auth_users(role);
CREATE INDEX idx_app_storage_key ON app_storage(key_name);

-- ========================================
-- 7. TRIGGERS PARA UPDATED_AT
-- ========================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para todas las tablas
CREATE TRIGGER update_zonas_updated_at BEFORE UPDATE ON zonas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tarifas_updated_at BEFORE UPDATE ON tarifas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_equipos_updated_at BEFORE UPDATE ON equipos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cobros_mes_updated_at BEFORE UPDATE ON cobros_mes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_envios_updated_at BEFORE UPDATE ON envios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_envios_state_updated_at BEFORE UPDATE ON envios_state FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_auth_users_updated_at BEFORE UPDATE ON auth_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_app_storage_updated_at BEFORE UPDATE ON app_storage FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 8. DESACTIVAR ROW LEVEL SECURITY
-- ========================================

-- Desactivar RLS para desarrollo (acceso completo)
ALTER TABLE zonas DISABLE ROW LEVEL SECURITY;
ALTER TABLE tarifas DISABLE ROW LEVEL SECURITY;
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE equipos DISABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos DISABLE ROW LEVEL SECURITY;
ALTER TABLE gastos DISABLE ROW LEVEL SECURITY;
ALTER TABLE ajustes_cobros DISABLE ROW LEVEL SECURITY;
ALTER TABLE cobros_cortes DISABLE ROW LEVEL SECURITY;
ALTER TABLE cobros_mes DISABLE ROW LEVEL SECURITY;
ALTER TABLE envios DISABLE ROW LEVEL SECURITY;
ALTER TABLE envios_state DISABLE ROW LEVEL SECURITY;
ALTER TABLE envios_movimientos DISABLE ROW LEVEL SECURITY;
ALTER TABLE auth_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_storage DISABLE ROW LEVEL SECURITY;

-- ========================================
-- 9. MENSAJE DE CONFIRMACIÓN
-- ========================================

SELECT 
  '✅ MikroPanel Schema instalado correctamente' as status,
  'Tablas creadas: ' || count(*) as tables_created
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'zonas', 'tarifas', 'clientes', 'equipos', 'movimientos', 
    'gastos', 'ajustes_cobros', 'cobros_cortes', 'cobros_mes', 
    'envios', 'envios_state', 'envios_movimientos', 
    'auth_users', 'app_storage'
  );

-- Verificar usuarios creados
SELECT 
  '👥 Usuarios creados: ' || count(*) as users_created,
  string_agg(username || ' (' || role || ')', ', ') as user_list
FROM auth_users;
