import { useState, useMemo, useEffect, useRef } from "react";
import { Search, Tag, X, Check, Package, Sparkles, ChevronDown } from "lucide-react";
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
  themeFilter?: string;
  onThemeFilterChange?: (themeId: string) => void;
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
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
  themeFilter: controlledThemeFilter,
  onThemeFilterChange,
  searchQuery: controlledSearch,
  onSearchQueryChange,
  searchInputRef,
  className,
  allowManual = true,
}: ProductPickerProps) {
  // Search state (controlled or uncontrolled)
  const [internalSearch, setInternalSearch] = useState("");
  const isSearchControlled = controlledSearch !== undefined;
  const rawSearch = isSearchControlled ? controlledSearch : internalSearch;

  const [debouncedSearch, setDebouncedSearch] = useState(rawSearch);
  const [localCategory, setLocalCategory] = useState<Category | "TODAS">(categoryFilter);
  const [localThemeFilter, setLocalThemeFilter] = useState<string>("TODAS");

  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const [displayCount, setDisplayCount] = useState<number>(12);

  const localInputRef = useRef<HTMLInputElement>(null);
  const activeInputRef = searchInputRef || localInputRef;

  // Sync category filter
  useEffect(() => {
    setLocalCategory(categoryFilter);
  }, [categoryFilter]);

  // Sync theme filter
  const activeThemeFilter = controlledThemeFilter !== undefined ? controlledThemeFilter : localThemeFilter;
  const handleThemeChange = (t: string) => {
    if (onThemeFilterChange) onThemeFilterChange(t);
    else setLocalThemeFilter(t);
    setDisplayCount(12);
  };

  // Debounce search (180ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(rawSearch);
      setHighlightedIndex(0);
      setDisplayCount(12);
    }, 180);
    return () => clearTimeout(handler);
  }, [rawSearch]);

  const handleSearchChange = (val: string) => {
    if (onSearchQueryChange) onSearchQueryChange(val);
    else setInternalSearch(val);
  };

  const activeCategory = localCategory;
  const handleCategoryChange = (c: Category | "TODAS") => {
    setLocalCategory(c);
    onCategoryFilterChange?.(c);
    setDisplayCount(12);
  };

  const activeThemes = useMemo(() => themes.filter((t) => t.active), [themes]);

  // Algoritmo de filtrado y ordenamiento por relevancia
  const filteredAndSortedProducts = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();

    // 1. Filtrar por Categoría y Temática
    let list = products.filter((p) => {
      if (!p.active) return false;
      if (activeCategory !== "TODAS" && p.category !== activeCategory) return false;
      if (activeThemeFilter !== "TODAS") {
        const hasTheme = (p.product_theme_links ?? []).some(
          (tl: any) => tl.theme_id === activeThemeFilter,
        );
        if (!hasTheme) return false;
      }
      return true;
    });

    if (!term) return list;

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
    return matched.sort((a, b) => {
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
    });
  }, [products, debouncedSearch, activeCategory, activeThemeFilter]);

  const displayedProducts = useMemo(() => {
    return filteredAndSortedProducts.slice(0, displayCount);
  }, [filteredAndSortedProducts, displayCount]);

  const clearAllFilters = () => {
    handleSearchChange("");
    setDebouncedSearch("");
    handleCategoryChange("TODAS");
    handleThemeChange("TODAS");
  };

  const hasActiveFilters =
    debouncedSearch.trim().length > 0 ||
    activeCategory !== "TODAS" ||
    activeThemeFilter !== "TODAS";

  const selectedThemeName = useMemo(() => {
    if (activeThemeFilter === "TODAS") return null;
    return themes.find((t) => t.id === activeThemeFilter)?.name ?? null;
  }, [themes, activeThemeFilter]);

  // Teclado: Flechas arriba/abajo y Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (displayedProducts.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, displayedProducts.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const productToSelect = displayedProducts[highlightedIndex];
      if (productToSelect) {
        onSelect(productToSelect);
      }
    }
  };

  return (
    <div className={cn("space-y-3.5", className)}>
      {/* 1. Barra de Búsqueda Grande Mobile-First */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={activeInputRef as any}
          className="tap h-12 rounded-xl pl-11 pr-11 text-base font-medium placeholder:text-muted-foreground/70 bg-card border-border shadow-sm focus-visible:ring-2 focus-visible:ring-primary"
          placeholder="Buscar por SKU o nombre (ej. COR-0055, Reno)..."
          value={rawSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {rawSearch && (
          <button
            type="button"
            onClick={() => {
              handleSearchChange("");
              activeInputRef.current?.focus();
            }}
            className="tap absolute right-2.5 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
            aria-label="Limpiar búsqueda"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* 2. Filtros de Categoría y Temática Adaptativos */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* Categorías deslizables horizontalmente */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
          {(["TODAS", ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleCategoryChange(c)}
              className={cn(
                "tap shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold border transition-all",
                activeCategory === c
                  ? "bg-primary text-primary-foreground font-bold border-primary shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {c === "TODAS" ? "Todos" : CATEGORY_META[c].label}
            </button>
          ))}
        </div>

        {/* Temática Dropdown */}
        <div className="shrink-0">
          <Select value={activeThemeFilter} onValueChange={handleThemeChange}>
            <SelectTrigger className="tap h-10 w-full sm:w-48 rounded-xl text-sm bg-card border-border">
              <Tag className="mr-2 h-4 w-4 text-primary shrink-0" />
              <SelectValue placeholder="Temática: Todas" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="TODAS">Todas las temáticas</SelectItem>
              {activeThemes.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 3. Chips de filtros activos y Contador */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground pt-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {activeCategory !== "TODAS" && (
            <span className="chip flex items-center gap-1.5 bg-secondary text-foreground text-xs py-1 px-2.5 rounded-lg border border-border">
              <span>{CATEGORY_META[activeCategory].label}</span>
              <button
                type="button"
                onClick={() => handleCategoryChange("TODAS")}
                className="tap hover:text-destructive text-muted-foreground"
                aria-label="Quitar filtro de categoría"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
          {selectedThemeName && (
            <span className="chip flex items-center gap-1.5 bg-secondary text-foreground text-xs py-1 px-2.5 rounded-lg border border-border">
              <span>{selectedThemeName}</span>
              <button
                type="button"
                onClick={() => handleThemeChange("TODAS")}
                className="tap hover:text-destructive text-muted-foreground"
                aria-label="Quitar filtro de temática"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
          {debouncedSearch.trim() && (
            <span className="chip flex items-center gap-1.5 bg-secondary text-foreground text-xs py-1 px-2.5 rounded-lg border border-border">
              <span>"{debouncedSearch.trim()}"</span>
              <button
                type="button"
                onClick={() => handleSearchChange("")}
                className="tap hover:text-destructive text-muted-foreground"
                aria-label="Quitar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs font-semibold text-foreground">
            {filteredAndSortedProducts.length} producto{filteredAndSortedProducts.length === 1 ? "" : "s"}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="tap text-xs text-destructive font-semibold hover:underline"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* 4. Lista Visual de Resultados (Tarjetas Táctiles Grandes) */}
      <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
        {allowManual && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={cn(
              "tap flex w-full items-center gap-3.5 rounded-2xl border p-3.5 text-left transition-all min-h-[68px]",
              !selectedProductId
                ? "border-primary bg-primary/10 text-foreground font-semibold ring-1 ring-primary"
                : "border-border/80 bg-card text-muted-foreground hover:bg-secondary/70",
            )}
          >
            <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 font-bold border border-amber-500/30">
              <Sparkles className="h-6 w-6" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-base text-foreground">Artículo personalizado / a medida</p>
              <p className="text-xs text-muted-foreground mt-0.5">Captura libre con imagen de clienta y medidas</p>
            </div>
            {!selectedProductId && <Check className="h-5 w-5 text-primary shrink-0" />}
          </button>
        )}

        {displayedProducts.map((p, idx) => {
          const isSelected = selectedProductId === p.id;
          const isHighlighted = highlightedIndex === idx;
          const img = (p.product_images ?? []).find((i: any) => i.is_primary) ?? p.product_images?.[0];
          const prodThemes = (p.product_theme_links ?? [])
            .map((tl: any) => tl.product_themes?.name)
            .filter(Boolean);

          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p)}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={cn(
                "tap flex w-full items-center gap-3.5 rounded-2xl border p-3 text-left transition-all min-h-[72px]",
                isSelected
                  ? "border-primary bg-primary/15 text-foreground shadow-md ring-2 ring-primary"
                  : isHighlighted
                    ? "border-primary/60 bg-secondary text-foreground"
                    : "border-border bg-card hover:bg-secondary/70 hover:border-border",
              )}
            >
              {/* Miniatura 52x52 */}
              <span className="relative flex h-13 w-13 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary">
                {img ? (
                  <StoredImage image={img} alt={p.name} className="h-full w-full object-contain p-0.5" />
                ) : (
                  <Package className="h-6 w-6 text-muted-foreground opacity-40" />
                )}
              </span>

              {/* Info Principal */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-bold text-primary">{p.sku}</span>
                  <span
                    className="chip text-[11px] py-0 px-2 font-semibold"
                    style={{
                      color: `var(--${CATEGORY_META[p.category as keyof typeof CATEGORY_META]?.token ?? "primary"})`,
                      background: `color-mix(in oklab, var(--${CATEGORY_META[p.category as keyof typeof CATEGORY_META]?.token ?? "primary"}) 16%, transparent)`,
                    }}
                  >
                    {CATEGORY_META[p.category as keyof typeof CATEGORY_META]?.label ?? p.category}
                  </span>
                </div>
                <p className="truncate font-semibold text-base text-foreground mt-0.5 leading-snug">
                  {p.name}
                </p>
                {prodThemes.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {prodThemes.slice(0, 2).map((tName: string) => (
                      <span key={tName} className="chip bg-secondary text-[10px] py-0 px-1.5 text-muted-foreground">
                        {tName}
                      </span>
                    ))}
                    {prodThemes.length > 2 && (
                      <span className="text-[10px] text-muted-foreground font-medium">+{prodThemes.length - 2}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Precio y estado */}
              <div className="shrink-0 text-right">
                <p className="font-bold text-sm text-foreground">
                  {p.category === "CORTADORES" ? "Según tamaño" : money(p.base_price)}
                </p>
                {isSelected && (
                  <span className="mt-1 flex items-center justify-end gap-1 text-xs text-primary font-bold">
                    <Check className="h-4 w-4 stroke-[3]" /> Elegido
                  </span>
                )}
              </div>
            </button>
          );
        })}

        {filteredAndSortedProducts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            <Package className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="font-semibold text-foreground">No se encontraron productos</p>
            <p className="text-xs text-muted-foreground mt-1">Prueba con otra palabra clave o añade un artículo a medida.</p>
          </div>
        )}

        {/* Botón Cargar Más */}
        {filteredAndSortedProducts.length > displayedProducts.length && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="tap w-full h-11 text-sm font-semibold rounded-xl mt-2 border-border"
            onClick={() => setDisplayCount((prev) => prev + 15)}
          >
            <ChevronDown className="mr-1.5 h-4 w-4 text-primary" />
            Mostrar más productos ({filteredAndSortedProducts.length - displayedProducts.length} restantes)
          </Button>
        )}
      </div>
    </div>
  );
}
