# Corrección de fallas y mejoras de velocidad

## Falla encontrada (confirmada)

La función de base de datos `ensure_profile` está fallando en cada carga de la app. Devuelve error 400 con el mensaje `column reference "id" is ambiguous`. Causa: la función declara una salida llamada `id` que choca con la columna `id` de la tabla `profiles` dentro del `INSERT ... ON CONFLICT (id)`.

Consecuencia real: **nunca se obtiene el rol del usuario**, así que la app asume "colaborador" para todos. El administrador pierde acceso a funciones de admin (precios, usuarios, purgar datos) aunque en la base de datos sí sea admin.

## Qué se va a corregir

1. **Reescribir `ensure_profile`** con nombres de salida sin ambigüedad (`out_id`, `out_role`) y calificando las columnas. Con esto el rol de administrador se carga correctamente.
2. **Fallback de rol seguro**: si la llamada falla, leer el rol directamente de la tabla de roles en vez de asumir "colaborador" en silencio, y mostrar el error en consola.

## Mejoras de velocidad

3. **Menos llamadas de red al navegar**: la protección de rutas hace una petición al servidor de autenticación (`getUser`) en cada cambio de pantalla. Se cambia por lectura de sesión local con verificación en segundo plano — la navegación entre pantallas pasa a ser instantánea.
4. **Caché de datos**: hoy cada consulta se vuelve a pedir al entrar a cada pantalla. Se configuran tiempos de frescura por tipo de dato (catálogo/clientes/precios más largos, pedidos más cortos) y se desactiva el refetch automático al enfocar la ventana.
5. **Consultas más ligeras**: pedir solo las columnas necesarias en listados de productos, clientes y pedidos en lugar de traer todo, incluidas relaciones que no se muestran en la lista.
6. **Precarga al pasar el cursor/tocar** los enlaces de navegación, para que la pantalla siguiente ya esté lista al hacer clic.
7. **Caché de URLs firmadas de imágenes** compartida y con reintento, evitando pedir la misma URL varias veces por pantalla (hoy cada tarjeta de producto pide la suya).
8. **Índices de base de datos** en las columnas usadas para filtrar y ordenar pedidos (`orders.is_draft`, `orders.created_at`, `order_items.order_id`, `payments.order_id`, `activity_log.created_at`), para que las listas respondan rápido conforme crezcan los datos.

## Detalles técnicos

- Migración SQL: `CREATE OR REPLACE FUNCTION public.ensure_profile` con parámetros de salida renombrados y referencias calificadas (`public.profiles.id`); más `CREATE INDEX IF NOT EXISTS` para los índices listados.
- `src/lib/auth.tsx`: manejo de `error` del RPC y consulta de respaldo a `user_roles`.
- `src/routes/_authenticated/route.tsx`: `getSession()` en `beforeLoad` en lugar de `getUser()`.
- `src/router.tsx`: `defaultOptions.queries` con `staleTime`, `gcTime`, `refetchOnWindowFocus: false`, `retry: 1`; `defaultPreload: "intent"` en el router.
- `src/lib/queries.ts`: `select` explícitos y `staleTime` por hook.
- `src/lib/storage.ts`: deduplicación de promesas en `signedUrl` (mapa de promesas en vuelo).

No se cambia el diseño ni el flujo de trabajo de la app.
