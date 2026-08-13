import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useRef } from "react";
import {
  Plus,
  Minus,
  Trash2,
  Loader2,
  Search,
  Pencil,
  Copy,
  Package,
  Check,
  Sparkles,
  ShoppingBag,
  Download,
  Eye,
  RotateCcw,
  ImageIcon,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  AlertCircle,
  Truck,
  MapPin,
  FileText,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import {
  useCustomers,
  useProducts,
  usePriceRules,
  priceFor,
  useInvalidate,
  useProfiles,
  useProductThemes,
} from "@/lib/queries";
import { ProductPicker } from "@/components/ProductPicker";
import { StoredImage } from "@/components/StoredImage";
import {
  CustomerOrderSummaryModal,
  type SummaryOrderData,
} from "@/components/CustomerOrderSummaryModal";
import {
  CustomItemDesignSection,
  type CustomImageDraft,
} from "@/components/orders/CustomItemDesignSection";
import {
  CustomDesignViewerModal,
} from "@/components/orders/CustomDesignViewerModal";
import { buildCustomerOrderSummary, resolveOrderItemDisplayImage } from "@/lib/order-summary";
import {
  CATEGORIES,
  CATEGORY_META,
  MODALITIES,
  SIZES,
  PRIORITIES,
  CONTACT_CHANNELS,
  money,
  fullName,
  type Category,
  type Modality,
  type Priority,
  type DeliveryType,
} from "@/lib/cm";
import { logActivity, uploadFile } from "@/lib/storage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/nuevo-pedido")({
  head: () => ({
    meta: [
      { title: "Nuevo pedido — Cookies Moon" },
      { name: "description", content: "Registrar un nuevo pedido con artículos y entrega." },
      { property: "og:title", content: "Nuevo pedido — Cookies Moon" },
      {
        property: "og:description",
        content: "Registrar un nuevo pedido con artículos y entrega.",
      },
    ],
  }),
  component: NuevoPedido,
});

export type Item = {
  key: string;
  category: Category;
  product_id: string | null;
  product_name: string;
  product_sku: string | null;
  description: string;
  quantity: number;
  cutter_modality: Modality | null;
  cutter_size_cm: number | null;
  unit_price: number;
  price_overridden: boolean;
  price_override_reason: string | null;
  notes: string;
  is_custom: boolean;
  custom_images: CustomImageDraft[];
  image_preview?: any;
};

const createEmptyDraft = (
  category: Category = "CORTADORES",
  modality: Modality = "cutter_only",
  size: number = 8,
): Item => ({
  key: crypto.randomUUID(),
  category,
  product_id: null,
  product_name: "",
  product_sku: null,
  description: "",
  quantity: 1,
  cutter_modality: modality,
  cutter_size_cm: size,
  unit_price: 0,
  price_overridden: false,
  price_override_reason: null,
  notes: "",
  is_custom: false,
  custom_images: [],
});

function NuevoPedido() {
  const navigate = useNavigate();
  const { data: customers } = useCustomers();
  const { data: products = [] } = useProducts(false);
  const { data: rules } = usePriceRules();
  const { data: profiles } = useProfiles();
  const { data: themes = [] } = useProductThemes();
  const invalidate = useInvalidate();

  // 1. Cliente
  const [customerId, setCustomerId] = useState<string>("");
  const [newCustomer, setNewCustomer] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    contact_channel: "WhatsApp",
  });
  const [customerSearch, setCustomerSearch] = useState("");
  const [isCustomerEditing, setIsCustomerEditing] = useState(false);

  // 2. Pedido Meta
  const [priority, setPriority] = useState<Priority>("normal");
  const [dueDate, setDueDate] = useState("");
  const [assignee, setAssignee] = useState<string>("");
  const [discount, setDiscount] = useState("0");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // 3. Entrega
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("envio");
  const [shipping, setShipping] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    street: "",
    ext_number: "",
    int_number: "",
    neighborhood: "",
    postal_code: "",
    city: "",
    municipality: "",
    state: "",
    references_text: "",
    carrier: "",
    shipping_cost: "0",
    special_instructions: "",
  });
  const [delivery, setDelivery] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    place: "",
    delivery_date: "",
    delivery_time: "",
    instructions: "",
  });

  // 4. Estado de Artículos
  const [items, setItems] = useState<Item[]>([]);
  const [lastModality, setLastModality] = useState<Modality>("cutter_only");
  const [lastSize, setLastSize] = useState<number>(8);
  const [categoryFilter, setCategoryFilter] = useState<Category | "TODAS">("TODAS");
  const [themeFilter, setThemeFilter] = useState<string>("TODAS");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Producto seleccionado actualmente (cuando se elige uno del catálogo)
  const [selectedCatalogProduct, setSelectedCatalogProduct] = useState<any | null>(null);
  const [manualMode, setManualMode] = useState(false);

  // Draft del artículo en configuración
  const [draftItem, setDraftItem] = useState<Item>(createEmptyDraft());
  const [priceInput, setPriceInput] = useState<string>("0");

  // Modales y Visores
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingPriceInput, setEditingPriceInput] = useState<string>("0");
  const [viewerItem, setViewerItem] = useState<{
    title: string;
    productSku?: string | null;
    isCustom?: boolean;
    customNotes?: string | null;
    customImages?: any[];
    catalogImages?: any[];
  } | null>(null);

  // Resumen Móvil (Bottom Sheet)
  const [isMobileSummaryOpen, setIsMobileSummaryOpen] = useState(false);

  // Diálogo de Éxito
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [createdOrderSummary, setCreatedOrderSummary] = useState<SummaryOrderData | null>(null);

  // Diálogo de Error de Guardado con Reintento
  const [saveErrorDialog, setSaveErrorDialog] = useState<{
    open: boolean;
    message: string;
  }>({
    open: false,
    message: "",
  });

  // Filtro de Clientes
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim() || !customers) return [];
    const q = customerSearch.toLowerCase().trim();
    return customers
      .filter((c) => {
        const fn = fullName(c.first_name, c.last_name).toLowerCase();
        const ph = (c.phone ?? "").toLowerCase();
        return fn.includes(q) || ph.includes(q);
      })
      .slice(0, 8);
  }, [customers, customerSearch]);

  // Cálculo de precio unitario
  const computedPrice = (it: Item) => {
    if (it.price_overridden) return Number(it.unit_price || 0);
    if (it.category === "CORTADORES") {
      return priceFor(rules, it.cutter_modality || "cutter_only", it.cutter_size_cm || 8);
    }
    const p = products.find((x) => x.id === it.product_id);
    return Number(p?.base_price ?? it.unit_price ?? 0);
  };

  // Precios en vivo
  const currentDraftUnitPrice = computedPrice(draftItem);
  const currentDraftSubtotal = currentDraftUnitPrice * (draftItem.quantity || 1);

  // Totales generales
  const subtotal = useMemo(() => {
    return items.reduce((acc, it) => acc + computedPrice(it) * it.quantity, 0);
  }, [items, rules, products]);

  const discountNum = Math.max(0, Number(discount) || 0);
  const shippingCost =
    deliveryType === "envio" ? Math.max(0, Number(shipping.shipping_cost) || 0) : 0;
  const total = Math.max(0, subtotal - discountNum + shippingCost);

  // Selección de Producto del Catálogo
  const handleProductSelect = (p: any | null) => {
    if (!p) {
      // Modo manual / a medida
      setManualMode(true);
      setSelectedCatalogProduct(null);
      setPriceInput("0");
      setDraftItem({
        ...createEmptyDraft("CORTADORES", lastModality, lastSize),
        is_custom: true, // Por defecto un artículo manual es personalizado
      });
      return;
    }

    setManualMode(false);
    setSelectedCatalogProduct(p);

    const isCutter = p.category === "CORTADORES";
    const initialPrice = isCutter
      ? priceFor(rules, lastModality, lastSize)
      : Number(p.base_price ?? 0);

    setPriceInput(String(initialPrice));
    setDraftItem({
      key: crypto.randomUUID(),
      category: p.category,
      product_id: p.id,
      product_name: p.name,
      product_sku: p.sku,
      description: p.description ?? "",
      quantity: 1,
      cutter_modality: isCutter ? lastModality : null,
      cutter_size_cm: isCutter ? lastSize : null,
      unit_price: initialPrice,
      price_overridden: false,
      price_override_reason: null,
      notes: "",
      is_custom: false,
      custom_images: [],
      image_preview: p.product_images?.[0] ?? null,
    });
  };

  // Añadir artículo configurado al pedido
  const addDraftToOrder = () => {
    if (!draftItem.product_name.trim()) {
      toast.error("Selecciona un producto o ingresa un nombre para el artículo.");
      return;
    }
    if (draftItem.quantity <= 0) {
      toast.error("La cantidad debe ser al menos 1 pieza.");
      return;
    }

    // VALIDACIÓN ESTRICTA: Si es personalizado, requiere al menos 1 imagen
    if (draftItem.is_custom && draftItem.custom_images.length === 0) {
      toast.error(
        "Añade al menos una imagen del diseño personalizado para poder fabricar este artículo.",
      );
      return;
    }

    const itemToAdd: Item = {
      ...draftItem,
      unit_price: draftItem.price_overridden
        ? Number(priceInput || 0)
        : computedPrice(draftItem),
    };

    setItems((prev) => [...prev, itemToAdd]);

    // Recordar última configuración de cortador
    if (draftItem.category === "CORTADORES") {
      if (draftItem.cutter_modality) setLastModality(draftItem.cutter_modality);
      if (draftItem.cutter_size_cm) setLastSize(draftItem.cutter_size_cm);
    }

    // Limpiar selección para siguiente captura inmediata
    setSelectedCatalogProduct(null);
    setManualMode(false);
    setSearchQuery("");
    setDraftItem(createEmptyDraft(draftItem.category, lastModality, lastSize));
    setPriceInput("0");

    toast.success("Producto añadido al pedido", { duration: 1800 });

    // En pantallas grandes se enfoca el buscador; en móvil evitamos levantar el teclado forzado
    if (window.innerWidth >= 1024) {
      searchInputRef.current?.focus();
    }
  };

  // Duplicar artículo existente
  const duplicateItem = (it: Item) => {
    const cloned: Item = {
      ...it,
      key: crypto.randomUUID(),
      custom_images: it.custom_images.map((img) => ({
        ...img,
        id: crypto.randomUUID(),
      })),
    };
    setItems((prev) => [...prev, cloned]);
    toast.success(`"${it.product_name}" duplicado`);
  };

  // Eliminar artículo
  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  };

  // Abrir edición de un artículo existente
  const openEditModal = (it: Item) => {
    setEditingItem({
      ...it,
      custom_images: [...it.custom_images],
    });
    setEditingPriceInput(String(it.unit_price));
  };

  // Guardar cambios de edición
  const saveEditedItem = () => {
    if (!editingItem) return;
    if (editingItem.is_custom && editingItem.custom_images.length === 0) {
      toast.error(
        "Añade al menos una imagen del diseño personalizado para poder fabricar este artículo.",
      );
      return;
    }

    const updatedPrice = editingItem.price_overridden
      ? Number(editingPriceInput || 0)
      : computedPrice(editingItem);

    setItems((prev) =>
      prev.map((i) =>
        i.key === editingItem.key
          ? {
              ...editingItem,
              unit_price: updatedPrice,
            }
          : i,
      ),
    );

    setEditingItem(null);
    toast.success("Artículo actualizado");
  };

  // Guardar Pedido en Supabase
  const save = async () => {
    if (items.length === 0) {
      toast.error("Añade al menos un producto al pedido.");
      return;
    }

    let cid = customerId;
    if (!cid) {
      if (!newCustomer.first_name.trim()) {
        toast.error("Elige un cliente o escribe su nombre.");
        // Abrir sección de cliente en móvil
        setIsCustomerEditing(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }

    if (deliveryType === "entrega_personal" && !delivery.place.trim()) {
      toast.error("Indica el lugar de entrega personal.");
      setIsMobileSummaryOpen(true);
      return;
    }

    setSaving(true);
    try {
      if (!cid) {
        const { data: custData, error: custErr } = await supabase
          .from("customers")
          .insert({
            first_name: newCustomer.first_name.trim(),
            last_name: newCustomer.last_name.trim() || null,
            phone: newCustomer.phone.trim() || null,
            contact_channel: newCustomer.contact_channel,
          })
          .select("id")
          .single();
        if (custErr) throw custErr;
        cid = custData.id;
      }

      // 1. Crear Orden
      const { data: order, error: oErr } = await supabase
        .from("orders")
        .insert({
          customer_id: cid,
          priority,
          due_date: dueDate || null,
          assignee_id: assignee || null,
          delivery_type: deliveryType,
          discount: Number(discount || 0),
          shipping_cost: shippingCost,
          is_draft: false,
          status: "en_espera",
        })
        .select("id")
        .single();
      if (oErr) throw oErr;

      // 2. Insertar Artículos con is_custom
      const rows = items.map((it, idx) => ({
        order_id: order.id,
        category: it.category,
        product_id: it.product_id,
        product_name: it.product_name.trim(),
        product_sku: it.product_sku,
        description: it.description || null,
        quantity: it.quantity,
        cutter_modality: it.category === "CORTADORES" ? it.cutter_modality : null,
        cutter_size_cm: it.category === "CORTADORES" ? it.cutter_size_cm : null,
        unit_price: computedPrice(it),
        subtotal: computedPrice(it) * it.quantity,
        price_overridden: it.price_overridden,
        price_override_reason: it.price_override_reason,
        notes: it.notes || null,
        is_custom: it.is_custom,
        sort_order: idx,
      }));

      const { data: createdItems, error: iErr } = await supabase
        .from("order_items")
        .insert(rows)
        .select("id, sort_order");

      if (iErr) {
        console.error("Error inserting order_items:", iErr);
        throw iErr;
      }

      // 3. Subir imágenes físicas a Storage y crear registros en order_item_images
      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx];
        const createdItem = createdItems?.[idx];
        if (!it || !createdItem || it.custom_images.length === 0) continue;

        for (let imgIdx = 0; imgIdx < it.custom_images.length; imgIdx++) {
          const customImg = it.custom_images[imgIdx];
          if (!customImg) continue;
          let storagePath = customImg.storage_path;

          if (customImg.file) {
            try {
              const ext = customImg.file.name.split(".").pop() ?? "webp";
              const keyHint = `items/${createdItem.id}`;
              storagePath = await uploadFile("pedidos", customImg.file, `${order.id}/${keyHint}`);
            } catch (err: any) {
              console.error("Error uploading custom image:", err);
              toast.error(
                `No se pudo guardar la imagen de referencia de "${it.product_name}".`,
              );
              throw err;
            }
          }

          if (storagePath) {
            const { error: imgErr } = await supabase.from("order_item_images").insert({
              order_item_id: createdItem.id,
              storage_path: storagePath,
              is_primary: customImg.is_primary ?? false,
              image_type: "custom_reference",
              sort_order: imgIdx,
            });
            if (imgErr) console.error("Error inserting order_item_images:", imgErr);
          }
        }
      }

      // 4. Detalles de Entrega
      if (deliveryType === "envio") {
        await supabase.from("shipping_details").insert({
          order_id: order.id,
          first_name: shipping.first_name || null,
          last_name: shipping.last_name || null,
          phone: shipping.phone || null,
          street: shipping.street || null,
          ext_number: shipping.ext_number || null,
          int_number: shipping.int_number || null,
          neighborhood: shipping.neighborhood || null,
          postal_code: shipping.postal_code || null,
          city: shipping.city || null,
          municipality: shipping.municipality || null,
          state: shipping.state || null,
          references_text: shipping.references_text || null,
          carrier: shipping.carrier || null,
          shipping_cost: shippingCost,
          special_instructions: shipping.special_instructions || null,
        });
      } else {
        await supabase.from("personal_delivery_details").insert({
          order_id: order.id,
          first_name: delivery.first_name || null,
          last_name: delivery.last_name || null,
          phone: delivery.phone || null,
          place: delivery.place || null,
          delivery_date: delivery.delivery_date || null,
          delivery_time: delivery.delivery_time || null,
          instructions: delivery.instructions || null,
        });
      }

      // 5. Notas generales del pedido
      if (note.trim()) {
        const { data: u } = await supabase.auth.getUser();
        await supabase.from("order_notes").insert({
          order_id: order.id,
          body: note.trim(),
          created_by: u.user?.id ?? null,
        });
      }

      await supabase.rpc("assign_folio", { _order_id: order.id });
      await logActivity({ action: "Pedido creado", entity: "order", order_id: order.id });

      // Obtener el pedido completo recién persistido desde Supabase incluyendo order_item_images y productos
      const { data: freshOrder } = await supabase
        .from("orders")
        .select(`
          *,
          customers(*),
          order_items(
            *,
            order_item_images(*),
            products(
              id,
              sku,
              name,
              category,
              product_images(*)
            )
          ),
          shipping_details(*),
          personal_delivery_details(*)
        `)
        .eq("id", order.id)
        .single();

      const summaryData = buildCustomerOrderSummary(freshOrder ?? {
        ...order,
        customers: customerId && customers ? customers.find((c) => c.id === customerId) : newCustomer,
        items,
        shipping_details: shipping,
        personal_delivery_details: delivery,
      });

      setCreatedOrderId(order.id);
      setCreatedOrderSummary(summaryData);
      setShowSuccessDialog(true);
      invalidate("orders", "production-queue", "dashboard-sales-summary", "sales-analytics");
    } catch (e: any) {
      console.error("Error saving order:", e);
      const isSchemaCacheError =
        e?.message?.includes("is_custom") ||
        e?.message?.includes("schema cache") ||
        e?.code === "PGRST204" ||
        e?.code === "42703";

      setSaveErrorDialog({
        open: true,
        message: isSchemaCacheError
          ? "No pudimos guardar el pedido porque la base de datos todavía está actualizando su estructura en Supabase. Tus datos y fotos siguen intactos aquí. Presiona Reintentar."
          : (e?.message ?? "Error inesperado al guardar el pedido. Tus datos siguen guardados en pantalla."),
      });
    } finally {
      setSaving(false);
    }
  };

  // Datos del cliente seleccionado
  const selectedCustomerObj = customers?.find((c) => c.id === customerId);
  const isCustomerReady =
    Boolean(customerId) || Boolean(newCustomer.first_name.trim());

  return (
    <>
      <PageHeader
        title="Nuevo pedido"
        subtitle="Captura rápida de productos y personalizaciones para el taller"
      />

      {/* CONTENEDOR PRINCIPAL: Padding inferior extra para la barra móvil sticky */}
      <div className="pb-36 lg:pb-12">
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* ========================================== */}
          {/* COLUMNA PRINCIPAL DE CAPTURA */}
          {/* ========================================== */}
          <div className="space-y-6">
            {/* 1. SECCIÓN CLIENTE (COLAPSABLE EN MÓVIL Y DESKTOP) */}
            <section className="panel p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  <span>1. Cliente</span>
                </h2>
                {isCustomerReady && !isCustomerEditing && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="tap text-sm text-primary font-semibold hover:bg-primary/10"
                    onClick={() => setIsCustomerEditing(true)}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar cliente
                  </Button>
                )}
              </div>

              {/* Vista compacta cuando el cliente ya está asignado */}
              {isCustomerReady && !isCustomerEditing ? (
                <div className="flex items-center justify-between rounded-2xl bg-primary/10 border border-primary/20 p-4 transition-all">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">
                      Cliente del pedido:
                    </p>
                    <p className="text-base font-bold text-foreground mt-0.5 truncate">
                      {selectedCustomerObj
                        ? fullName(selectedCustomerObj.first_name, selectedCustomerObj.last_name)
                        : fullName(newCustomer.first_name, newCustomer.last_name)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {selectedCustomerObj?.phone || newCustomer.phone || "Sin teléfono registrado"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="tap h-9 text-sm font-semibold rounded-xl shrink-0"
                    onClick={() => {
                      setCustomerId("");
                      setIsCustomerEditing(true);
                    }}
                  >
                    Cambiar
                  </Button>
                </div>
              ) : (
                /* Formulario completo de búsqueda o registro de cliente */
                <div className="space-y-3.5">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="tap h-12 rounded-xl pl-11 text-base font-medium placeholder:text-muted-foreground/70 bg-card border-border"
                      placeholder="Buscar cliente existente por nombre o teléfono..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                    />
                  </div>

                  {customerSearch && (
                    <div className="max-h-52 overflow-y-auto divide-y divide-border rounded-2xl border border-border bg-background shadow-md">
                      {filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setCustomerId(c.id);
                            setCustomerSearch("");
                            setIsCustomerEditing(false);
                          }}
                          className="tap flex w-full items-center justify-between p-3.5 text-left text-sm hover:bg-secondary transition-all"
                        >
                          <span className="font-bold text-foreground">
                            {fullName(c.first_name, c.last_name)}
                          </span>
                          <span className="text-muted-foreground font-mono text-xs">
                            {c.phone || "Sin teléfono"}
                          </span>
                        </button>
                      ))}
                      {filteredCustomers.length === 0 && (
                        <p className="p-4 text-center text-sm text-muted-foreground">
                          No se encontró ningún cliente registrado. Puedes completar los datos abajo:
                        </p>
                      )}
                    </div>
                  )}

                  {/* Campos de Nuevo Cliente */}
                  <div className="rounded-2xl border border-border bg-secondary/20 p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      O registrar nuevo cliente:
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold">Nombre *</Label>
                        <Input
                          className="tap h-11 text-base rounded-xl bg-card border-border"
                          placeholder="Nombre"
                          value={newCustomer.first_name}
                          onChange={(e) =>
                            setNewCustomer({ ...newCustomer, first_name: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold">Apellido</Label>
                        <Input
                          className="tap h-11 text-base rounded-xl bg-card border-border"
                          placeholder="Apellido (opcional)"
                          value={newCustomer.last_name}
                          onChange={(e) =>
                            setNewCustomer({ ...newCustomer, last_name: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold">Teléfono / WhatsApp</Label>
                        <Input
                          className="tap h-11 text-base rounded-xl bg-card border-border"
                          placeholder="Teléfono"
                          value={newCustomer.phone}
                          onChange={(e) =>
                            setNewCustomer({ ...newCustomer, phone: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    {isCustomerReady && isCustomerEditing && (
                      <div className="flex justify-end pt-1">
                        <Button
                          type="button"
                          size="sm"
                          className="tap h-9 text-sm font-bold bg-primary text-primary-foreground rounded-xl"
                          onClick={() => setIsCustomerEditing(false)}
                        >
                          <Check className="mr-1.5 h-4 w-4" /> Listo, continuar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* 2. SECCIÓN CATÁLOGO & CAPTURA DE ARTÍCULO */}
            <section className="panel p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div>
                  <h2 className="font-display text-lg font-bold flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    <span>2. Añadir Productos al Pedido</span>
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Busca en catálogo o crea un diseño personalizado con sus imágenes de fabricación.
                  </p>
                </div>

                {!selectedCatalogProduct && (
                  <Button
                    type="button"
                    variant={manualMode ? "secondary" : "outline"}
                    size="sm"
                    className="tap text-sm font-bold rounded-xl"
                    onClick={() => handleProductSelect(null)}
                  >
                    <Sparkles className="mr-1.5 h-4 w-4 text-amber-400" />
                    Artículo a medida
                  </Button>
                )}
              </div>

              {/* Si NO hay producto seleccionado, mostramos el Buscador y Catálogo */}
              {!selectedCatalogProduct && !manualMode && (
                <ProductPicker
                  products={products}
                  themes={themes}
                  selectedProductId={draftItem.product_id}
                  onSelect={handleProductSelect}
                  categoryFilter={categoryFilter}
                  onCategoryFilterChange={setCategoryFilter}
                  themeFilter={themeFilter}
                  onThemeFilterChange={setThemeFilter}
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                  searchInputRef={searchInputRef}
                />
              )}

              {/* Si YA se seleccionó un producto o modo manual, ocultamos el catálogo y mostramos la configuración limpia */}
              {(selectedCatalogProduct || manualMode) && (
                <div className="space-y-4 animate-in fade-in-50 duration-200">
                  {/* Tarjeta de Producto Seleccionado */}
                  <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-primary bg-primary/10 p-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-card">
                        {draftItem.image_preview ? (
                          <StoredImage
                            image={draftItem.image_preview}
                            alt={draftItem.product_name}
                            className="h-full w-full object-contain p-1"
                          />
                        ) : (
                          <Sparkles className="h-7 w-7 text-amber-400" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {draftItem.product_sku && (
                            <span className="font-mono text-xs font-bold text-primary">
                              {draftItem.product_sku}
                            </span>
                          )}
                          <span className="chip text-xs py-0.5 px-2 font-bold bg-primary/20 text-primary">
                            {CATEGORY_META[draftItem.category]?.label ?? draftItem.category}
                          </span>
                        </div>
                        <p className="truncate text-base font-bold text-foreground mt-0.5">
                          {draftItem.product_name || "Artículo personalizado a medida"}
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="tap h-9 text-sm font-semibold rounded-xl shrink-0"
                      onClick={() => {
                        setSelectedCatalogProduct(null);
                        setManualMode(false);
                      }}
                    >
                      Cambiar producto
                    </Button>
                  </div>

                  {/* Configurador del Artículo */}
                  <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
                    {manualMode && (
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold">Nombre del producto *</Label>
                        <Input
                          className="tap h-12 text-base rounded-xl"
                          placeholder="Ej. Cortador Letra 'M' con florecitas..."
                          value={draftItem.product_name}
                          onChange={(e) =>
                            setDraftItem({ ...draftItem, product_name: e.target.value })
                          }
                        />
                      </div>
                    )}

                    {/* Modalidad y Tamaño para Cortadores */}
                    {draftItem.category === "CORTADORES" && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-sm font-semibold text-foreground">Modalidad</Label>
                          <Select
                            value={draftItem.cutter_modality ?? "cutter_only"}
                            onValueChange={(v: Modality) => {
                              setDraftItem({ ...draftItem, cutter_modality: v });
                              setLastModality(v);
                            }}
                          >
                            <SelectTrigger className="tap h-12 text-base rounded-xl bg-card border-border">
                              <SelectValue placeholder="Modalidad" />
                            </SelectTrigger>
                            <SelectContent>
                              {MODALITIES.map((m) => (
                                <SelectItem key={m.value} value={m.value} className="text-base py-2.5">
                                  {m.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-sm font-semibold text-foreground">Tamaño</Label>
                          <Select
                            value={String(draftItem.cutter_size_cm ?? 8)}
                            onValueChange={(v) => {
                              const s = Number(v);
                              setDraftItem({ ...draftItem, cutter_size_cm: s });
                              setLastSize(s);
                            }}
                          >
                            <SelectTrigger className="tap h-12 text-base rounded-xl bg-card border-border">
                              <SelectValue placeholder="Tamaño" />
                            </SelectTrigger>
                            <SelectContent>
                              {SIZES.map((s) => (
                                <SelectItem key={s} value={String(s)} className="text-base py-2.5">
                                  {s} cm
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* Cantidad y Precios */}
                    <div className="grid gap-3 sm:grid-cols-2 items-center pt-1">
                      <div className="space-y-1.5">
                        <Label className="text-sm font-semibold text-foreground">Cantidad</Label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="tap h-12 w-12 rounded-xl shrink-0 font-bold"
                            disabled={draftItem.quantity <= 1}
                            onClick={() =>
                              setDraftItem({
                                ...draftItem,
                                quantity: Math.max(1, draftItem.quantity - 1),
                              })
                            }
                          >
                            <Minus className="h-5 w-5" />
                          </Button>
                          <Input
                            type="number"
                            inputMode="numeric"
                            className="tap h-12 text-center text-lg font-bold rounded-xl"
                            value={draftItem.quantity}
                            onChange={(e) =>
                              setDraftItem({
                                ...draftItem,
                                quantity: Math.max(1, parseInt(e.target.value) || 1),
                              })
                            }
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="tap h-12 w-12 rounded-xl shrink-0 font-bold"
                            onClick={() =>
                              setDraftItem({
                                ...draftItem,
                                quantity: draftItem.quantity + 1,
                              })
                            }
                          >
                            <Plus className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>

                      {/* Resumen de Precios */}
                      <div className="rounded-2xl border border-border bg-secondary/30 p-3.5 text-right space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Precio unitario:</span>
                          <span className="font-semibold text-foreground">
                            {money(currentDraftUnitPrice)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-base font-bold">
                          <span className="text-foreground">Subtotal ({draftItem.quantity} pzas):</span>
                          <span className="text-primary font-display text-xl">
                            {money(currentDraftSubtotal)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* SECCIÓN DISEÑO PERSONALIZADO (Carga de Imágenes) */}
                    <CustomItemDesignSection
                      isCustom={draftItem.is_custom}
                      onIsCustomChange={(val) => setDraftItem({ ...draftItem, is_custom: val })}
                      images={draftItem.custom_images}
                      onImagesChange={(imgs) => setDraftItem({ ...draftItem, custom_images: imgs })}
                      customNotes={draftItem.notes}
                      onCustomNotesChange={(notes) => setDraftItem({ ...draftItem, notes })}
                      showToggle={true}
                    />

                    {/* BOTÓN GIGANTE A TODO EL ANCHO: + AÑADIR AL PEDIDO */}
                    <Button
                      type="button"
                      size="lg"
                      className="tap w-full h-14 rounded-2xl bg-primary text-primary-foreground font-display text-lg font-bold shadow-lg hover:bg-primary/90 transition-all mt-2"
                      onClick={addDraftToOrder}
                    >
                      <Plus className="mr-2 h-6 w-6 stroke-[3]" /> + AÑADIR AL PEDIDO
                    </Button>
                  </div>
                </div>
              )}
            </section>

            {/* 3. SECCIÓN ENTREGA & PAGO (COLAPSABLE EN ESCRITORIO / DESPLEGABLE) */}
            <section className="panel p-4 sm:p-5 space-y-4">
              <h2 className="font-display text-lg font-bold flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                <span>3. Entrega & Observaciones</span>
              </h2>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={deliveryType === "envio" ? "default" : "outline"}
                  className={cn(
                    "tap flex-1 h-12 text-base font-semibold rounded-xl",
                    deliveryType === "envio" && "bg-primary text-primary-foreground font-bold",
                  )}
                  onClick={() => setDeliveryType("envio")}
                >
                  <Truck className="mr-2 h-5 w-5" /> Envío a domicilio
                </Button>
                <Button
                  type="button"
                  variant={deliveryType === "entrega_personal" ? "default" : "outline"}
                  className={cn(
                    "tap flex-1 h-12 text-base font-semibold rounded-xl",
                    deliveryType === "entrega_personal" && "bg-primary text-primary-foreground font-bold",
                  )}
                  onClick={() => setDeliveryType("entrega_personal")}
                >
                  <MapPin className="mr-2 h-5 w-5" /> Entrega personal
                </Button>
              </div>

              {deliveryType === "envio" ? (
                <div className="grid gap-3 sm:grid-cols-2 pt-2">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-sm font-semibold">Calle y número</Label>
                    <Input
                      className="tap h-11 text-base rounded-xl"
                      placeholder="Calle, número exterior e interior"
                      value={shipping.street}
                      onChange={(e) => setShipping({ ...shipping, street: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">Colonia / Fraccionamiento</Label>
                    <Input
                      className="tap h-11 text-base rounded-xl"
                      placeholder="Colonia"
                      value={shipping.neighborhood}
                      onChange={(e) => setShipping({ ...shipping, neighborhood: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">Ciudad / Municipio</Label>
                    <Input
                      className="tap h-11 text-base rounded-xl"
                      placeholder="Ciudad"
                      value={shipping.city}
                      onChange={(e) => setShipping({ ...shipping, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">Costo de envío ($)</Label>
                    <Input
                      className="tap h-11 text-base rounded-xl"
                      type="number"
                      placeholder="0.00"
                      value={shipping.shipping_cost}
                      onChange={(e) => setShipping({ ...shipping, shipping_cost: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">Paquetería</Label>
                    <Input
                      className="tap h-11 text-base rounded-xl"
                      placeholder="Ej. Estafeta, FedEx, Motoenvío"
                      value={shipping.carrier}
                      onChange={(e) => setShipping({ ...shipping, carrier: e.target.value })}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 pt-2">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-sm font-semibold">Lugar o punto de entrega *</Label>
                    <Input
                      className="tap h-11 text-base rounded-xl"
                      placeholder="Ej. Taller Cookies Moon, Parque Central..."
                      value={delivery.place}
                      onChange={(e) => setDelivery({ ...delivery, place: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">Fecha de entrega</Label>
                    <Input
                      className="tap h-11 text-base rounded-xl"
                      type="date"
                      value={delivery.delivery_date}
                      onChange={(e) => setDelivery({ ...delivery, delivery_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">Hora aproximada</Label>
                    <Input
                      className="tap h-11 text-base rounded-xl"
                      placeholder="Ej. 4:30 PM"
                      value={delivery.delivery_time}
                      onChange={(e) => setDelivery({ ...delivery, delivery_time: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Notas generales */}
              <div className="space-y-1 pt-2">
                <Label className="text-sm font-semibold">Notas u observaciones del pedido</Label>
                <Textarea
                  className="tap min-h-[72px] text-base rounded-xl"
                  placeholder="Observaciones generales para el pedido..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </section>
          </div>

          {/* ========================================== */}
          {/* COLUMNA LATERAL (RESUMEN EN DESKTOP) */}
          {/* ========================================== */}
          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <section className="panel p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="font-display text-lg font-bold flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-primary" />
                  <span>Productos añadidos ({items.length})</span>
                </h2>
              </div>

              {/* Lista de productos agregados */}
              {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  <ShoppingBag className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                  <p className="font-semibold text-foreground">Aún no hay productos añadidos</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Selecciona un producto arriba y pulsa "+ Añadir al pedido".
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {items.map((it) => {
                    const primaryCustom = it.custom_images.find((i) => i.is_primary) ?? it.custom_images[0];
                    const thumbUrl = primaryCustom?.previewUrl;

                    return (
                      <div
                        key={it.key}
                        className={cn(
                          "rounded-2xl border p-3 bg-card shadow-sm transition-all space-y-2",
                          it.is_custom && "border-amber-500/40 bg-amber-500/5",
                        )}
                      >
                        <div className="flex gap-3">
                          {/* Miniatura prioritaria */}
                          <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary">
                            {thumbUrl ? (
                              <img
                                src={thumbUrl}
                                alt={it.product_name}
                                className="h-full w-full object-contain p-1"
                              />
                            ) : it.image_preview ? (
                              <StoredImage
                                image={it.image_preview}
                                alt={it.product_name}
                                className="h-full w-full object-contain p-1"
                              />
                            ) : (
                              <Package className="h-6 w-6 text-muted-foreground opacity-40" />
                            )}
                            {it.custom_images.length > 0 && (
                              <span className="absolute bottom-1 right-1 rounded bg-black/85 px-1 text-[9px] font-bold text-white shadow-sm">
                                📷 {it.custom_images.length}
                              </span>
                            )}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              {it.product_sku && (
                                <span className="font-mono text-xs font-bold text-primary">
                                  {it.product_sku}
                                </span>
                              )}
                              {it.is_custom && (
                                <span className="chip text-[10px] py-0 px-1.5 bg-amber-500/20 text-amber-400 font-bold flex items-center gap-1">
                                  <Sparkles className="h-3 w-3" /> PERSONALIZADO
                                </span>
                              )}
                            </div>
                            <p className="truncate font-bold text-base text-foreground mt-0.5">
                              {it.product_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {it.category === "CORTADORES" && it.cutter_size_cm
                                ? `${it.cutter_size_cm} cm · ${
                                    MODALITIES.find((m) => m.value === it.cutter_modality)?.label ?? ""
                                  } · `
                                : ""}
                              <span className="font-bold text-foreground">{it.quantity}</span> × {money(computedPrice(it))} ={" "}
                              <span className="font-bold text-primary">{money(computedPrice(it) * it.quantity)}</span>
                            </p>
                            {it.notes && (
                              <p className="text-xs text-amber-400/90 italic truncate mt-0.5">
                                📝 {it.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Botones de acción táctiles en la tarjeta */}
                        <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs">
                          {/* Botón Ver diseño si tiene imágenes */}
                          {(it.custom_images.length > 0 || it.image_preview) && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="tap h-8 px-2.5 text-xs font-bold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30"
                              onClick={() =>
                                setViewerItem({
                                  title: it.product_name,
                                  productSku: it.product_sku,
                                  isCustom: it.is_custom,
                                  customNotes: it.notes,
                                  customImages: it.custom_images.map((img) => ({
                                    id: img.id,
                                    previewUrl: img.previewUrl,
                                    storage_path: img.storage_path,
                                    is_primary: img.is_primary,
                                  })),
                                  catalogImages: it.image_preview ? [it.image_preview] : [],
                                })
                              }
                            >
                              <Eye className="mr-1.5 h-3.5 w-3.5" /> Ver diseño
                              {it.custom_images.length > 0 && (
                                <span className="ml-1 text-[10px]">({it.custom_images.length})</span>
                              )}
                            </Button>
                          )}

                          <div className="flex items-center gap-1 ml-auto">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="tap h-8 text-xs font-semibold"
                              onClick={() => openEditModal(it)}
                            >
                              <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="tap h-8 w-8 text-muted-foreground"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={() => duplicateItem(it)} className="text-sm">
                                  <Copy className="mr-2 h-4 w-4" /> Duplicar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => removeItem(it.key)}
                                  className="text-sm text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Totales y Desglose */}
              <div className="space-y-2 border-t border-border pt-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal artículos:</span>
                  <span className="font-semibold text-foreground">{money(subtotal)}</span>
                </div>
                {discountNum > 0 && (
                  <div className="flex justify-between text-emerald-500">
                    <span>Descuento:</span>
                    <span className="font-semibold">-{money(discountNum)}</span>
                  </div>
                )}
                {shippingCost > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Envío:</span>
                    <span className="font-semibold text-foreground">{money(shippingCost)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                  <span className="text-foreground">Total del pedido:</span>
                  <span className="text-primary font-display text-2xl">{money(total)}</span>
                </div>
              </div>

              {/* Botón de Guardar en Desktop */}
              <Button
                type="button"
                size="lg"
                className="tap w-full h-14 text-base font-bold bg-primary text-primary-foreground rounded-2xl shadow-lg hover:bg-primary/90 hidden lg:flex"
                disabled={saving || items.length === 0}
                onClick={save}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Guardando pedido...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-5 w-5 stroke-[3]" /> Guardar pedido ({items.length} pzas)
                  </>
                )}
              </Button>
            </section>
          </aside>
        </div>
      </div>

      {/* ========================================== */}
      {/* BARRA INFERIOR FLOTANTE STICKY (MÓVIL & TABLET) */}
      {/* ========================================== */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border p-3 px-4 shadow-2xl pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">
            {items.length} producto{items.length === 1 ? "" : "s"}
          </p>
          <p className="font-display text-xl font-bold text-primary leading-tight">
            {money(total)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="tap h-12 px-3.5 text-sm font-semibold rounded-xl border-border bg-secondary/50"
            onClick={() => setIsMobileSummaryOpen(true)}
          >
            <ShoppingBag className="mr-1.5 h-4 w-4 text-primary" /> Resumen
          </Button>

          <Button
            type="button"
            size="lg"
            className="tap h-12 px-5 text-sm font-bold bg-primary text-primary-foreground rounded-xl shadow-md hover:bg-primary/90"
            disabled={saving || items.length === 0}
            onClick={save}
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>Guardar</>
            )}
          </Button>
        </div>
      </div>

      {/* ========================================== */}
      {/* BOTTOM SHEET DE RESUMEN EN MÓVIL */}
      {/* ========================================== */}
      <Sheet open={isMobileSummaryOpen} onOpenChange={setIsMobileSummaryOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl p-5 space-y-4">
          <SheetHeader className="text-left border-b border-border pb-3">
            <SheetTitle className="font-display text-xl font-bold flex items-center justify-between">
              <span>Resumen del Pedido</span>
              <span className="text-primary">{money(total)}</span>
            </SheetTitle>
          </SheetHeader>

          {/* Desglose de Totales */}
          <div className="space-y-2 rounded-2xl bg-secondary/30 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal ({items.length} productos):</span>
              <span className="font-semibold text-foreground">{money(subtotal)}</span>
            </div>
            {discountNum > 0 && (
              <div className="flex justify-between text-emerald-500">
                <span>Descuento:</span>
                <span className="font-semibold">-{money(discountNum)}</span>
              </div>
            )}
            {shippingCost > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Envío:</span>
                <span className="font-semibold text-foreground">{money(shippingCost)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
              <span>Total final:</span>
              <span className="text-primary font-display text-2xl">{money(total)}</span>
            </div>
          </div>

          {/* Lista rápida de artículos en el resumen móvil */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Artículos añadidos:
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {items.map((it) => (
                <div
                  key={it.key}
                  className="flex items-center justify-between p-3 rounded-xl border border-border bg-card text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-foreground truncate">{it.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {it.quantity} pzas × {money(computedPrice(it))}
                    </p>
                  </div>
                  <span className="font-bold text-primary ml-2">
                    {money(computedPrice(it) * it.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <SheetFooter className="pt-2">
            <Button
              type="button"
              size="lg"
              className="tap w-full h-14 text-base font-bold bg-primary text-primary-foreground rounded-2xl shadow-lg"
              disabled={saving || items.length === 0}
              onClick={() => {
                setIsMobileSummaryOpen(false);
                save();
              }}
            >
              {saving ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Check className="mr-2 h-5 w-5 stroke-[3]" />
              )}
              Confirmar y Guardar Pedido ({money(total)})
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ========================================== */}
      {/* MODAL DE EDICIÓN DE ARTÍCULO YA AÑADIDO */}
      {/* ========================================== */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-bold">
              Editar artículo: {editingItem?.product_name}
            </DialogTitle>
          </DialogHeader>

          {editingItem && (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label className="text-sm font-semibold">Nombre del producto</Label>
                <Input
                  className="tap h-11 text-base rounded-xl"
                  value={editingItem.product_name}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, product_name: e.target.value })
                  }
                />
              </div>

              {editingItem.category === "CORTADORES" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">Modalidad</Label>
                    <Select
                      value={editingItem.cutter_modality ?? "cutter_only"}
                      onValueChange={(v: Modality) =>
                        setEditingItem({ ...editingItem, cutter_modality: v })
                      }
                    >
                      <SelectTrigger className="tap h-11 text-base rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MODALITIES.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">Tamaño</Label>
                    <Select
                      value={String(editingItem.cutter_size_cm ?? 8)}
                      onValueChange={(v) =>
                        setEditingItem({ ...editingItem, cutter_size_cm: Number(v) })
                      }
                    >
                      <SelectTrigger className="tap h-11 text-base rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SIZES.map((s) => (
                          <SelectItem key={s} value={String(s)}>
                            {s} cm
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-sm font-semibold">Cantidad</Label>
                  <Input
                    className="tap h-11 text-base rounded-xl"
                    type="number"
                    value={editingItem.quantity}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        quantity: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-semibold">Precio unitario ($)</Label>
                  <Input
                    className="tap h-11 text-base rounded-xl"
                    type="number"
                    value={editingPriceInput}
                    onChange={(e) => {
                      setEditingPriceInput(e.target.value);
                      setEditingItem({
                        ...editingItem,
                        price_overridden: true,
                        price_override_reason: "Precio modificado manualmente",
                      });
                    }}
                  />
                </div>
              </div>

              {/* Imágenes y Notas en Edición */}
              <CustomItemDesignSection
                isCustom={editingItem.is_custom}
                onIsCustomChange={(val) => setEditingItem({ ...editingItem, is_custom: val })}
                images={editingItem.custom_images}
                onImagesChange={(imgs) => setEditingItem({ ...editingItem, custom_images: imgs })}
                customNotes={editingItem.notes}
                onCustomNotesChange={(notes) => setEditingItem({ ...editingItem, notes })}
                showToggle={true}
              />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="tap h-11 text-sm font-semibold rounded-xl"
              onClick={() => setEditingItem(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="tap h-11 text-sm font-bold bg-primary text-primary-foreground rounded-xl"
              onClick={saveEditedItem}
            >
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================== */}
      {/* VISOR DE DISEÑO EN 1 TOQUE */}
      {/* ========================================== */}
      <CustomDesignViewerModal
        open={!!viewerItem}
        onOpenChange={(open) => !open && setViewerItem(null)}
        title={viewerItem?.title ?? "Artículo"}
        productSku={viewerItem?.productSku}
        isCustom={viewerItem?.isCustom}
        customNotes={viewerItem?.customNotes}
        customImages={viewerItem?.customImages ?? []}
        catalogImages={viewerItem?.catalogImages ?? []}
      />

      {/* ========================================== */}
      {/* DIÁLOGO DE ERROR DE GUARDADO CON REINTENTO */}
      {/* ========================================== */}
      <Dialog
        open={saveErrorDialog.open}
        onOpenChange={(open) => !open && setSaveErrorDialog({ ...saveErrorDialog, open: false })}
      >
        <DialogContent className="max-w-md rounded-3xl p-6 border-destructive/30">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-bold text-destructive flex items-center gap-2">
              <AlertCircle className="h-6 w-6" /> No se pudo guardar el pedido
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-foreground leading-relaxed py-2">
            {saveErrorDialog.message}
          </p>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              className="tap h-11 text-sm font-semibold rounded-xl"
              onClick={() => setSaveErrorDialog({ ...saveErrorDialog, open: false })}
            >
              Revisar datos
            </Button>
            <Button
              type="button"
              className="tap h-11 text-sm font-bold bg-primary text-primary-foreground rounded-xl"
              onClick={() => {
                setSaveErrorDialog({ ...saveErrorDialog, open: false });
                save();
              }}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" /> Reintentar guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================== */}
      {/* MODAL DE ÉXITO Y RESUMEN DEL PEDIDO */}
      {/* ========================================== */}
      {createdOrderSummary && (
        <CustomerOrderSummaryModal
          open={showSuccessDialog}
          onOpenChange={(open) => {
            setShowSuccessDialog(open);
            if (!open && createdOrderId) {
              navigate({ to: "/pedidos/$orderId", params: { orderId: createdOrderId } });
            }
          }}
          order={createdOrderSummary}
        />
      )}
    </>
  );
}
