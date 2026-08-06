import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Users,
  Upload,
  Settings,
  Plus,
  LogOut,
  Cookie,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/panel", label: "Panel", icon: LayoutDashboard },
  { to: "/pedidos", label: "Pedidos", icon: ClipboardList },
  { to: "/productos", label: "Productos", icon: Package },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/importaciones", label: "Importar", icon: Upload },
  { to: "/configuracion", label: "Config.", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, role, isAdmin } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar (escritorio) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex">
        <Link to="/panel" className="mb-6 flex items-center gap-2 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Cookie className="h-5 w-5" />
          </span>
          <span className="font-display text-lg leading-tight">
            Cookies <span className="text-primary">Moon</span>
          </span>
        </Link>

        <Button asChild className="tap mb-4 w-full font-semibold">
          <Link to="/nuevo-pedido">
            <Plus className="mr-1 h-4 w-4" /> Nuevo pedido
          </Link>
        </Button>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "tap flex items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                pathname.startsWith(to) && "bg-sidebar-accent text-foreground",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {label === "Importar" ? "Importaciones" : label === "Config." ? "Configuración" : label}
            </Link>
          ))}
        </nav>

        <div className="mt-4 rounded-lg bg-sidebar-accent p-3 text-xs">
          <p className="truncate font-medium">{user?.email}</p>
          <p className="text-muted-foreground">{isAdmin ? "Administrador" : role ? "Colaborador" : "…"}</p>
          <Button variant="ghost" size="sm" className="mt-2 w-full justify-start px-0" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Barra superior (móvil) */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border bg-sidebar px-4 py-3 lg:hidden">
        <Link to="/panel" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Cookie className="h-4 w-4" />
          </span>
          <span className="font-display text-base">
            Cookies <span className="text-primary">Moon</span>
          </span>
        </Link>
        <Button variant="ghost" size="icon" className="tap" onClick={signOut} aria-label="Cerrar sesión">
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      <main className="px-4 pb-32 pt-4 lg:ml-60 lg:px-8 lg:pb-12">{children}</main>

      {/* Botón flotante Nuevo pedido (móvil) */}
      <Link
        to="/nuevo-pedido"
        className="fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-5 py-4 font-semibold text-primary-foreground shadow-[var(--shadow-glow)] lg:hidden"
      >
        <Plus className="h-5 w-5" /> Nuevo pedido
      </Link>

      {/* Navegación inferior (móvil / tablet) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-border bg-sidebar pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground",
              pathname.startsWith(to) && "text-primary",
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
