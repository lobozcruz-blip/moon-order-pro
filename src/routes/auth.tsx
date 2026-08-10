import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";
import { useBrandName } from "@/lib/brand";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { needsBootstrap, createFirstAdmin } from "@/lib/users.functions";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s['next'] === "string" && s['next'].startsWith("/") ? { next: s['next'] } : {},

  head: () => ({
    meta: [
      { title: "Acceso — Cookies Moon" },
      { name: "description", content: "Acceso privado al sistema de pedidos de Cookies Moon." },
      { property: "og:title", content: "Acceso — Cookies Moon" },
      {
        property: "og:description",
        content: "Acceso privado al sistema de pedidos de Cookies Moon.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const brandName = useBrandName();
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootstrap, setBootstrap] = useState(false);

  const goNext = () => {
    if (next) window.location.href = next;
    else navigate({ to: "/panel", replace: true });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        if (next) window.location.href = next;
        else navigate({ to: "/panel", replace: true });
      }
    });
    needsBootstrap()
      .then((r) => setBootstrap(r.needsBootstrap))
      .catch(() => setBootstrap(false));
  }, [navigate, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (bootstrap) {
        await createFirstAdmin({ data: { email, password, fullName } });
        toast.success("Administrador creado. Iniciando sesión…");
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      goNext();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo size="lg" />
          <h1 className="mt-4 font-display text-3xl">
            {brandName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {bootstrap
              ? "Crea la cuenta del primer administrador"
              : "Sistema privado de pedidos y producción"}
          </p>
        </div>

        <form onSubmit={submit} className="panel space-y-4 p-6">
          {bootstrap && (
            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo</Label>
              <Input
                id="name"
                className="tap"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              className="tap"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              className="tap"
              autoComplete={bootstrap ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="tap w-full font-semibold" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {bootstrap ? "Crear administrador y entrar" : "Entrar"}
          </Button>
          {!bootstrap && (
            <p className="text-center text-xs text-muted-foreground">
              El acceso es sólo para personal autorizado. Pide a un administrador que cree tu
              cuenta.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
