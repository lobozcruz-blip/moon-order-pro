import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useRef, useEffect } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Search,
  Pencil,
  Copy,
  Undo2,
  Package,
  Check,
  AlertCircle,
  Tag,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  CornerDownLeft,
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
  CATEGORIES,
  CATEGORY_META,
  MODALITIES,
  SIZES,
  PRIORITIES,
  CONTACT_CHANNELS,
  OVERRIDE_REASONS,
  money,
  fullName,
  type Category,
  type Modality,
  type Priority,
  type DeliveryType,
} from "@/lib/cm";
import { logActivity } from "@/lib/storage";
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
});

function NuevoPedido() {
  const navigate = useNavigate();
  const { data: customers } = useCustomers();
  const { data: products = [] } = useProducts(false);
  const { data: rules } = usePriceRules();
  const { data: profiles } = useProfiles();
  const { data: themes = [] } = useProductThemes();
  const invalidate = useInvalidate();

  // Cliente
  const [customerId, setCustomerId] = useState<string>("");
  const [newCustomer, setNewCustomer] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    contact_channel: "WhatsApp",
  });
  const [customerSearch, setCustomerSearch] = useState("");

  // Pedido
  const [priority, setPriority] = useState<Priority>("normal");
  const [dueDate, setDueDate] = useState("");
  const [assignee, setAssignee] = useState<string>("");
  const [discount, setDiscount] = useState("0");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Entrega
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

  // ==========================================
  // ESTADO DE ARTÍCULOS (NUEVO CONCEPTO UX)
  // ==========================================
  // 1. Artículos ya confirmados en el pedido (inicia vacío [])
  const [items, setItems] = useState<Item[]>([]);

  // 2. Parámetros recordados para captura rápida consecutiva
  const [lastModality, setLastModality] = useState<Modality>("cutter_only");
  const [lastSize, setLastSize] = useState<number>(8);
  const [categoryFilter, setCategoryFilter] = useState<Category | "TODAS">("TODAS");
  const [themeFilter, setThemeFilter] = useState<string>("TODAS");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // 3. Artículo actualmente en configuración (draft)
  const [draftItem, setDraftItem] = useState<Item>(() =>
    createEmptyDraft("CORTADORES", "cutter_only", 8),
  );

  // 4. Diálogo de edición para productos ya confirmados
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Filtrado de clientes
  const filteredCustomers = useMemo(() => {
    const t = customerSearch.trim().toLowerCase();
    return (customers ?? []).filter(
      (c) =>
        !t ||
        fullName(c.first_name, c.last_name).toLowerCase().includes(t) ||
        (c.phone ?? "").includes(t),
    );
  }, [customers, customerSearch]);

  // Cálculo de precio para cualquier artículo
  const computedPrice = (it: Item) => {
    if (it.price_overridden) return it.unit_price;
    if (it.category === "CORTADORES") {
      return priceFor(rules, it.cutter_modality, it.cutter_size_cm);
    }
    const p = products.find((x) => x.id === it.product_id);
    return Number(p?.base_price ?? it.unit_price ?? 0);
  };

  // Precios y totales
  const draftUnitPrice = computedPrice(draftItem);
  const draftSubtotal = draftUnitPrice * draftItem.quantity;

  const subtotal = items.reduce((a, it) => a + computedPrice(it) * it.quantity, 0);
  const shippingCost = deliveryType === "envio" ? Number(shipping.shipping_cost || 0) : 0;
  const total = Math.max(0, subtotal - Number(discount || 0) + shippingCost);
  const totalUnits = items.reduce((a, it) => a + it.quantity, 0);

  // Producto de catálogo actualmente seleccionado en draft
  const selectedCatalogProduct = useMemo(
    () => products.find((p) => p.id === draftItem.product_id) ?? null,
    [products, draftItem.product_id],
  );

  // ==========================================
  // MANEJO DE SELECCIÓN DE PRODUCTO
  // ==========================================
  const handleProductSelect = (p: any | null) => {
    if (!p) {
      // Modo manual
      setDraftItem((prev) => ({
        ...prev,
        product_id: null,
        product_sku: null,
        product_name: "",
        category: prev.category || "CORTADORES",
        unit_price: 0,
        price_overridden: false,
        image_preview: null,
      }));
      return;
    }

    const isCutter = p.category === "CORTADORES";
    const img = (p.product_images ?? []).find((i: any) => i.is_primary) ?? p.product_images?.[0];

    setDraftItem((prev) => ({
      ...prev,
      product_id: p.id,
      product_name: p.name,
      product_sku: p.sku,
      category: p.category,
      cutter_modality: isCutter ? prev.cutter_modality || lastModality : null,
      cutter_size_cm: isCutter ? prev.cutter_size_cm || lastSize : null,
      unit_price: isCutter ? 0 : Number(p.base_price ?? 0),
      price_overridden: false,
      image_preview: img,
    }));
  };

  // ==========================================
  // AÑADIR DRAFT AL PEDIDO
  // ==========================================
  const addDraftToOrder = () => {
    if (!draftItem.product_name.trim()) {
      toast.error("Selecciona un producto o escribe su nombre");
      return;
    }
    if (draftItem.quantity <= 0) {
      toast.error("La cantidad debe ser al menos 1");
      return;
    }

    const calculatedUnitPrice = computedPrice(draftItem);
    const itemToAdd: Item = {
      ...draftItem,
      unit_price: calculatedUnitPrice,
      key: crypto.randomUUID(),
    };

    // Actualizar modalidades recordadas si es cortador
    if (draftItem.category === "CORTADORES") {
      if (draftItem.cutter_modality) setLastModality(draftItem.cutter_modality);
      if (draftItem.cutter_size_cm) setLastSize(draftItem.cutter_size_cm);
    }

    // Comprobar si existe un producto idéntico para sumar cantidades
    const existingIndex = items.findIndex((it) => {
      const sameProduct = it.product_id && it.product_id === draftItem.product_id;
      const sameName = it.product_name.trim().toLowerCase() === draftItem.product_name.trim().toLowerCase();
      const sameCategory = it.category === draftItem.category;
      const sameModality = it.cutter_modality === draftItem.cutter_modality;
      const sameSize = it.cutter_size_cm === draftItem.cutter_size_cm;
      const sameNotes = (it.notes || "").trim() === (draftItem.notes || "").trim();
      const samePrice = computedPrice(it) === calculatedUnitPrice;

      return (
        (sameProduct || sameName) &&
        sameCategory &&
        sameModality &&
        sameSize &&
        sameNotes &&
        samePrice
      );
    });

    if (existingIndex >= 0) {
      // Sumar cantidad al producto existente
      setItems((prev) =>
        prev.map((it, idx) =>
          idx === existingIndex ? { ...it, quantity: it.quantity + draftItem.quantity } : it,
        ),
      );
      toast.success(
        `Cantidad actualizada: ${(items[existingIndex]?.quantity ?? 0) + draftItem.quantity} piezas para "${draftItem.product_name}"`,
      );
    } else {
      // Añadir nueva fila
      setItems((prev) => [...prev, itemToAdd]);
      toast.success(`"${draftItem.product_name}" añadido al pedido`);
    }

    // 1. Reiniciar draftItem conservando categoría, temática, modalidad y tamaño
    const nextModality = draftItem.cutter_modality || lastModality;
    const nextSize = draftItem.cutter_size_cm || lastSize;

    setDraftItem(createEmptyDraft(draftItem.category, nextModality, nextSize));

    // 2. Limpiar texto de búsqueda
    setSearchQuery("");

    // 3. Regresar foco inmediatamente al buscador
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  // ==========================================
  // ACCIONES SOBRE PRODUCTOS AÑADIDOS
  // ==========================================
  const handleRemoveItem = (index: number) => {
    const itemToRemove = items[index];
    if (!itemToRemove) return;
    setItems((prev) => prev.filter((_, i) => i !== index));

    toast(`"${itemToRemove.product_name}" eliminado`, {
      action: {
        label: "Deshacer",
        onClick: () => {
          setItems((prev) => {
            const next = [...prev];
            next.splice(index, 0, itemToRemove);
            return next;
          });
        },
      },
    });
  };

  const handleDuplicateItem = (item: Item) => {
    const duplicated: Item = {
      ...item,
      key: crypto.randomUUID(),
    };
    setItems((prev) => [...prev, duplicated]);
    toast.success(`Copia creada de "${item.product_name}"`);
  };

  const openEditModal = (item: Item) => {
    setEditingItem({ ...item });
    setIsEditOpen(true);
  };

  const saveEditedItem = () => {
    if (!editingItem) return;
    if (!editingItem.product_name.trim()) {
      toast.error("El nombre no puede estar vacío");
      return;
    }
    const updatedPrice = computedPrice(editingItem);
    setItems((prev) =>
      prev.map((it) =>
        it.key === editingItem.key
          ? {
              ...editingItem,
              unit_price: updatedPrice,
            }
          : it,
      ),
    );
    setIsEditOpen(false);
    setEditingItem(null);
    toast.success("Artículo actualizado");
  };

  // Atajos de teclado (Enter para añadir si hay producto seleccionado y no estamos en textarea)
  const handleKeyDownOnDraft = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey || (e.target as HTMLElement).tagName !== "TEXTAREA")) {
      e.preventDefault();
      addDraftToOrder();
    }
  };

  // ==========================================
  // GUARDAR PEDIDO
  // ==========================================
  const save = async () => {
    if (items.length === 0) {
      if (draftItem.product_name.trim()) {
        toast.error(
          "Tienes un producto seleccionado en el configurador. Pulsa 'Añadir al pedido' antes de guardar.",
        );
      } else {
        toast.error("Añade al menos un producto al pedido.");
      }
      return;
    }

    setSaving(true);
    try {
      let cid = customerId;
      if (!cid) {
        if (!newCustomer.first_name.trim()) throw new Error("Elige un cliente o escribe su nombre");
        const { data, error } = await supabase
          .from("customers")
          .insert({
            first_name: newCustomer.first_name.trim(),
            last_name: newCustomer.last_name.trim() || null,
            phone: newCustomer.phone.trim() || null,
            contact_channel: newCustomer.contact_channel,
          })
          .select("id")
          .single();
        if (error) throw error;
        cid = data.id;
      }

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
        sort_order: idx,
      }));

      const { error: iErr } = await supabase.from("order_items").insert(rows);
      if (iErr) throw iErr;

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

      toast.success("¡Pedido registrado exitosamente!");
      invalidate("orders", "customers", "activity");
      navigate({ to: "/pedidos/$orderId", params: { orderId: order.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el pedido");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Nuevo pedido"
        subtitle="Captura ágil de artículos, cliente y entrega"
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px]">
        {/* COLUMNA PRINCIPAL (Izquierda) */}
        <div className="space-y-5">
          {/* 1. SECCIÓN CLIENTE */}
          <section className="panel p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg">1. Cliente</h2>
              {customerId && (
                <button
                  type="button"
                  onClick={() => setCustomerId("")}
                  className="text-xs text-primary underline"
                >
                  Cambiar / Nuevo cliente
                </button>
              )}
            </div>

            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="tap pl-9"
                placeholder="Buscar cliente por nombre o teléfono..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
            </div>

            {/* Chips de clientes frecuentes / encontrados */}
            <div className="mb-3 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto pr-1">
              {filteredCustomers.slice(0, 10).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCustomerId(customerId === c.id ? "" : c.id)}
                  className={cn(
                    "chip border text-xs transition-colors",
                    customerId === c.id
                      ? "bg-primary text-primary-foreground font-bold border-primary shadow-sm"
                      : "border-border text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {fullName(c.first_name, c.last_name)}
                  {c.phone ? ` (${c.phone.slice(-4)})` : ""}
                </button>
              ))}
            </div>

            {!customerId && (
              <div className="rounded-xl border border-dashed border-border/80 bg-secondary/30 p-3.5">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">
                  O registrar nuevo cliente:
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nombre *</Label>
                    <Input
                      className="tap h-9 text-sm"
                      value={newCustomer.first_name}
                      onChange={(e) => setNewCustomer({ ...newCustomer, first_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Apellido</Label>
                    <Input
                      className="tap h-9 text-sm"
                      value={newCustomer.last_name}
                      onChange={(e) => setNewCustomer({ ...newCustomer, last_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Teléfono</Label>
                    <Input
                      className="tap h-9 text-sm"
                      inputMode="tel"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Canal de contacto</Label>
                    <Select
                      value={newCustomer.contact_channel}
                      onValueChange={(v) => setNewCustomer({ ...newCustomer, contact_channel: v })}
                    >
                      <SelectTrigger className="tap h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTACT_CHANNELS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* 2. SECCIÓN AÑADIR PRODUCTO (CAPTURA ÁGIL Y COMPACTA) */}
          <section className="panel p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg">2. Añadir producto</h2>
                <p className="text-xs text-muted-foreground">
                  Busca por SKU o nombre, ajusta especificaciones y añade al pedido.
                </p>
              </div>
              <span className="chip bg-primary/10 text-primary font-bold text-xs">
                {items.length} añadidos ({totalUnits} pzas)
              </span>
            </div>

            {/* UN SOLO BUSCADOR UNIVERSAL */}
            <ProductPicker
              products={products}
              themes={themes}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              themeFilter={themeFilter}
              onThemeFilterChange={setThemeFilter}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              searchInputRef={searchInputRef}
              selectedProductId={draftItem.product_id}
              onSelect={handleProductSelect}
              className="mb-4"
            />

            {/* CONFIGURADOR DEL PRODUCTO SELECCIONADO (Aparece al seleccionar o modo manual) */}
            <div
              onKeyDown={handleKeyDownOnDraft}
              className={cn(
                "rounded-xl border p-4 transition-all",
                draftItem.product_name || draftItem.product_id !== null
                  ? "border-primary/60 bg-secondary/60 shadow-sm ring-1 ring-primary/20"
                  : "border-dashed border-border bg-card/40",
              )}
            >
              {draftItem.product_id !== null || draftItem.product_name ? (
                <div className="space-y-4">
                  {/* Encabezado del producto seleccionado */}
                  <div className="flex items-center gap-3 border-b border-border/60 pb-3">
                    <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
                      {draftItem.image_preview ? (
                        <StoredImage
                          image={draftItem.image_preview}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Package className="h-6 w-6 text-muted-foreground opacity-60" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {draftItem.product_sku && (
                          <span className="font-mono text-xs font-bold text-primary">
                            {draftItem.product_sku}
                          </span>
                        )}
                        <span
                          className="chip text-[10px] py-0 px-1.5"
                          style={{
                            color: `var(--${CATEGORY_META[draftItem.category].token})`,
                            background: `color-mix(in oklab, var(--${CATEGORY_META[draftItem.category].token}) 16%, transparent)`,
                          }}
                        >
                          {CATEGORY_META[draftItem.category].label}
                        </span>
                      </div>
                      <p className="truncate text-base font-semibold text-foreground">
                        {draftItem.product_name || "Artículo personalizado"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setDraftItem(
                          createEmptyDraft(
                            draftItem.category,
                            draftItem.cutter_modality || lastModality,
                            draftItem.cutter_size_cm || lastSize,
                          ),
                        )
                      }
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      Cambiar
                    </button>
                  </div>

                  {/* Campos específicos según categoría */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Modo Manual: campo de nombre si no tiene catálogo */}
                    {!draftItem.product_id && (
                      <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                        <Label className="text-xs">Nombre del artículo *</Label>
                        <Input
                          className="tap h-9 text-sm"
                          placeholder="Escribe el nombre del artículo..."
                          value={draftItem.product_name}
                          onChange={(e) =>
                            setDraftItem((prev) => ({ ...prev, product_name: e.target.value }))
                          }
                          autoFocus
                        />
                      </div>
                    )}

                    {/* CORTADORES: Modalidad y Tamaño */}
                    {draftItem.category === "CORTADORES" && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs">Modalidad</Label>
                          <Select
                            value={draftItem.cutter_modality ?? "cutter_only"}
                            onValueChange={(v) =>
                              setDraftItem((prev) => ({
                                ...prev,
                                cutter_modality: v as Modality,
                              }))
                            }
                          >
                            <SelectTrigger className="tap h-9 text-xs">
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
                          <Label className="text-xs">Tamaño</Label>
                          <Select
                            value={String(draftItem.cutter_size_cm ?? 8)}
                            onValueChange={(v) =>
                              setDraftItem((prev) => ({
                                ...prev,
                                cutter_size_cm: Number(v),
                              }))
                            }
                          >
                            <SelectTrigger className="tap h-9 text-xs">
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
                      </>
                    )}

                    {/* STEPPER DE CANTIDAD [-] N [+] */}
                    <div className="space-y-1">
                      <Label className="text-xs">Cantidad</Label>
                      <div className="flex items-center rounded-lg border border-border bg-background">
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center text-base font-bold text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-95 transition-all rounded-l-lg"
                          onClick={() =>
                            setDraftItem((prev) => ({
                              ...prev,
                              quantity: Math.max(1, prev.quantity - 1),
                            }))
                          }
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={1}
                          className="h-9 w-full border-0 bg-transparent text-center text-sm font-bold focus:outline-none"
                          value={draftItem.quantity}
                          onChange={(e) =>
                            setDraftItem((prev) => ({
                              ...prev,
                              quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                            }))
                          }
                        />
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center text-base font-bold text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-95 transition-all rounded-r-lg"
                          onClick={() =>
                            setDraftItem((prev) => ({
                              ...prev,
                              quantity: prev.quantity + 1,
                            }))
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* PRECIO UNITARIO (si no es cortador o si tiene override) */}
                    {draftItem.category !== "CORTADORES" && (
                      <div className="space-y-1">
                        <Label className="text-xs">Precio unitario</Label>
                        <Input
                          className="tap h-9 text-sm"
                          inputMode="decimal"
                          value={draftItem.price_overridden ? draftItem.unit_price : draftUnitPrice}
                          onChange={(e) =>
                            setDraftItem((prev) => ({
                              ...prev,
                              price_overridden: true,
                              unit_price: Number(e.target.value) || 0,
                            }))
                          }
                        />
                      </div>
                    )}

                    {/* NOTAS DEL ARTÍCULO */}
                    <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                      <Label className="text-xs">Notas opcionales para producción / personalización</Label>
                      <Input
                        className="tap h-9 text-sm"
                        placeholder="Ej. Color especial, nombre personalizado, etc."
                        value={draftItem.notes}
                        onChange={(e) =>
                          setDraftItem((prev) => ({ ...prev, notes: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  {/* Resumen de precio de este producto y Botón AÑADIR */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background/80 p-3 border border-border/80">
                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">Unitario: </span>
                        <span className="font-semibold text-foreground">
                          {money(draftUnitPrice)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Subtotal: </span>
                        <span className="font-display text-base text-primary">
                          {money(draftSubtotal)}
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={addDraftToOrder}
                      className="tap font-bold h-10 px-5 shadow-md shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Plus className="mr-1.5 h-4 w-4 stroke-[3]" /> Añadir al pedido
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary/40 animate-pulse" />
                  <p className="font-medium text-foreground">
                    Selecciona un producto en la lista superior
                  </p>
                  <p className="mt-0.5">
                    O haz clic en "Artículo manual" para registrar un producto no listado en el catálogo.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* 3. SECCIÓN PRODUCTOS AÑADIDOS (CONFIRMADOS - LISTA COMPACTA) */}
          <section className="panel p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg">
                  3. Productos añadidos ({items.length})
                </h2>
                <p className="text-xs text-muted-foreground">
                  {totalUnits} unidades en total · Total artículos: {money(subtotal)}
                </p>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                <ShoppingBag className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                <p className="font-medium">Todavía no has añadido productos al pedido.</p>
                <p className="text-xs mt-1">
                  Busca un producto arriba y presiona <strong>"Añadir al pedido"</strong>.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((it, idx) => {
                  const price = computedPrice(it);
                  const itemSubtotal = price * it.quantity;
                  const prod = products.find((p) => p.id === it.product_id);
                  const img =
                    (prod?.product_images ?? []).find((i: any) => i.is_primary) ??
                    prod?.product_images?.[0];

                  return (
                    <div
                      key={it.key}
                      className="group flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:border-border/80 hover:bg-secondary/40"
                    >
                      {/* Miniatura & Datos */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary">
                          {img ? (
                            <StoredImage image={img} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Package className="h-5 w-5 text-muted-foreground opacity-50" />
                          )}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {it.product_sku && (
                              <span className="font-mono text-xs font-bold text-primary">
                                {it.product_sku}
                              </span>
                            )}
                            <span
                              className="chip text-[10px] py-0 px-1.5"
                              style={{
                                color: `var(--${CATEGORY_META[it.category].token})`,
                                background: `color-mix(in oklab, var(--${CATEGORY_META[it.category].token}) 16%, transparent)`,
                              }}
                            >
                              {CATEGORY_META[it.category].label}
                            </span>
                          </div>

                          <p className="truncate text-sm font-semibold text-foreground">
                            {it.product_name}
                          </p>

                          {/* Especificaciones de Cortador o Notas */}
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {it.category === "CORTADORES" && (
                              <span>
                                {MODALITIES.find((m) => m.value === it.cutter_modality)?.label ?? "Cortador"} · {it.cutter_size_cm ?? 8} cm
                              </span>
                            )}
                            {it.notes && (
                              <span className="chip bg-secondary text-[10px] py-0 text-foreground">
                                Nota: {it.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Desglose Cantidad × Precio = Subtotal */}
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            <span className="font-bold text-foreground">{it.quantity}</span> × {money(price)}
                          </p>
                          <p className="font-display text-sm font-bold text-primary">
                            {money(itemSubtotal)}
                          </p>
                        </div>

                        {/* Botones de acción: Editar, Duplicar, Eliminar */}
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="tap h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openEditModal(it)}
                            title="Editar artículo"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="tap h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleDuplicateItem(it)}
                            title="Duplicar artículo"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="tap h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveItem(idx)}
                            title="Eliminar artículo"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 4. SECCIÓN ENTREGA */}
          <section className="panel p-4 sm:p-5">
            <h2 className="mb-3 font-display text-lg">4. Entrega</h2>
            <div className="mb-3 flex gap-2">
              {(["envio", "entrega_personal"] as DeliveryType[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDeliveryType(d)}
                  className={cn(
                    "chip flex-1 border border-border text-xs py-2 transition-all font-semibold",
                    deliveryType === d
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {d === "envio" ? "📦 Envío por paquetería" : "🤝 Entrega personal"}
                </button>
              ))}
            </div>

            {deliveryType === "envio" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["first_name", "Nombre de quien recibe"],
                    ["last_name", "Apellido"],
                    ["phone", "Teléfono"],
                    ["street", "Calle"],
                    ["ext_number", "Número exterior"],
                    ["int_number", "Número interior"],
                    ["neighborhood", "Colonia"],
                    ["postal_code", "Código postal"],
                    ["city", "Ciudad"],
                    ["municipality", "Municipio"],
                    ["state", "Estado"],
                    ["carrier", "Paquetería"],
                    ["shipping_cost", "Costo de envío"],
                  ] as const
                ).map(([k, label]) => (
                  <div key={k} className="space-y-1.5">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      className="tap h-9 text-sm"
                      value={shipping[k]}
                      onChange={(e) => setShipping({ ...shipping, [k]: e.target.value })}
                    />
                  </div>
                ))}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Referencias de entrega</Label>
                  <Textarea
                    rows={2}
                    className="text-sm"
                    value={shipping.references_text}
                    onChange={(e) => setShipping({ ...shipping, references_text: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Instrucciones especiales</Label>
                  <Textarea
                    rows={2}
                    className="text-sm"
                    value={shipping.special_instructions}
                    onChange={(e) =>
                      setShipping({ ...shipping, special_instructions: e.target.value })
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nombre de quien recibe</Label>
                  <Input
                    className="tap h-9 text-sm"
                    value={delivery.first_name}
                    onChange={(e) => setDelivery({ ...delivery, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Apellido</Label>
                  <Input
                    className="tap h-9 text-sm"
                    value={delivery.last_name}
                    onChange={(e) => setDelivery({ ...delivery, last_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Teléfono</Label>
                  <Input
                    className="tap h-9 text-sm"
                    value={delivery.phone}
                    onChange={(e) => setDelivery({ ...delivery, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Lugar / Punto de entrega</Label>
                  <Input
                    className="tap h-9 text-sm"
                    value={delivery.place}
                    onChange={(e) => setDelivery({ ...delivery, place: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fecha</Label>
                  <Input
                    className="tap h-9 text-sm"
                    type="date"
                    value={delivery.delivery_date}
                    onChange={(e) => setDelivery({ ...delivery, delivery_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Hora</Label>
                  <Input
                    className="tap h-9 text-sm"
                    type="time"
                    value={delivery.delivery_time}
                    onChange={(e) => setDelivery({ ...delivery, delivery_time: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Instrucciones</Label>
                  <Textarea
                    rows={2}
                    className="text-sm"
                    value={delivery.instructions}
                    onChange={(e) => setDelivery({ ...delivery, instructions: e.target.value })}
                  />
                </div>
              </div>
            )}
          </section>
        </div>

        {/* COLUMNA LATERAL (Sticky en computadora) */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          {/* Parámetros del pedido */}
          <section className="panel p-4 space-y-3">
            <h2 className="font-display text-lg">Detalles del pedido</h2>

            <div className="space-y-1.5">
              <Label className="text-xs">Prioridad</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger className="tap h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Fecha límite de entrega</Label>
              <Input
                className="tap h-9 text-xs"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Responsable del pedido</Label>
              <Select
                value={assignee || "none"}
                onValueChange={(v) => setAssignee(v === "none" ? "" : v)}
              >
                <SelectTrigger className="tap h-9 text-xs">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {(profiles ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name ?? p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Descuento ($)</Label>
              <Input
                className="tap h-9 text-xs"
                inputMode="decimal"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Nota interna del pedido</Label>
              <Textarea
                rows={2}
                className="text-xs"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Observaciones generales..."
              />
            </div>
          </section>

          {/* Resumen de totales */}
          <section className="panel p-4 shadow-lg border-primary/20">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Resumen de compra
            </h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Productos ({totalUnits} pzas)</span>
                <span className="font-semibold">{money(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Descuento</span>
                <span className="text-destructive font-medium">-{money(Number(discount || 0))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Envío</span>
                <span className="font-medium">{money(shippingCost)}</span>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <div>
                  <span className="font-bold text-foreground">Total</span>
                  <p className="text-[10px] text-muted-foreground">IVA incluido</p>
                </div>
                <span className="font-display text-2xl font-bold text-primary">
                  {money(total)}
                </span>
              </div>
            </div>

            <Button
              onClick={save}
              disabled={saving}
              className="tap mt-4 w-full h-11 font-bold text-base bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Guardando pedido...
                </>
              ) : (
                "Guardar pedido"
              )}
            </Button>
          </section>
        </aside>
      </div>

      {/* DIÁLOGO MODAL PARA EDITAR ARTÍCULO AÑADIDO */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-lg">
              <Pencil className="h-4 w-4 text-primary" /> Editar artículo del pedido
            </DialogTitle>
          </DialogHeader>

          {editingItem && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-secondary p-2.5">
                <p className="text-xs font-mono font-bold text-primary">{editingItem.product_sku}</p>
                <p className="text-sm font-semibold">{editingItem.product_name}</p>
              </div>

              {/* Si es cortador: Modalidad y Tamaño */}
              {editingItem.category === "CORTADORES" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Modalidad</Label>
                    <Select
                      value={editingItem.cutter_modality ?? "cutter_only"}
                      onValueChange={(v) =>
                        setEditingItem({ ...editingItem, cutter_modality: v as Modality })
                      }
                    >
                      <SelectTrigger className="tap text-xs">
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
                    <Label className="text-xs">Tamaño</Label>
                    <Select
                      value={String(editingItem.cutter_size_cm ?? 8)}
                      onValueChange={(v) =>
                        setEditingItem({ ...editingItem, cutter_size_cm: Number(v) })
                      }
                    >
                      <SelectTrigger className="tap text-xs">
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

              {/* Stepper Cantidad */}
              <div className="space-y-1">
                <Label className="text-xs">Cantidad</Label>
                <div className="flex items-center rounded-lg border border-border bg-background">
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center text-base font-bold text-muted-foreground hover:bg-secondary rounded-l-lg"
                    onClick={() =>
                      setEditingItem({
                        ...editingItem,
                        quantity: Math.max(1, editingItem.quantity - 1),
                      })
                    }
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    className="h-9 w-full border-0 bg-transparent text-center text-sm font-bold focus:outline-none"
                    value={editingItem.quantity}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center text-base font-bold text-muted-foreground hover:bg-secondary rounded-r-lg"
                    onClick={() =>
                      setEditingItem({
                        ...editingItem,
                        quantity: editingItem.quantity + 1,
                      })
                    }
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Precio unitario */}
              <div className="space-y-1">
                <Label className="text-xs">Precio unitario ($)</Label>
                <Input
                  className="tap text-sm"
                  inputMode="decimal"
                  value={editingItem.price_overridden ? editingItem.unit_price : computedPrice(editingItem)}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      price_overridden: true,
                      unit_price: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>

              {/* Notas del artículo */}
              <div className="space-y-1">
                <Label className="text-xs">Notas del artículo</Label>
                <Textarea
                  rows={2}
                  className="text-sm"
                  value={editingItem.notes}
                  onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
                />
              </div>

              <div className="rounded-lg bg-secondary/50 p-2.5 text-right text-xs">
                <span className="text-muted-foreground">Nuevo subtotal: </span>
                <span className="font-display text-base font-bold text-primary">
                  {money(computedPrice(editingItem) * editingItem.quantity)}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="tap"
              onClick={() => setIsEditOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" className="tap font-bold" onClick={saveEditedItem}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
