import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { ShopShell } from "@/components/shop/ShopShell";
import { StoredImage } from "@/components/StoredImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { requireClientSession } from "@/lib/client-gate";
import { useShopCatalog } from "@/lib/shop-queries";
import { usePriceRules, priceFor } from "@/lib/queries";
import { cart } from "@/lib/cart";
import { CATEGORIES, CATEGORY_META, MODALITIES, SIZES, money, type Category, type Modality } from "@/lib/cm";

export const Route = createFileRoute("/tienda/")({
  ssr: false,
  beforeLoad: requireClientSession,
  head: () => ({
    meta: [
      { title: "Catálogo — Cookies Moon" },
      {
        name: "description",
        content: "Explora cortadores, stencils y cajas de Cookies Moon y arma tu pedido.",
      },
      { property: "og:title", content: "Catálogo — Cookies Moon" },
      {
        property: "og:description",
        content: "Explora cortadores, stencils y cajas de Cookies Moon y arma tu pedido.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Catalogo,
});

type Producto = NonNullable<ReturnType<typeof useShopCatalog>["data"]>[number];

function Catalogo() {
  const { data: products, isLoading } = useShopCatalog();
  const { data: rules } = usePriceRules();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "todas">("todas");

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (products ?? []).filter(
      (p) =>
        (cat === "todas" || p.category === cat) &&
        (!t || p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t)),
    );
  }, [products, q, cat]);

  return (
    <ShopShell>
      <h1 className="font-display text-2xl lg:text-3xl">Catálogo</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Agrega lo que necesites al carrito y al final te damos tu número de pedido.
      </p>

      <div className="my-4 grid gap-2 sm:grid-cols-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="tap pl-9"
            placeholder="Buscar producto"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={cat} onValueChange={(v) => setCat(v as Category | "todas")}>
          <SelectTrigger className="tap">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las categorías</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_META[c].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((p) => (
          <ProductCard key={p.id} product={p} rules={rules} />
        ))}
      </div>

      {isLoading && <p className="py-12 text-center text-sm text-muted-foreground">Cargando…</p>}
      {!isLoading && rows.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">Sin productos.</p>
      )}
    </ShopShell>
  );
}

function ProductCard({
  product,
  rules,
}: {
  product: Producto;
  rules: { modality: string; size_cm: number; price: number }[] | undefined;
}) {
  const isCutter = product.category === "CORTADORES";
  const [modality, setModality] = useState<Modality>("cutter_only");
  const [size, setSize] = useState<number>(8);
  const [qty, setQty] = useState(1);

  const unit = isCutter ? priceFor(rules, modality, size) : Number(product.base_price ?? 0);
  const images = [...(product.product_images ?? [])].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
  );
  const img = images[0];

  const add = () => {
    cart.add({
      product_id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      modality: isCutter ? modality : null,
      size_cm: isCutter ? size : null,
      quantity: qty,
      unit_price: unit,
      storage_path: img?.storage_path ?? null,
      external_url: img?.external_url ?? null,
    });
    toast.success(`${product.name} agregado al carrito`);
  };

  return (
    <article className="panel overflow-hidden">
      <StoredImage image={img} className="h-40 w-full" alt={product.name} />
      <div className="space-y-2 p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold">{product.name}</h2>
            <p className="font-mono text-[11px] text-muted-foreground">{product.sku}</p>
          </div>
          <span
            className="chip"
            style={{ color: `var(--${CATEGORY_META[product.category].token})` }}
          >
            {CATEGORY_META[product.category].label}
          </span>
        </div>

        {isCutter && (
          <div className="grid grid-cols-2 gap-2">
            <Select value={modality} onValueChange={(v) => setModality(v as Modality)}>
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
            <Select value={String(size)} onValueChange={(v) => setSize(Number(v))}>
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
        )}

        <div className="flex items-center gap-2">
          <span className="flex-1 text-base font-semibold">
            {unit > 0 ? money(unit) : "A cotizar"}
          </span>
          <Input
            type="number"
            min={1}
            max={999}
            className="tap h-9 w-16 text-center"
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            aria-label="Cantidad"
          />
          <Button size="sm" className="tap font-semibold" onClick={add}>
            <Plus className="h-4 w-4" />
            <ShoppingBag className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}
