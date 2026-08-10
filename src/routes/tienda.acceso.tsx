import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizePhone, clientEmail } from "@/lib/phone";
import { registerClient } from "@/lib/shop.functions";
import { BrandLogo } from "@/components/BrandLogo";
import { useBrandName } from "@/lib/brand";

export const Route = createFileRoute("/tienda/acceso")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Acceso a la tienda — Cookies Moon" },
      {
        name: "description",
        content: "Regístrate con tu nombre y celular para hacer tu pedido en Cookies Moon.",
      },
      { property: "og:title", content: "Acceso a la tienda — Cookies Moon" },
      {
        property: "og:description",
        content: "Regístrate con tu nombre y celular para hacer tu pedido en Cookies Moon.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccesoTienda,
});

function AccesoTienda() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "registro">("registro");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const brandName = useBrandName();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/tienda", replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizePhone(phone);
    if (!normalized) {
      toast.error("Escribe tu celular a 10 dígitos.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "registro") {
        await registerClient({ data: { firstName, lastName, phone, password } });
        toast.success("Cuenta creada. Entrando…");
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: clientEmail(normalized),
        password,
      });
      if (error) throw new Error("Celular o contraseña incorrectos.");
      navigate({ to: "/tienda", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo continuar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="theme-shop flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo size="lg" />
          <h1 className="mt-4 font-display text-3xl">
            {brandName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "registro"
              ? "Regístrate con tu nombre y celular para hacer tu pedido"
              : "Entra con tu celular y contraseña"}
          </p>
        </div>

        <form onSubmit={submit} className="panel space-y-4 p-6">
          {mode === "registro" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  className="tap"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apellido">Apellido</Label>
                <Input
                  id="apellido"
                  className="tap"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="celular">Celular (10 dígitos)</Label>
            <Input
              id="celular"
              className="tap"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="55 1234 5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pass">Contraseña</Label>
            <Input
              id="pass"
              className="tap"
              type="password"
              autoComplete={mode === "registro" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="tap w-full font-semibold" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "registro" ? "Crear cuenta y entrar" : "Entrar"}
          </Button>
          <button
            type="button"
            className="w-full text-center text-xs text-muted-foreground underline"
            onClick={() => setMode(mode === "registro" ? "login" : "registro")}
          >
            {mode === "registro" ? "Ya tengo cuenta" : "Soy nueva, quiero registrarme"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          ¿Eres del equipo?{" "}
          <Link to="/auth" className="underline">
            Acceso del personal
          </Link>
        </p>
      </div>
    </div>
  );
}
