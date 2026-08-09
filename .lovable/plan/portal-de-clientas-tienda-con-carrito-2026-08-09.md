# Portal de clientas (tienda con carrito)

Un segundo "lado" de la misma app: tus clientas entran por un link, se registran con nombre, celular y contraseña, ven el catálogo, arman un carrito, llenan sus datos de envío y finalizan. El pedido llega a tu app como **pendiente de confirmar**, con un número de carrito que ellas te mandan por WhatsApp.

## Lo que verá la clienta

1. **/tienda/acceso** — Registro (nombre, apellido, celular, contraseña) e inicio de sesión (celular + contraseña). Sin correo: el celular es su usuario.
2. **/tienda** — Catálogo de todos los productos activos, con fotos, búsqueda y filtro por categoría. Precios visibles.
   - En CORTADORES elige modalidad (sólo cortador / cortador con sello) y tamaño; el precio sale automático de tu tabla de precios.
   - Los demás productos usan su precio base. Si un producto no tiene precio, se muestra "a cotizar" y suma 0.
3. **Carrito** — Panel lateral con cantidades, quitar artículos, subtotal y total. Se guarda en su teléfono aunque cierre la página.
4. **Cuestionario de envío** — Tipo de entrega (envío o entrega personal), y según el caso: quién recibe, teléfono, calle, número, colonia, municipio, ciudad, estado, C.P., referencias e instrucciones; o lugar, fecha, hora e instrucciones. Más un campo de notas del pedido.
5. **Finalizar carrito** — Pantalla de confirmación con su **número de carrito** (folio tipo `CM-2026-0012`), botón para copiarlo y un botón directo a WhatsApp con el mensaje listo: "Por favor envía tu número de carrito a nuestro WhatsApp para confirmar tu pedido".
6. **/tienda/mis-pedidos** — Sus pedidos, su estado y su detalle.

## Lo que verás tú en la app de trabajo

- Nueva sección **Pendientes de confirmar** (badge con el conteo en Pedidos y en el Panel).
- Cada pendiente muestra clienta, contacto, artículos, total y datos de envío.
- Acciones: **Confirmar** (pasa al Kanban como "En espera") o **Rechazar**.
- Una vez confirmado es un pedido normal: puedes editarlo, agregarle artículos, pagos y notas como hoy. Si la clienta quiere algo más, tú lo actualizas desde el detalle del pedido.

## Detalles técnicos

**Base de datos (migración)**
- `customers`: nueva columna `auth_user_id uuid unique` para ligar la cuenta de la clienta con su ficha de cliente, y `phone` normalizado como identificador.
- `orders`: nuevas columnas `source text default 'interno'` (`'interno' | 'cliente'`) y `review_status text default 'aprobado'` (`'pendiente' | 'aprobado' | 'rechazado'`). El Kanban y las listas actuales filtran `review_status = 'aprobado'`, así que nada cambia para los pedidos internos.
- Función `place_client_order(payload jsonb)` con `SECURITY DEFINER`: valida al usuario, recalcula precios en el servidor desde `products` y `cutter_price_rules` (el precio nunca se confía al navegador), crea `orders` + `order_items` + `shipping_details`/`personal_delivery_details`, asigna folio y devuelve el folio.
- Políticas RLS nuevas: la clienta puede leer productos activos e imágenes, leer la tabla de precios de cortadores, leer/editar su propia ficha de cliente y direcciones, y leer sus propios pedidos. No puede insertar pedidos directamente (sólo por la función), ni ver nada de otras clientas. Personal (`is_staff`) conserva su acceso actual.
- Rol: las clientas **no** entran en `user_roles`; se identifican por tener `customers.auth_user_id`. Así no pueden pasar por `is_staff()`.

**Autenticación**
- Celular + contraseña usando un correo sintético determinista (`52XXXXXXXXXX@clientes.cookiesmoon.app`) y confirmación automática de correo activada para esas cuentas. No habrá recuperación de contraseña por correo; tú puedes restablecerla desde Configuración.
- Server function `registerClient` (crea usuario + ficha de cliente) y login normal con `signInWithPassword` sobre el correo sintético.
- Nueva capa de ruta `_cliente` que exige sesión y ficha de clienta; el layout `_authenticated` del personal rechaza a las clientas y las manda a `/tienda`.

**Archivos**
- Nuevos: `src/routes/tienda/*` (acceso, catálogo, carrito/checkout, confirmación, mis pedidos), `src/lib/shop.functions.ts`, `src/lib/cart.tsx` (estado del carrito en localStorage), `src/components/shop/*`.
- Modificados: `src/lib/queries.ts` (filtro `review_status`), `src/routes/_authenticated/pedidos.index.tsx` (pestaña Pendientes), `src/routes/_authenticated/panel.tsx` (aviso de pendientes), `src/routes/_authenticated/configuracion.tsx` (número de WhatsApp del negocio y link para compartir).

**Nota**: harán falta dos cosas tuyas: el número de WhatsApp del negocio (configurable en Configuración) y confirmar que el link a compartir sea `https://moon-order-pro.lovable.app/tienda`.
