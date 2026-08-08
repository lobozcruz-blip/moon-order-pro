import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listOrdersTool from "./tools/list-orders";
import getOrderTool from "./tools/get-order";
import listProductsTool from "./tools/list-products";
import searchCustomersTool from "./tools/search-customers";
import addOrderNoteTool from "./tools/add-order-note";

// El emisor OAuth debe ser el host directo de Supabase; sólo la referencia del
// proyecto sobrevive intacta al publicar.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "moon-order-manager",
  title: "Moon Order Manager",
  version: "0.1.0",
  instructions:
    "Herramientas del sistema privado de pedidos Cookies Moon. Consulta pedidos y su avance de producción con `list_orders` y `get_order`, el catálogo con `list_products`, clientes con `search_customers`, y agrega notas internas a un pedido con `add_order_note`. Cada usuario accede con su propia cuenta del sistema.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listOrdersTool, getOrderTool, listProductsTool, searchCustomersTool, addOrderNoteTool],
});
