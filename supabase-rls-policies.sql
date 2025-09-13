-- Políticas de Row Level Security para MikroPanel
-- Ejecutar en Supabase SQL Editor DESPUÉS del esquema principal

-- 1. Desactivar RLS temporalmente para todas las tablas (desarrollo/testing)
-- NOTA: En producción real, deberías configurar políticas específicas

-- Desactivar RLS solo para las tablas que existen
DO $$
BEGIN
    -- Tablas principales del esquema
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'zonas') THEN
        ALTER TABLE zonas DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tarifas') THEN
        ALTER TABLE tarifas DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'clientes') THEN
        ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'equipos') THEN
        ALTER TABLE equipos DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'movimientos') THEN
        ALTER TABLE movimientos DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'gastos') THEN
        ALTER TABLE gastos DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ajustes_cobros') THEN
        ALTER TABLE ajustes_cobros DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cobros_mes') THEN
        ALTER TABLE cobros_mes DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cobros_cortes') THEN
        ALTER TABLE cobros_cortes DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'envios') THEN
        ALTER TABLE envios DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'envios_state') THEN
        ALTER TABLE envios_state DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'envios_movimientos') THEN
        ALTER TABLE envios_movimientos DISABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Tabla de storage genérico (puede no existir aún)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'app_storage') THEN
        ALTER TABLE app_storage DISABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Tabla de usuarios del esquema original
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'usuarios') THEN
        ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;


-- NOTA: Si en el futuro quieres usar RLS con políticas específicas,
-- puedes habilitar RLS y crear políticas personalizadas según tus necesidades de seguridad.
