# 🗄️ Configuración de Supabase para MikroPanel

Esta guía te ayuda a configurar Supabase para que MikroPanel use la base de datos en lugar de localStorage.

## 📋 Requisitos Previos

1. Cuenta en [Supabase](https://supabase.com)
2. Proyecto creado en Supabase
3. Credenciales de tu proyecto

## 🚀 Pasos de Configuración

### 1. Configurar Variables de Entorno

El archivo `.env.local` ya está creado con tus credenciales:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=prod-anon-key
SUPABASE_SERVICE_ROLE=prod-service-role
JWT_SECRET=secreto-super-seguro-produccion
```

### 2. Crear el Esquema de Base de Datos

1. Ve a tu proyecto en Supabase
2. Abre el **SQL Editor**
3. Ejecuta el contenido del archivo `supabase-schema.sql`

**¡Importante!** Este esquema ya incluye los datos iniciales, no necesitas ejecutar ningún archivo adicional.

### 3. Verificar la Instalación

Ejecuta el proyecto:

```bash
npm run dev
```

Deberías ver:
- ✅ Mensaje "Conectando con la base de datos..." al cargar
- ✅ Console log "Supabase Storage activado - localStorage ahora usa Supabase"
- ✅ Todos los datos se guardan automáticamente en Supabase

## 🔧 Cómo Funciona

### Migración Automática
- Al cargar la aplicación, se migran automáticamente los datos existentes de localStorage a Supabase
- Los datos se mantienen en ambos lugares como backup

### Override Transparente
- `localStorage.getItem()` → Lee de Supabase (con cache)
- `localStorage.setItem()` → Guarda en Supabase + cache
- Todo el código existente funciona sin cambios

### Mapeo Inteligente a Tablas Específicas
- **Datos estructurados** van a tablas específicas (clientes, equipos, etc.)
- **Datos auxiliares** van a la tabla `app_storage`
- **Transformación automática** entre formatos localStorage ↔ Base de datos

### Cache Inteligente
- Los datos se mantienen en cache por 30 segundos
- Las operaciones son síncronas para compatibilidad
- Se actualiza automáticamente en segundo plano

## 📊 Tablas Creadas

| Tabla | Propósito | Mapea desde |
|-------|-----------|-------------|
| `zonas` | Zonas/calles del negocio | `app_zonas` |
| `tarifas` | Precios por zona | `app_tarifas` |
| `clientes` | Información de clientes | `app_clientes` |
| `equipos` | Inventario de equipos | `app_equipos` |
| `movimientos` | Movimientos de inventario | `app_movimientos` |
| `gastos` | Registro de gastos | `app_gastos` |
| `ajustes_cobros` | Ajustes para cobros | `app_cobros_ajustes` |
| `cobros_mes` | Cobros mensuales | `app_cobros_mes` |
| `cobros_cortes` | Cortes mensuales | `app_cobros_cortes` |
| `envios` | Gestión de envíos | `app_envios` |
| `envios_state` | Estado de envíos | `app_cobros_envio_state` |
| `envios_movimientos` | Movimientos de envíos | `app_cobros_envio_movs` |
| `app_storage` | Datos auxiliares | Otros keys localStorage |

## 🛠️ Comandos Útiles

### Verificar Estado del Storage
```javascript
// En la consola del navegador
console.log(await getStorageStats());
```

### Desactivar Supabase (para debugging)
```javascript
// En la consola del navegador
disableSupabaseStorage();
```

### Reactivar Supabase
```javascript
// En la consola del navegador
await enableSupabaseStorage();
```

## 🧪 Pruebas de Integración

Después de configurar todo, puedes probar que funcione correctamente:

1. **Ejecuta el proyecto:**
   ```bash
   npm run dev
   ```

2. **Abre las DevTools del navegador** (F12)

3. **Ejecuta el script de pruebas:**
   - Copia el contenido del archivo `test-supabase-integration.js`
   - Pégalo en la consola del navegador
   - Presiona Enter

4. **Verifica que todas las pruebas pasen** ✅

## 🔍 Debugging

### Ver Logs de Migración
Abre las DevTools y ve a la pestaña Console. Deberías ver:
```
🔄 Iniciando migración de localStorage a Supabase...
✅ Migrado: app_users
✅ Migrado: app_zonas
...
🎉 Migración completada: X claves migradas
✅ Supabase Storage activado - localStorage ahora usa Supabase
```

### Verificar Datos en Supabase
1. Ve a tu proyecto en Supabase
2. Abre **Table Editor**
3. Revisa la tabla `app_storage` - debe contener todas tus claves

### Si Algo Sale Mal
1. Verifica que las credenciales en `.env.local` sean correctas
2. Asegúrate de que el esquema SQL se ejecutó correctamente
3. Revisa la consola del navegador para errores
4. Si es necesario, usa `disableSupabaseStorage()` para volver a localStorage normal

## ⚡ Rendimiento

- **Primera carga**: ~2-3 segundos (migración + cache)
- **Cargas posteriores**: ~500ms (solo cache)
- **Operaciones**: Síncronas (usa cache local)
- **Sincronización**: Automática en segundo plano

## 🔒 Seguridad

- **Cliente**: Solo acceso a través de RLS policies
- **Servidor**: Acceso completo con SERVICE_ROLE
- **Cache**: Solo en memoria, se limpia automáticamente
- **Backup**: localStorage se mantiene como respaldo

## ✅ Todo Listo

Una vez completados estos pasos, MikroPanel funcionará exactamente igual que antes, pero todos los datos se guardarán en Supabase automáticamente. No necesitas cambiar nada más en el código.
