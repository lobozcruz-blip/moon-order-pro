# Acciones del agente para el equipo (MCP)

Hoy el servidor MCP sólo consulta información y permite agregar notas. La idea es que tú y tus colaboradores puedan, desde Claude/ChatGPT conectados con su propia cuenta, ejecutar las acciones diarias del taller sin abrir la app.

## Nuevas herramientas

1. **Cambiar estado del pedido** — mover un pedido (por folio) entre en espera, en preparación, enviado, finalizado, pausado o cancelado. Registra el cambio en el historial de actividad.
2. **Registrar pago** — agregar un abono con monto, fecha, método y referencia. El total pagado y el saldo se recalculan solos y devuelve el nuevo saldo.
3. **Avance de producción** — marcar un artículo del pedido como hecho o actualizar cuántas piezas van. Devuelve el avance del pedido completo.
4. **Crear o buscar cliente** — dar de alta una clienta con nombre y teléfono; si el teléfono ya existe, devuelve la ficha existente en lugar de duplicarla.
5. **Crear pedido** — crear un pedido con su clienta, tipo de entrega y artículos (con modalidad y tamaño para cortadores, con precio automático). Asigna folio y totales igual que el formulario de la app.
6. **Cambiar prioridad / fecha de entrega** — ajustar prioridad y fecha comprometida de un pedido.

Las herramientas de consulta actuales (pedidos, detalle, catálogo, clientes, notas) se conservan tal cual.

## Seguridad

- Cada persona conecta su agente con su propia cuenta del sistema (OAuth ya configurado); no hay tokens compartidos.
- Todas las escrituras pasan por las mismas reglas de la base de datos que ya usa la app: sólo personal activo (admin o colaborador) puede escribir; una clienta conectada no puede tocar nada del taller.
- Los precios de cortadores y los totales se calculan en el servidor, nunca se aceptan del agente.
- Las acciones que modifican datos se marcan como no destructivas pero no idempotentes, para que el agente pida confirmación antes de ejecutarlas.
- Ninguna acción borra pedidos, pagos ni clientes; para cancelar se usa el estado "cancelado".
- Cada acción queda registrada en el historial de actividad con el usuario que la ejecutó.

## Detalles técnicos

- Nuevos archivos en `src/lib/mcp/tools/`: `set-order-status.ts`, `add-payment.ts`, `update-item-progress.ts`, `upsert-customer.ts`, `create-order.ts`, `update-order-meta.ts`; todos registrados en `src/lib/mcp/index.ts` y usando `supabaseForUser(ctx)` (RLS como el usuario).
- Resolución de pedidos por `folio` o `order_id`, con error claro si no existe.
- La creación de pedidos usa una nueva función de base de datos `place_staff_order(payload jsonb)` (SECURITY DEFINER, exige `is_staff()`), análoga a `place_client_order` pero sin `review_status = 'pendiente'`: el pedido entra directo al tablero con folio, artículos, precios de `cutter_price_rules` y detalles de entrega.
- El registro de pagos y el avance de producción se hacen con inserts/updates normales; los triggers existentes (`trg_recalc_order`) recalculan totales y estado de pago.
- Se actualizan las `instructions` del servidor MCP y se regenera `.lovable/mcp/manifest.json`.
