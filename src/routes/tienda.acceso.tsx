import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft, ShieldCheck, KeyRound, UserCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizePhone, clientEmail, prettyPhone } from "@/lib/phone";
import {
  checkPhoneStatus,
  sendClientVerificationCode,
  claimClientAccount,
  registerClient,
  resetClientPassword,
} from "@/lib/shop.functions";
import { BrandLogo } from "@/components/BrandLogo";
import { useBrandName } from "@/lib/brand";

export const Route = createFileRoute("/tienda/acceso")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Acceso a la tienda — Cookies Moon" },
      {
        name: "description",
        content: "Ingresa con tu celular para consultar tus pedidos y comprar en Cookies Moon.",
      },
      { property: "og:title", content: "Acceso a la tienda — Cookies Moon" },
      {
        property: "og:description",
        content: "Ingresa con tu celular para consultar tus pedidos y comprar en Cookies Moon.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccesoTienda,
});

type Step = "phone" | "login" | "new_client" | "claim_account" | "recover_password";

function AccesoTienda() {
  const navigate = useNavigate();
  const brandName = useBrandName();

  // Estados del flujo
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(false);

  // Campos de formulario
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/tienda", replace: true });
    });
  }, [navigate]);

  // Paso 1: Comprobar teléfono
  const handleCheckPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizePhone(phone);
    if (!normalized) {
      toast.error("Escribe tu celular a 10 dígitos (ej. 55 1234 5678).");
      return;
    }

    setLoading(true);
    try {
      const res = await checkPhoneStatus({ data: { phone } });
      if (res.status === "registered") {
        setCustomerName(res.customerName ?? "");
        setStep("login");
      } else if (res.status === "unclaimed") {
        setCustomerName(res.customerName ?? "");
        setStep("claim_account");
        // Enviar código automáticamente al detectar cliente existente
        await handleSendCode(normalized);
      } else {
        setStep("new_client");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al verificar el número");
    } finally {
      setLoading(false);
    }
  };

  // Enviar código OTP
  const handleSendCode = async (normalizedPhone?: string) => {
    const target = normalizedPhone || normalizePhone(phone);
    if (!target) return;
    setSendingCode(true);
    try {
      const res = await sendClientVerificationCode({ data: { phone: target } });
      setCodeSent(true);
      toast.success(`Código de verificación enviado (${res.code})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar el código");
    } finally {
      setSendingCode(false);
    }
  };

  // Login de cliente existente con contraseña
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizePhone(phone);
    if (!normalized) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: clientEmail(normalized),
        password,
      });
      if (error) throw new Error("Contraseña incorrecta. Puedes recuperarla si la olvidaste.");
      toast.success("¡Bienvenida/o!");
      navigate({ to: "/tienda", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  // Registro de cliente nuevo
  const handleRegisterNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizePhone(phone);
    if (!normalized) return;
    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      await registerClient({
        data: { firstName, lastName, phone, password },
      });
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email: clientEmail(normalized),
        password,
      });
      if (loginErr) throw loginErr;
      toast.success("¡Cuenta creada con éxito!");
      navigate({ to: "/tienda", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo registrar");
    } finally {
      setLoading(false);
    }
  };

  // Reclamo de cuenta de cliente existente
  const handleClaimAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizePhone(phone);
    if (!normalized) return;
    if (!verificationCode.trim()) {
      toast.error("Ingresa el código de verificación de 6 dígitos.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      await claimClientAccount({
        data: { phone, code: verificationCode, password },
      });
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email: clientEmail(normalized),
        password,
      });
      if (loginErr) throw loginErr;
      toast.success("¡Cuenta activada! Todos tus pedidos anteriores están listos.");
      navigate({ to: "/tienda", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo activar la cuenta");
    } finally {
      setLoading(false);
    }
  };

  // Recuperación de contraseña
  const handleRecoverPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizePhone(phone);
    if (!normalized) return;
    if (!verificationCode.trim()) {
      toast.error("Ingresa el código de 6 dígitos.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      await resetClientPassword({
        data: { phone, code: verificationCode, newPassword: password },
      });
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email: clientEmail(normalized),
        password,
      });
      if (loginErr) throw loginErr;
      toast.success("Contraseña actualizada con éxito.");
      navigate({ to: "/tienda", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar contraseña");
    } finally {
      setLoading(false);
    }
  };

  const resetToPhone = () => {
    setStep("phone");
    setPassword("");
    setConfirmPassword("");
    setVerificationCode("");
    setCodeSent(false);
  };

  return (
    <div className="theme-shop flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Cabecera */}
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandLogo size="lg" />
          <h1 className="mt-4 font-display text-3xl">{brandName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {step === "phone" && "Ingresa tu número de celular para comenzar"}
            {step === "login" && "Bienvenida de vuelta"}
            {step === "new_client" && "Crea tu cuenta de clienta"}
            {step === "claim_account" && "Activa tu cuenta existente"}
            {step === "recover_password" && "Recuperar contraseña"}
          </p>
        </div>

        {/* PASO 1: Ingreso de Celular */}
        {step === "phone" && (
          <form onSubmit={handleCheckPhone} className="panel space-y-4 p-6 shadow-sm">
            <div className="space-y-2">
              <Label htmlFor="celular">Número de celular (10 dígitos)</Label>
              <Input
                id="celular"
                className="tap text-center text-lg font-medium tracking-wider"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="55 1234 5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Si ya hiciste pedidos antes, podrás ver todo tu historial de compras.
              </p>
            </div>
            <Button type="submit" className="tap w-full font-semibold" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continuar
            </Button>
          </form>
        )}

        {/* PASO 2A: Cliente Nuevo */}
        {step === "new_client" && (
          <form onSubmit={handleRegisterNew} className="panel space-y-4 p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-2 text-xs text-muted-foreground">
              <span>Celular: <strong className="text-foreground">{prettyPhone(normalizePhone(phone))}</strong></span>
              <button type="button" onClick={resetToPhone} className="text-primary underline">
                Cambiar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  className="tap"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoFocus
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

            <div className="space-y-2">
              <Label htmlFor="pass">Contraseña (6+ caracteres) *</Label>
              <Input
                id="pass"
                className="tap"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-pass">Confirmar contraseña *</Label>
              <Input
                id="confirm-pass"
                className="tap"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="tap w-full font-semibold" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear cuenta y entrar
            </Button>
          </form>
        )}

        {/* PASO 2B: Reclamar Cuenta Existente */}
        {step === "claim_account" && (
          <form onSubmit={handleClaimAccount} className="panel space-y-4 p-6 shadow-sm">
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3.5 text-xs">
              <p className="font-semibold text-foreground">
                👋 ¡Hola{customerName ? `, ${customerName}` : ""}!
              </p>
              <p className="mt-1 text-muted-foreground">
                Ya estás registrada en Cookies Moon por pedidos anteriores. Crea tu contraseña para
                acceder a todo tu historial de pedidos.
              </p>
            </div>

            <div className="flex items-center justify-between border-b border-border pb-2 text-xs text-muted-foreground">
              <span>Celular: <strong className="text-foreground">{prettyPhone(normalizePhone(phone))}</strong></span>
              <button type="button" onClick={resetToPhone} className="text-primary underline">
                Cambiar
              </button>
            </div>

            {/* Código de verificación */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="otp">Código de verificación (6 dígitos) *</Label>
                <button
                  type="button"
                  onClick={() => handleSendCode()}
                  disabled={sendingCode}
                  className="flex items-center gap-1 text-[11px] text-primary underline"
                >
                  <RefreshCw className={`h-3 w-3 ${sendingCode ? "animate-spin" : ""}`} />
                  Reenviar código
                </button>
              </div>
              <Input
                id="otp"
                className="tap text-center font-mono text-lg tracking-widest"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-pass">Crear contraseña *</Label>
              <Input
                id="new-pass"
                className="tap"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-new-pass">Confirmar contraseña *</Label>
              <Input
                id="confirm-new-pass"
                className="tap"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="tap w-full font-semibold" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <ShieldCheck className="mr-2 h-4 w-4" />
              Verificar y activar mi cuenta
            </Button>
          </form>
        )}

        {/* PASO 2C: Iniciar Sesión Cliente Registrado */}
        {step === "login" && (
          <form onSubmit={handleLogin} className="panel space-y-4 p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-2 text-xs text-muted-foreground">
              <span>{customerName ? `Hola, ${customerName}` : "Celular:"} <strong className="text-foreground">{prettyPhone(normalizePhone(phone))}</strong></span>
              <button type="button" onClick={resetToPhone} className="text-primary underline">
                Cambiar
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pass-login">Contraseña</Label>
              <Input
                id="pass-login"
                className="tap"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
            </div>

            <Button type="submit" className="tap w-full font-semibold" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>

            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground underline"
              onClick={async () => {
                setStep("recover_password");
                await handleSendCode();
              }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </form>
        )}

        {/* PASO 2D: Recuperar Contraseña */}
        {step === "recover_password" && (
          <form onSubmit={handleRecoverPassword} className="panel space-y-4 p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-2 text-xs text-muted-foreground">
              <span>Recuperando para: <strong className="text-foreground">{prettyPhone(normalizePhone(phone))}</strong></span>
              <button type="button" onClick={() => setStep("login")} className="text-primary underline">
                Volver
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="otp-rec">Código de verificación (6 dígitos)</Label>
                <button
                  type="button"
                  onClick={() => handleSendCode()}
                  disabled={sendingCode}
                  className="flex items-center gap-1 text-[11px] text-primary underline"
                >
                  <RefreshCw className={`h-3 w-3 ${sendingCode ? "animate-spin" : ""}`} />
                  Reenviar código
                </button>
              </div>
              <Input
                id="otp-rec"
                className="tap text-center font-mono text-lg tracking-widest"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rec-pass">Nueva contraseña *</Label>
              <Input
                id="rec-pass"
                className="tap"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rec-confirm-pass">Confirmar nueva contraseña *</Label>
              <Input
                id="rec-confirm-pass"
                className="tap"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="tap w-full font-semibold" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Restablecer y entrar
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          ¿Eres del equipo?{" "}
          <Link to="/auth" className="underline font-medium text-foreground">
            Acceso del personal
          </Link>
        </p>
      </div>
    </div>
  );
}
