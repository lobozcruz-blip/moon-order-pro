import { useState, useMemo, useEffect } from "react";
import { Search, Tag, X, Check, Package, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StoredImage } from "@/components/StoredImage";
import { CATEGORIES, CATEGORY_META, money, type Category } from "@/lib/cm";
import { cn } from "@/lib/utils";
import type { ProductTheme } from "@/lib/queries";

export type ProductPickerProps = {
  products: any[];
  themes?: ProductTheme[];
  selectedProductId: string | null;
  onSelect: (product: any | null) => void;
  categoryFilter?: Category | "TODAS";
  onCategoryFilterChange?: (cat: Category | "TODAS") => void;
  className?: string;
  allowManual?: boolean;
};

export function ProductPicker({
  products = [],
  themes = [],
  selectedProductId,
  onSelect,
  categoryFilter = "TODAS",
  onCategoryFilterChange,
  className,
  allowManual = true,
}: ProductPickerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [localCategory, setLocalCategory] = useState<Category | "TODAS">(categoryFilter);
  const [themeFilter, setThemeFilter] = useState<string>("TODAS");

  // Sync category filter if controlled from outside
  useEffect(() => {
    setLocalCategory(categoryFilter);
  }, [categoryFilter]);

  // Debounce search (200ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 200);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const activeCategory = localCategory;
  const handleCategoryChange = (c: Category | "TODAS") => {
    setLocalCategory(c);
    onCategoryFilterChange?.(c);
  };

  const activeThemes = useMemo(() => themes.filter((t) => t.active), [themes]);

  // Algoritmo de filtrado y ordenamiento por relevancia
  const filteredAndSortedProducts = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();

    // 1. Filtrar por Categoría y Temática
    let list = products.filter((p) => {
      if (!p.active) return false;
      if (activeCategory !== "TODAS" && p.category !== activeCategory) return false;
      if (themeFilter !== "TODAS") {
        const hasTheme = (p.product_theme_links ?? []).some(
          (tl: any) => tl.theme_id === themeFilter,
        );
        if (!hasTheme) return false;
      }
      return true;
    });

    if (!term) return list.slice(0, 60);

    // 2. Coincidencia parcial tipo "contiene"
    const matched = list.filter((p) => {
      const sku = (p.sku ?? "").toLowerCase();
      const name = (p.name ?? "").toLowerCase();
      const desc = (p.description ?? "").toLowerCase();
      const hasThemeMatch = (p.product_theme_links ?? []).some((tl: any) =>
        (tl.product_themes?.name ?? "").toLowerCase().includes(term),
      );
      return (
        sku.includes(term) ||
        name.includes(term) ||
        desc.includes(term) ||
        hasThemeMatch
      );
    });

    // 3. Ordenamiento por prioridad de relevancia
    return matched
      .sort((a, b) => {
        const aSku = (a.sku ?? "").toLowerCase();
        const bSku = (b.sku ?? "").toLowerCase();
        const aName = (a.name ?? "").toLowerCase();
        const bName = (b.name ?? "").toLowerCase();

        // 1. Coincidencia exacta de SKU
        if (aSku === term && bSku !== term) return -1;
        if (bSku === term && aSku !== term) return 1;

        // 2. SKU que empiece con el término
        if (aSku.startsWith(term) && !bSku.startsWith(term)) return -1;
        if (bSku.startsWith(term) && !aSku.startsWith(term)) return 1;

        // 3. SKU que contenga el término
        if (aSku.includes(term) && !bSku.includes(term)) return -1;
        if (bSku.includes(term) && !aSku.includes(term)) return 1;

        // 4. Nombre que empiece con el término
        if (aName.startsWith(term) && !bName.startsWith(term)) return -1;
        if (bName.startsWith(term) && !aName.startsWith(term)) return 1;

        // 5. Nombre que contenga el término
        if (aName.includes(term) && !bName.includes(term)) return -1;
        if (bName.includes(term) && !aName.includes(term)) return 1;

        return aName.localeCompare(bName);
      })
      .slice(0, 60);
  }, [products, debouncedSearch, activeCategory, themeFilter]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const clearAllFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    handleCategoryChange("TODAS");
    setThemeFilter("TODAS");
  };

  const hasActiveFilters =
    debouncedSearch.trim().length > 0 ||
    activeCategory !== "TODAS" ||
    themeFilter !== "TODAS";

  const selectedThemeName = useMemo(() => {
    if (themeFilter === "TODAS") return null;
    return themes.find((t) => t.id === themeFilter)?.name ?? null;
  }, [themes, themeFilter]);

  return (
    <div className={cn("space-y-3 rounded-xl border border-border bg-card/60 p-3.5", className)}>
      {/* 1. Barra de Búsqueda Universal */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="tap pl-9 pr-9"
          placeholder="Buscar producto por SKU o nombre (ej. COR-0105, Corazón, Mamá)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 2. Filtros de Categoría y Temática */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Categorías */}
        <div className="flex flex-wrap gap-1">
          {(["TODAS", ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleCategoryChange(c)}
              className={cn(
                "chip border text-xs transition-colors",
                activeCategory === c
                  ? "bg-primary text-primary-foreground font-bold border-primary shadow-sm"
                  : "border-border text-muted-foreground hover:bg-secondary",
              )}
            >
              {c === "TODAS" ? "Todas" : CATEGORY_META[c].label}
            </button>
          ))}
        </div>

        {/* Temática Dropdown */}
        <Select value={themeFilter} onValueChange={setThemeFilter}>
          <SelectTrigger className="tap h-8 w-44 text-xs ml-auto sm:ml-0">
            <Tag className="mr-1.5 h-3.5 w-3.5 text-primary" />
            <SelectValue placeholder="Temática: Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS">Todas las temáticas</SelectItem>
            {activeThemes.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 3. Chips de filtros activos y Contador */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground border-t border-border/40 pt-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span>Filtros activos:</span>
          {activeCategory !== "TODAS" && (
            <span className="chip flex items-center gap-1 bg-secondary text-foreground text-[11px]">
              {CATEGORY_META[activeCategory].label}
              <button
                type="button"
                onClick={() => handleCategoryChange("TODAS")}
                className="hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {selectedThemeName && (
            <span className="chip flex items-center gap-1 bg-secondary text-foreground text-[11px]">
              {selectedThemeName}
              <button
                type="button"
                onClick={() => setThemeFilter("TODAS")}
                className="hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {debouncedSearch.trim() && (
            <span className="chip flex items-center gap-1 bg-secondary text-foreground text-[11px]">
              "{debouncedSearch.trim()}"
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {!hasActiveFilters && <span className="text-[11px] italic">Ninguno</span>}
        </div>

        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">
            {filteredAndSortedProducts.length} producto(s)
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-[11px] text-destructive underline hover:text-destructive/80"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* 4. Lista Visual de Resultados */}
      <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
        {allowManual && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left text-xs transition-all",
              !selectedProductId
                ? "border-primary bg-primary/10 text-foreground font-semibold"
                : "border-border/60 bg-secondary/40 text-muted-foreground hover:bg-secondary",
            )}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Package className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Artículo manual / personalizado</p>
              <p className="text-[11px] text-muted-foreground">Escribir nombre y precio libremente sin catálogo</p>
            </div>
            {!selectedProductId && <Check className="h-4 w-4 text-primary" />}
          </button>
        )}

        {filteredAndSortedProducts.map((p) => {
          const isSelected = selectedProductId === p.id;
          const img = (p.product_images ?? []).find((i: any) => i.is_primary) ?? p.product_images?.[0];
          const prodThemes = (p.product_theme_links ?? [])
            .map((tl: any) => tl.product_themes?.name)
            .filter(Boolean);

          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border p-2 text-left text-xs transition-all",
                isSelected
                  ? "border-primary bg-primary/15 text-foreground shadow-sm ring-1 ring-primary"
                  : "border-border/60 bg-card hover:bg-secondary/70",
              )}
            >
              {/* Miniatura */}
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary">
                {img ? (
                  <StoredImage image={img} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-5 w-5 text-muted-foreground opacity-40" />
                )}
              </span>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] font-bold text-primary">{p.sku}</span>
                  <span
                    className="chip text-[10px] py-0 px-1.5"
                    style={{
                      color: `var(--${CATEGORY_META[p.category].token})`,
                      background: `color-mix(in oklab, var(--${CATEGORY_META[p.category].token}) 16%, transparent)`,
                    }}
                  >
                    {CATEGORY_META[p.category].label}
                  </span>
                </div>
                <p className="truncate font-semibold text-foreground">{p.name}</p>
                {prodThemes.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {prodThemes.slice(0, 3).map((tName: string) => (
                      <span key={tName} className="chip bg-secondary text-[9px] py-0 text-muted-foreground">
                        {tName}
                      </span>
                    ))}
                    {prodThemes.length > 3 && (
                      <span className="text-[9px] text-muted-foreground">+{prodThemes.length - 3}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Precio */}
              <div className="shrink-0 text-right">
                <p className="font-medium text-foreground">
                  {p.category === "CORTADORES" ? "Precio según tamaño" : money(p.base_price)}
                </p>
                {isSelected && (
                  <span className="flex items-center justify-end gap-1 text-[10px] text-primary font-bold">
                    <Check className="h-3.5 w-3.5" /> Seleccionado
                  </span>
                )}
              </div>
            </button>
          );
        })}

        {filteredAndSortedProducts.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No se encontraron productos con los filtros aplicados.
          </p>
        )}
      </div>
    </div>
  );
}
