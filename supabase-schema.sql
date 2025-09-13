-- MikroPanel Database Schema
-- Ejecutar este script en Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Zonas/Calles
CREATE TABLE zonas (
  id VARCHAR PRIMARY KEY,
  nombre VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Tarifas por zona
CREATE TABLE tarifas (
  zona_id VARCHAR PRIMARY KEY REFERENCES zonas(id) ON DELETE CASCADE,
  precio_mb DECIMAL NOT NULL DEFAULT 5,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Clientes
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

-- 4. Equipos (Inventario)
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

-- 5. Movimientos de inventario (ya existe, pero la extendemos)
DROP TABLE IF EXISTS movimientos;
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

-- 6. Gastos
CREATE TABLE gastos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  fecha TIMESTAMP DEFAULT NOW(),
  motivo VARCHAR NOT NULL,
  monto_usd DECIMAL NOT NULL,
  usuario VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. Ajustes de cobros
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

-- 8. Cortes mensuales
CREATE TABLE cobros_cortes (
  ym VARCHAR PRIMARY KEY, -- YYYY-MM
  ingreso DECIMAL NOT NULL,
  tecnicos DECIMAL NOT NULL,
  neto DECIMAL NOT NULL,
  created_iso TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 9. Cobros mensuales (cobranza)
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

-- 10. Envíos
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

-- 11. Estado de envíos para cobros
CREATE TABLE envios_state (
  yyyymm VARCHAR PRIMARY KEY,
  total DECIMAL NOT NULL,
  remaining DECIMAL NOT NULL,
  created_iso TIMESTAMP DEFAULT NOW(),
  updated_iso TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 12. Movimientos de envíos
CREATE TABLE envios_movimientos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  yyyymm VARCHAR NOT NULL,
  amount DECIMAL NOT NULL,
  note VARCHAR,
  created_iso TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 13. Tabla auxiliar para datos de localStorage que no tienen tabla específica
CREATE TABLE app_storage (
  key_name VARCHAR PRIMARY KEY,
  value_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insertar datos base (zonas y tarifas por defecto)
INSERT INTO zonas (id, nombre) VALUES 
  ('carvajal', 'Carvajal'),
  ('santos-suarez', 'Santos Suarez'),
  ('san-francisco', 'San Francisco'),
  ('buenos-aires', 'Buenos Aires')
ON CONFLICT (id) DO NOTHING;

INSERT INTO tarifas (zona_id, precio_mb) VALUES 
  ('carvajal', 5),
  ('santos-suarez', 7),
  ('san-francisco', 5),
  ('buenos-aires', 5)
ON CONFLICT (zona_id) DO NOTHING;

-- Índices para optimizar consultas
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
CREATE INDEX idx_app_storage_key ON app_storage(key_name);

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_zonas_updated_at BEFORE UPDATE ON zonas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tarifas_updated_at BEFORE UPDATE ON tarifas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_equipos_updated_at BEFORE UPDATE ON equipos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cobros_mes_updated_at BEFORE UPDATE ON cobros_mes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_envios_updated_at BEFORE UPDATE ON envios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_envios_state_updated_at BEFORE UPDATE ON envios_state FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_app_storage_updated_at BEFORE UPDATE ON app_storage FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
