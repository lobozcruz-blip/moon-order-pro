import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listOrdersTool from "./tools/list-orders";
import getOrderTool from "./tools/get-order";
import listProductsTool from "./tools/list-products";
import searchCustomersTool from "./tools/search-customers";
import addOrderNoteTool from "./tools/add-order-note";
import setOrderStatusTool from "./tools/set-order-status";
import addPaymentTool from "./tools/add-payment";
import updateItemProgressTool from "./tools/update-item-progress";
import upsertCustomerTool from "./tools/upsert-customer";
import createOrderTool from "./tools/create-order";
import updateOrderMetaTool from "./tools/update-order-meta";
import createProductTool from "./tools/create-product";
import bulkCreateProductsTool from "./tools/bulk-create-products";

// El emisor OAuth debe ser el host directo de Supabase; sólo la referencia del
// proyecto sobrevive intacta al publicar.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "moon-order-manager",
  title: "Moon Order Manager",
  version: "0.1.0",
  instructions:
    "Herramientas del sistema privado de pedidos Cookies Moon, para el equipo interno. Consulta con `list_orders`, `get_order`, `list_products` y `search_customers`. Catálogo: `create_product` crea un producto y `bulk_create_products` crea varios de una sola vez (úsala siempre que se pidan dos o más productos); ambas generan el SKU automáticamente (COR-, STE-, CAJ-, OTR-), asignan temáticas existentes y no piden precio para CORTADORES. Acciones de pedidos: `set_order_status` cambia el estado del pedido, `add_payment` registra abonos, `update_item_progress` actualiza el avance de producción por artículo, `upsert_customer` da de alta clientas sin duplicar teléfonos, `create_order` crea un pedido completo (los precios y totales los calcula el servidor), `update_order_meta` ajusta prioridad y fecha de entrega, y `add_order_note` agrega notas internas. Cada usuario accede con su propia cuenta y sólo puede hacer lo que sus permisos en el sistema le permiten; confirma con la persona antes de ejecutar acciones que modifican datos.",

  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listOrdersTool,
    getOrderTool,
    listProductsTool,
    searchCustomersTool,
    addOrderNoteTool,
    setOrderStatusTool,
    addPaymentTool,
    updateItemProgressTool,
    upsertCustomerTool,
    createOrderTool,
    updateOrderMetaTool,
    createProductTool,
    bulkCreateProductsTool,
  ] as unknown as Parameters<typeof defineMcp>[0]["tools"],
});
