# 🗄️ CONFIGURACIÓN DEFINITIVA DE SUPABASE - MIKROPANEL

## 📋 INSTRUCCIONES PARA DESPLIEGUE EN PRODUCCIÓN

### 🚀 **PASO 1: Crear Proyecto en Supabase**

1. Ve a [Supabase](https://supabase.com)
2. Crea un **NUEVO PROYECTO**
3. Anota las credenciales:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE` (desde Settings > API)

### 🗄️ **PASO 2: Ejecutar Esquema de Base de Datos**

1. Ve a tu proyecto en Supabase
2. Abre **SQL Editor**
3. Ejecuta **TODO** el contenido del archivo: `mikropanel-complete-schema.sql`
4. Verifica que aparezca el mensaje: ✅ MikroPanel Schema instalado correctamente

### 🔐 **PASO 3: Configurar Variables de Entorno en Vercel**

En el dashboard de Vercel, agregar estas variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
JWT_SECRET=tu-secret-super-seguro-de-al-menos-32-caracteres
```

### ✅ **PASO 4: Verificar Instalación**

Después del despliegue, verifica:

1. **Login funciona** con estos usuarios:
   - `misael` / `owner` (Administrador)
   - `gaby` / `gaby12345` (Técnico)
   - `kenny` / `kenny123` (Técnico)
   - `thalia` / `thalia123` (Envíos)

2. **Datos iniciales** están cargados:
   - 4 zonas: Carvajal, Santos Suarez, San Francisco, Buenos Aires
   - Tarifas por zona configuradas

## 📊 **LO QUE INCLUYE EL ESQUEMA**

### **🏢 Tablas del Negocio:**
- ✅ `zonas` - Zonas/calles del negocio
- ✅ `tarifas` - Precios por zona
- ✅ `clientes` - Información de clientes
- ✅ `equipos` - Inventario de equipos
- ✅ `movimientos` - Movimientos de inventario
- ✅ `gastos` - Registro de gastos
- ✅ `ajustes_cobros` - Ajustes para cobros
- ✅ `cobros_cortes` - Cortes mensuales
- ✅ `cobros_mes` - Cobros mensuales
- ✅ `envios` - Gestión de envíos
- ✅ `envios_state` - Estado de envíos
- ✅ `envios_movimientos` - Movimientos de envíos

### **🔐 Sistema de Autenticación:**
- ✅ `auth_users` - Usuarios con roles y contraseñas hasheadas
- ✅ Función `authenticate_user()` - Login seguro con bloqueo
- ✅ Función `change_password()` - Cambio de contraseñas
- ✅ Sistema de bloqueo por intentos fallidos (5 intentos = 15 min)

### **💾 Storage Genérico:**
- ✅ `app_storage` - Para datos sin tabla específica

### **⚡ Optimizaciones:**
- ✅ Índices en todas las columnas importantes
- ✅ Triggers para `updated_at` automático
- ✅ RLS desactivado para desarrollo
- ✅ Extensiones necesarias habilitadas

## 🔐 **USUARIOS PREDETERMINADOS**

| Usuario | Contraseña | Rol | Descripción |
|---------|------------|-----|-------------|
| `misael` | `owner` | owner | Administrador principal |
| `gaby` | `gaby12345` | tech | Técnico |
| `kenny` | `kenny123` | tech | Técnico |
| `thalia` | `thalia123` | envios | Gestión de envíos |

## ⚠️ **IMPORTANTE**

1. **UN SOLO ARCHIVO**: Solo ejecutar `mikropanel-complete-schema.sql`
2. **PROYECTO NUEVO**: Este esquema es para un proyecto completamente nuevo
3. **NO EJECUTAR OTROS**: Los demás archivos SQL han sido eliminados
4. **VERIFICAR MENSAJE**: Debe aparecer confirmación de instalación exitosa

## 🛠️ **SOLUCIÓN DE PROBLEMAS**

### Error: "Extension not found"
```sql
-- Ejecutar primero si es necesario:
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

### Error: "Function already exists"
- Normal si re-ejecutas el script
- Las funciones se recrean automáticamente

### Error de conexión desde la app
- Verificar variables de entorno en Vercel
- Verificar que las URLs no tengan espacios o caracteres extra

## 🎯 **RESULTADO ESPERADO**

Después de seguir estos pasos:
- ✅ Base de datos completamente configurada
- ✅ Sistema de autenticación funcionando
- ✅ Usuarios predeterminados creados
- ✅ Datos iniciales cargados
- ✅ Aplicación lista para producción
