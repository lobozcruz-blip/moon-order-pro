import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useRef } from "react";
import {
  Plus,
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
  // ESTADO DE ARTÍCULOS (UX ÁGIL)
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
  const [draftPriceInput, setDraftPriceInput] = useState<string>("0");
  // Modo artículo manual / personalizado (sin catálogo)
  const [manualMode, setManualMode] = useState(false);

  // 4. Diálogo de edición para productos ya confirmados
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingPriceInput, setEditingPriceInput] = useState<string>("0");
  const [isEditOpen, setIsEditOpen] = useState(false);

  // 5. Modal de visualización de diseño personalizado (1-tap)
  const [viewerItem, setViewerItem] = useState<Item | null>(null);

  // 6. Diálogos posteriores al guardado exitoso
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [createdOrderSummary, setCreatedOrderSummary] = useState<SummaryOrderData | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

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
  const shippingCost =
    deliveryType === "envio"
      ? parseFloat(String(shipping.shipping_cost || 0).replace(",", ".")) || 0
      : 0;
  const discountNum = parseFloat(String(discount || 0).replace(",", ".")) || 0;
  const total = Math.max(0, subtotal - discountNum + shippingCost);
  const totalUnits = items.reduce((a, it) => a + it.quantity, 0);

  // ==========================================
  // MANEJO DE SELECCIÓN DE PRODUCTO
  // ==========================================
  const handleProductSelect = (p: any | null) => {
    if (!p) {
      // Modo manual
      setManualMode(true);
      setDraftPriceInput("0");
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

    setManualMode(false);
    const isCutter = p.category === "CORTADORES";
    const img = (p.product_images ?? []).find((i: any) => i.is_primary) ?? p.product_images?.[0];
    const initialPrice = isCutter ? 0 : Number(p.base_price ?? 0);
    setDraftPriceInput(String(initialPrice));

    setDraftItem((prev) => ({
      ...prev,
      product_id: p.id,
      product_name: p.name,
      product_sku: p.sku,
      category: p.category,
      cutter_modality: isCutter ? prev.cutter_modality || lastModality : null,
      cutter_size_cm: isCutter ? prev.cutter_size_cm || lastSize : null,
      unit_price: initialPrice,
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

    // VALIDACIÓN ESTRICTA: Imagen obligatoria si es personalizado
    if (draftItem.is_custom && draftItem.custom_images.length === 0) {
      toast.error(
        "Añade al menos una imagen del diseño personalizado para poder fabricar este artículo.",
      );
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
    // (Solo agrupamos si NO es personalizado o si tienen exactamente las mismas notas y sin imágenes específicas)
    const existingIndex = items.findIndex((it) => {
      if (it.is_custom || draftItem.is_custom) return false; // Los personalizados se mantienen como líneas independientes
      const sameProduct = it.product_id && it.product_id === draftItem.product_id;
      const sameName =
        it.product_name.trim().toLowerCase() === draftItem.product_name.trim().toLowerCase();
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
      toast.success(
        draftItem.is_custom
          ? `Artículo personalizado "${draftItem.product_name}" añadido con ${draftItem.custom_images.length} imagen(es)`
          : `"${draftItem.product_name}" añadido al pedido`,
      );
    }

    // 1. Reiniciar draftItem conservando categoría, modalidad y tamaño pero limpiando imágenes
    const nextModality = draftItem.cutter_modality || lastModality;
    const nextSize = draftItem.cutter_size_cm || lastSize;

    setManualMode(false);
    setDraftItem({
      ...createEmptyDraft(draftItem.category, nextModality, nextSize),
      is_custom: false,
      custom_images: [],
    });
    setDraftPriceInput("0");
    setSearchQuery("");

    // 2. Regresar el foco al buscador
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  // ==========================================
  // EDICIÓN DE ARTÍCULO YA AÑADIDO
  // ==========================================
  const startEditItem = (it: Item) => {
    setEditingItem({
      ...it,
      custom_images: [...it.custom_images],
    });
    setEditingPriceInput(String(it.unit_price));
    setIsEditOpen(true);
  };

  const saveEditedItem = () => {
    if (!editingItem) return;

    if (!editingItem.product_name.trim()) {
      toast.error("El nombre no puede estar vacío");
      return;
    }
    if (editingItem.quantity <= 0) {
      toast.error("La cantidad debe ser al menos 1");
      return;
    }

    if (editingItem.is_custom && editingItem.custom_images.length === 0) {
      toast.error(
        "Añade al menos una imagen del diseño personalizado para poder fabricar este artículo.",
      );
      return;
    }

    setItems((prev) =>
      prev.map((it) => (it.key === editingItem.key ? { ...editingItem } : it)),
    );
    toast.success(`Artículo "${editingItem.product_name}" actualizado`);
    setIsEditOpen(false);
    setEditingItem(null);
  };

  // ==========================================
  // DUPLICAR ARTÍCULO
  // ==========================================
  const duplicateItem = (key: string) => {
    const itemToDup = items.find((it) => it.key === key);
    if (!itemToDup) return;

    const duplicated: Item = {
      ...itemToDup,
      key: crypto.randomUUID(),
      // Clonar referencias de imágenes con IDs independientes
      custom_images: itemToDup.custom_images.map((img) => ({
        ...img,
        id: crypto.randomUUID(),
      })),
    };

    setItems((prev) => [...prev, duplicated]);
    toast.success(`"${itemToDup.product_name}" duplicado`);
  };

  // ==========================================
  // ELIMINAR ARTÍCULO
  // ==========================================
  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((it) => it.key !== key));
  };

  // ==========================================
  // REINICIAR FORMULARIO COMPLETO
  // ==========================================
  const resetForm = () => {
    setItems([]);
    setCustomerId("");
    setNewCustomer({ first_name: "", last_name: "", phone: "", contact_channel: "WhatsApp" });
    setCustomerSearch("");
    setPriority("normal");
    setDueDate("");
    setAssignee("");
    setDiscount("0");
    setNote("");
    setManualMode(false);
    setDraftItem(createEmptyDraft("CORTADORES", lastModality, lastSize));
    setDraftPriceInput("0");
    setSearchQuery("");
    setShowSuccessDialog(false);
    setCreatedOrderId(null);
    setCreatedOrderSummary(null);
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

      // Inserción de order_items con is_custom
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

      if (iErr) throw iErr;

      // Subir y guardar imágenes de diseño personalizado para cada order_item
      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx];
        const createdItem = createdItems?.[idx];
        if (!createdItem || it.custom_images.length === 0) continue;

        for (let imgIdx = 0; imgIdx < it.custom_images.length; imgIdx++) {
          const customImg = it.custom_images[imgIdx];
          let storagePath = customImg.storage_path;

          if (customImg.file) {
            try {
              const ext = customImg.file.name.split(".").pop() ?? "webp";
              const keyHint = `items/${createdItem.id}`;
              storagePath = await uploadFile("pedidos", customImg.file, `${order.id}/${keyHint}`);
            } catch (err: any) {
              console.error("Error uploading custom image:", err);
              toast.error(
                `No se pudo guardar la imagen de referencia de "${it.product_name}". Intenta nuevamente.`,
              );
              throw err;
            }
          }

          if (storagePath) {
            const { error: imgErr } = await supabase.from("order_item_images").insert({
              order_item_id: createdItem.id,
              storage_path: storagePath,
              is_primary: customImg.is_primary,
              image_type: "custom_reference",
              sort_order: imgIdx,
            });
            if (imgErr) console.error("Error inserting order_item_images:", imgErr);
          }
        }
      }

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

      // Obtener el folio asignado
      const { data: updatedOrder } = await supabase
        .from("orders")
        .select("folio, created_at")
        .eq("id", order.id)
        .single();

      const folioAssigned = updatedOrder?.folio ?? "Pedido";

      const clientDisplayName =
        customerId && customers
          ? fullName(
              customers.find((c) => c.id === customerId)?.first_name,
              customers.find((c) => c.id === customerId)?.last_name,
            )
          : fullName(newCustomer.first_name, newCustomer.last_name) || "Cliente";

      const summaryData: SummaryOrderData = {
        id: order.id,
        folio: folioAssigned,
        created_at: updatedOrder?.created_at || new Date().toISOString(),
        customer_name: clientDisplayName,
        delivery_type: deliveryType,
        items: items.map((it) => ({
          name: it.product_name,
          sku: it.product_sku,
          category: it.category,
          quantity: it.quantity,
          cutter_modality: it.cutter_modality,
          cutter_size_cm: it.cutter_size_cm,
          unit_price: computedPrice(it),
          subtotal: computedPrice(it) * it.quantity,
          image_path: it.product_id
            ? products.find((p) => p.id === it.product_id)?.product_images?.[0]?.storage_path ??
              null
            : null,
        })),
        shipping_cost: shippingCost,
        discount: discountNum,
        total,
        advance_payment: 0,
        due_date: dueDate || null,
        personal_delivery_place: deliveryType === "entrega_personal" ? delivery.place : undefined,
        personal_delivery_time:
          deliveryType === "entrega_personal" ? delivery.delivery_time : undefined,
      };

      setCreatedOrderId(order.id);
      setCreatedOrderSummary(summaryData);
      setShowSuccessDialog(true);
      invalidate("orders", "production-queue", "dashboard-sales-summary", "sales-analytics");
    } catch (e: any) {
      toast.error(e.message ?? "Error al guardar el pedido");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Nuevo pedido"
        subtitle="Captura rápida de productos y personalizaciones para el taller"
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* COLUMNA PRINCIPAL */}
        <div className="space-y-6">
          {/* 1. SECCIÓN CLIENTE */}
          <section className="panel p-4 sm:p-5">
            <h2 className="mb-3 font-display text-lg">1. Cliente</h2>
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="tap pl-9 text-sm"
                  placeholder="Buscar cliente existente por nombre o teléfono…"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
              </div>

              {customerSearch && (
                <div className="max-h-48 overflow-y-auto divide-y divide-border rounded-lg border border-border bg-background">
                  {filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCustomerId(c.id);
                        setCustomerSearch("");
                      }}
                      className="tap flex w-full items-center justify-between p-2.5 text-left text-xs hover:bg-secondary"
                    >
                      <span className="font-semibold">{fullName(c.first_name, c.last_name)}</span>
                      <span className="text-muted-foreground">{c.phone}</span>
                    </button>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <p className="p-3 text-center text-xs text-muted-foreground">
                      No se encontró ningún cliente. Puedes registrarlo abajo.
                    </p>
                  )}
                </div>
              )}

              {customerId ? (
                <div className="flex items-center justify-between rounded-lg bg-primary/10 p-3 text-sm text-primary">
                  <div>
                    <span className="font-semibold">
                      {fullName(
                        customers?.find((c) => c.id === customerId)?.first_name,
                        customers?.find((c) => c.id === customerId)?.last_name,
                      )}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {customers?.find((c) => c.id === customerId)?.phone}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="tap text-xs"
                    onClick={() => setCustomerId("")}
                  >
                    Cambiar
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 pt-1 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nombre *</Label>
                    <Input
                      className="tap h-9 text-sm"
                      placeholder="Nombre del cliente"
                      value={newCustomer.first_name}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, first_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Apellido</Label>
                    <Input
                      className="tap h-9 text-sm"
                      placeholder="Apellido (opcional)"
                      value={newCustomer.last_name}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, last_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Teléfono</Label>
                    <Input
                      className="tap h-9 text-sm"
                      placeholder="Teléfono / WhatsApp"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 2. SECCIÓN CONFIGURADOR DE ARTÍCULO RÁPIDO */}
          <section className="panel p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-display text-lg flex items-center gap-2">
                  <span>2. Catálogo & Configuración de Producto</span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Elige un producto o configúralo como personalizado con sus fotos de diseño.
                </p>
              </div>

              <Button
                type="button"
                variant={manualMode ? "secondary" : "outline"}
                size="sm"
                className="tap text-xs font-semibold"
                onClick={() => handleProductSelect(null)}
              >
                <Sparkles className="mr-1 h-3.5 w-3.5 text-amber-400" />
                Artículo manual / a medida
              </Button>
            </div>

            {/* Picker de Productos Universal con Temáticas */}
            {!manualMode && (
              <ProductPicker
                products={products}
                themes={themes}
                selectedId={draftItem.product_id}
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

            {/* CONFIGURADOR DEL ARTÍCULO DRAFT */}
            <div className="rounded-2xl border-2 border-primary/40 bg-card p-4 shadow-sm space-y-4">
              {draftItem.product_name || manualMode ? (
                <div className="space-y-4 animate-in fade-in-50 duration-200">
                  {/* Encabezado del artículo en configuración */}
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {draftItem.product_sku && (
                          <span className="font-mono text-xs font-bold text-primary">
                            {draftItem.product_sku}
                          </span>
                        )}
                        <span
                          className="chip text-[10px] py-0 px-2 font-bold"
                          style={{
                            color: `var(--${CATEGORY_META[draftItem.category]?.token ?? "primary"})`,
                            background: `color-mix(in oklab, var(--${CATEGORY_META[draftItem.category]?.token ?? "primary"}) 16%, transparent)`,
                          }}
                        >
                          {CATEGORY_META[draftItem.category]?.label ?? draftItem.category}
                        </span>
                        {draftItem.is_custom && (
                          <span className="chip text-[10px] py-0 px-2 bg-amber-500/15 text-amber-400 font-bold flex items-center gap-1">
                            <Sparkles className="h-2.5 w-2.5" /> Personalizado
                          </span>
                        )}
                      </div>
                      <p className="truncate text-base font-semibold text-foreground mt-0.5">
                        {draftItem.product_name || "Artículo personalizado"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setManualMode(false);
                        setDraftItem(
                          createEmptyDraft(
                            draftItem.category,
                            draftItem.cutter_modality || lastModality,
                            draftItem.cutter_size_cm || lastSize,
                          ),
                        );
                      }}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      Cambiar
                    </button>
                  </div>

                  {/* Campos específicos según categoría */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Modo Manual: campo de nombre si no tiene catálogo */}
                    {!draftItem.product_id && (
                      <>
                        <div className="space-y-1 sm:col-span-2">
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
                        <div className="space-y-1">
                          <Label className="text-xs">Categoría</Label>
                          <Select
                            value={draftItem.category}
                            onValueChange={(v) => {
                              const newCat = v as Category;
                              const isCutter = newCat === "CORTADORES";
                              const autoPrice = isCutter
                                ? priceFor(
                                    rules,
                                    draftItem.cutter_modality ?? lastModality,
                                    draftItem.cutter_size_cm ?? lastSize,
                                  )
                                : 0;
                              setDraftPriceInput(String(autoPrice));
                              setDraftItem((prev) => ({
                                ...prev,
                                category: newCat,
                                cutter_modality: isCutter
                                  ? prev.cutter_modality ?? lastModality
                                  : null,
                                cutter_size_cm: isCutter ? prev.cutter_size_cm ?? lastSize : null,
                                unit_price: autoPrice,
                                price_overridden: false,
                              }));
                            }}
                          >
                            <SelectTrigger className="tap h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIES.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {CATEGORY_META[c].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    {/* CORTADORES: Modalidad y Tamaño */}
                    {draftItem.category === "CORTADORES" && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs">Modalidad</Label>
                          <Select
                            value={draftItem.cutter_modality ?? "cutter_only"}
                            onValueChange={(v) => {
                              const newMod = v as Modality;
                              const autoPrice = priceFor(
                                rules,
                                newMod,
                                draftItem.cutter_size_cm ?? lastSize,
                              );
                              setDraftPriceInput(String(autoPrice));
                              setDraftItem((prev) => ({
                                ...prev,
                                cutter_modality: newMod,
                                unit_price: autoPrice,
                                price_overridden: false,
                              }));
                            }}
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
                            onValueChange={(v) => {
                              const newSize = Number(v);
                              const autoPrice = priceFor(
                                rules,
                                draftItem.cutter_modality ?? lastModality,
                                newSize,
                              );
                              setDraftPriceInput(String(autoPrice));
                              setDraftItem((prev) => ({
                                ...prev,
                                cutter_size_cm: newSize,
                                unit_price: autoPrice,
                                price_overridden: false,
                              }));
                            }}
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
                        <Label className="text-xs">Precio unitario ($)</Label>
                        <Input
                          className="tap h-9 text-sm"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={draftPriceInput}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setDraftPriceInput(raw);
                            const parsed = parseFloat(raw.replace(",", ".")) || 0;
                            setDraftItem((prev) => ({
                              ...prev,
                              price_overridden: true,
                              unit_price: parsed,
                            }));
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* SECCIÓN DE DISEÑO PERSONALIZADO E IMÁGENES */}
                  <CustomItemDesignSection
                    isCustom={draftItem.is_custom}
                    onIsCustomChange={(isCustom) =>
                      setDraftItem((prev) => ({ ...prev, is_custom: isCustom }))
                    }
                    images={draftItem.custom_images}
                    onImagesChange={(custom_images) =>
                      setDraftItem((prev) => ({ ...prev, custom_images }))
                    }
                    customNotes={draftItem.notes}
                    onCustomNotesChange={(notes) =>
                      setDraftItem((prev) => ({ ...prev, notes }))
                    }
                  />

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
              <div className="space-y-2.5">
                {items.map((it) => {
                  const price = computedPrice(it);
                  const itemSubtotal = price * it.quantity;
                  const prod = products.find((p) => p.id === it.product_id);

                  // Prioridad de miniatura: personalizada principal > personalizada secundaria > catálogo
                  const customPrimary =
                    it.custom_images.find((img) => img.is_primary) ?? it.custom_images[0];
                  const catalogImg =
                    (prod?.product_images ?? []).find((i: any) => i.is_primary) ??
                    prod?.product_images?.[0];

                  return (
                    <div
                      key={it.key}
                      className={cn(
                        "group flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 transition-all",
                        it.is_custom
                          ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/70 hover:bg-amber-500/10"
                          : "border-border bg-card hover:border-border/80 hover:bg-secondary/40",
                      )}
                    >
                      {/* Miniatura & Datos */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => setViewerItem(it)}
                          className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary hover:ring-2 hover:ring-primary transition-all"
                          title="Ver imagen / diseño ampliado"
                        >
                          {customPrimary?.previewUrl ? (
                            <img
                              src={customPrimary.previewUrl}
                              alt=""
                              className="h-full w-full object-contain p-0.5"
                            />
                          ) : customPrimary?.storage_path ? (
                            <StoredImage
                              image={customPrimary}
                              alt=""
                              className="h-full w-full object-contain p-0.5"
                            />
                          ) : catalogImg ? (
                            <StoredImage
                              image={catalogImg}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Package className="h-5 w-5 text-muted-foreground/50" />
                          )}

                          {it.custom_images.length > 0 && (
                            <span className="absolute bottom-0.5 right-0.5 rounded bg-black/80 px-1 text-[9px] font-bold text-white">
                              📷 {it.custom_images.length}
                            </span>
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {it.product_sku && (
                              <span className="font-mono text-xs font-bold text-primary">
                                {it.product_sku}
                              </span>
                            )}
                            <span
                              className="chip text-[10px] py-0 px-1.5"
                              style={{
                                color: `var(--${CATEGORY_META[it.category]?.token ?? "primary"})`,
                                background: `color-mix(in oklab, var(--${CATEGORY_META[it.category]?.token ?? "primary"}) 16%, transparent)`,
                              }}
                            >
                              {CATEGORY_META[it.category]?.label ?? it.category}
                            </span>

                            {it.is_custom && (
                              <span className="chip text-[10px] py-0 px-1.5 bg-amber-500/20 text-amber-400 font-bold flex items-center gap-1">
                                <Sparkles className="h-2.5 w-2.5" /> PERSONALIZADO
                              </span>
                            )}
                          </div>

                          <p className="truncate text-sm font-semibold text-foreground mt-0.5">
                            {it.product_name}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            {it.category === "CORTADORES" && it.cutter_size_cm && (
                              <span>
                                {it.cutter_size_cm} cm ·{" "}
                                {MODALITIES.find((m) => m.value === it.cutter_modality)?.label ?? ""}
                              </span>
                            )}
                            <span>
                              <strong className="text-foreground font-bold">{it.quantity}</strong> ×{" "}
                              {money(price)} ={" "}
                              <strong className="text-foreground font-bold">
                                {money(itemSubtotal)}
                              </strong>
                            </span>
                          </div>

                          {it.notes && (
                            <p className="mt-1 text-xs text-amber-400/90 italic line-clamp-1">
                              📝 {it.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Botones de acción rápida */}
                      <div className="flex items-center gap-1.5">
                        {/* Botón Ver diseño */}
                        {(it.custom_images.length > 0 || it.is_custom || catalogImg) && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="tap h-8 px-2.5 text-xs font-semibold"
                            onClick={() => setViewerItem(it)}
                          >
                            <Eye className="mr-1 h-3.5 w-3.5 text-primary" />
                            Ver diseño
                          </Button>
                        )}

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="tap h-8 w-8 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          onClick={() => duplicateItem(it.key)}
                          title="Duplicar artículo"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="tap h-8 w-8 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          onClick={() => startEditItem(it)}
                          title="Editar artículo"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="tap h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => removeItem(it.key)}
                          title="Eliminar artículo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 4. SECCIÓN ENTREGA */}
          <section className="panel p-4 sm:p-5 space-y-4">
            <h2 className="font-display text-lg">4. Entrega</h2>

            <div className="flex gap-2">
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
              />
            </div>
          </section>

          {/* Resumen y Guardar */}
          <section className="panel p-4 space-y-3">
            <h2 className="font-display text-lg">Resumen final</h2>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal artículos:</span>
                <span className="font-semibold">{money(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Envío:</span>
                <span className="font-semibold">{money(shippingCost)}</span>
              </div>
              {discountNum > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>Descuento:</span>
                  <span className="font-semibold">-{money(discountNum)}</span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between text-base font-bold">
                <span>Total:</span>
                <span className="font-display text-xl text-primary">{money(total)}</span>
              </div>
            </div>

            <Button
              className="tap w-full font-bold h-11 bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90"
              disabled={saving || items.length === 0}
              onClick={save}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando pedido…
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
                      onValueChange={(v) => {
                        const newMod = v as Modality;
                        const autoPrice = priceFor(rules, newMod, editingItem.cutter_size_cm);
                        setEditingPriceInput(String(autoPrice));
                        setEditingItem({
                          ...editingItem,
                          cutter_modality: newMod,
                          unit_price: autoPrice,
                          price_overridden: false,
                        });
                      }}
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
                      onValueChange={(v) => {
                        const newSize = Number(v);
                        const autoPrice = priceFor(rules, editingItem.cutter_modality, newSize);
                        setEditingPriceInput(String(autoPrice));
                        setEditingItem({
                          ...editingItem,
                          cutter_size_cm: newSize,
                          unit_price: autoPrice,
                          price_overridden: false,
                        });
                      }}
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
                  placeholder="0.00"
                  value={editingPriceInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setEditingPriceInput(raw);
                    const parsed = parseFloat(raw.replace(",", ".")) || 0;
                    setEditingItem({
                      ...editingItem,
                      price_overridden: true,
                      unit_price: parsed,
                    });
                  }}
                />
              </div>

              {/* Gestión de diseño personalizado dentro del modal de edición */}
              <CustomItemDesignSection
                isCustom={editingItem.is_custom}
                onIsCustomChange={(isCustom) =>
                  setEditingItem({ ...editingItem, is_custom: isCustom })
                }
                images={editingItem.custom_images}
                onImagesChange={(custom_images) =>
                  setEditingItem({ ...editingItem, custom_images })
                }
                customNotes={editingItem.notes}
                onCustomNotesChange={(notes) =>
                  setEditingItem({ ...editingItem, notes })
                }
              />

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

      {/* MODAL 1-TAP PARA VER DISEÑO / IMÁGENES */}
      <CustomDesignViewerModal
        open={!!viewerItem}
        onOpenChange={(open) => !open && setViewerItem(null)}
        title={viewerItem?.product_name ?? "Artículo"}
        productSku={viewerItem?.product_sku}
        isCustom={viewerItem?.is_custom}
        customNotes={viewerItem?.notes}
        customImages={viewerItem?.custom_images ?? []}
        catalogImages={
          viewerItem?.product_id
            ? products.find((p) => p.id === viewerItem.product_id)?.product_images ?? []
            : []
        }
      />

      {/* DIÁLOGO DE ÉXITO POSTERIOR AL GUARDADO CON ACCIÓN DE RESUMEN */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md text-center p-6 space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500 shadow-inner">
            <Check className="h-8 w-8 stroke-[3]" />
          </div>

          <div className="space-y-1">
            <DialogTitle className="font-display text-2xl font-bold text-foreground">
              ¡Pedido creado correctamente!
            </DialogTitle>
            <p className="text-base font-mono font-bold text-primary">
              {createdOrderSummary?.folio}
            </p>
            <p className="text-xs text-muted-foreground">
              {createdOrderSummary?.customer_name} · Total: {money(createdOrderSummary?.total ?? 0)}
            </p>
          </div>

          <div className="grid gap-2 pt-2">
            <Button
              className="tap font-bold h-11 bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90"
              onClick={() => setShowSummaryModal(true)}
            >
              <Download className="mr-2 h-4 w-4 stroke-[2.5]" /> Descargar resumen para clienta
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="tap font-semibold"
                onClick={() => {
                  if (createdOrderId) {
                    navigate({ to: "/pedidos/$orderId", params: { orderId: createdOrderId } });
                  }
                }}
              >
                <Eye className="mr-1.5 h-4 w-4" /> Ver pedido
              </Button>

              <Button
                variant="secondary"
                className="tap font-semibold"
                onClick={resetForm}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" /> Nuevo pedido
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL DE RESUMEN PARA CLIENTA */}
      <CustomerOrderSummaryModal
        open={showSummaryModal}
        onOpenChange={setShowSummaryModal}
        order={createdOrderSummary}
      />
    </>
  );
}
