import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ShoppingBag, ClipboardList, LogOut } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { useMyCustomer } from "@/lib/shop-queries";
import { fullName } from "@/lib/cm";

export function ShopShell({ children }: { children: ReactNode }) {
  const { count } = useCart();
  const { data: customer, isLoading } = useMyCustomer();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/tienda/acceso" });
  };

  return (
    <div className="theme-shop min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-sidebar">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link to="/tienda" className="flex items-center gap-2">
            <BrandLogo size="sm" showName />
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <Button asChild variant="ghost" size="sm" className="tap">
              <Link to="/tienda/pedidos">
                <ClipboardList className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Mis pedidos</span>
              </Link>
            </Button>
            <Button asChild size="sm" className="tap relative font-semibold">
              <Link to="/tienda/carrito">
                <ShoppingBag className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Carrito</span>
                {count > 0 && (
                  <span className="ml-1 rounded-full bg-primary-foreground px-1.5 text-[11px] font-bold text-primary">
                    {count}
                  </span>
                )}
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="tap" onClick={signOut} aria-label="Salir">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-5">
        {!isLoading && !customer ? (
          <div className="panel p-6 text-center text-sm text-muted-foreground">
            Esta cuenta no está registrada como clienta.{" "}
            <Link to="/tienda/acceso" className="text-primary underline">
              Crear cuenta de clienta
            </Link>
          </div>
        ) : (
          <>
            {customer && (
              <p className="mb-4 text-sm text-muted-foreground">
                Hola, <span className="text-foreground">{fullName(customer.first_name, customer.last_name)}</span>
              </p>
            )}
            {children}
          </>
        )}
      </main>
    </div>
  );
}
