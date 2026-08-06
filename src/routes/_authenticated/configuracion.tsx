import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Save, Trash2, UserPlus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { usePriceRules, useInvalidate } from "@/lib/queries";
import { MODALITIES, SIZES, money, dateTimeFmt, type Modality } from "@/lib/cm";
import { useAuth } from "@/lib/auth";
import { logActivity } from "@/lib/storage";
import { listUsers, createUser, updateUser } from "@/lib/users.functions";
import { useActivity, useProfiles } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/configuracion")({
  head: () => ({
    meta: [
      { title: "Configuración — Cookies Moon" },
      { name: "description", content: "Precios de cortadores, usuarios y bitácora del sistema." },
      { property: "og:title", content: "Configuración — Cookies Moon" },
      {
        property: "og:description",
        content: "Precios de cortadores, usuarios y bitácora del sistema.",
      },
    ],
  }),
  component: Configuracion,
});

function Configuracion() {
  const { isAdmin } = useAuth();

  return (
    <>
      <PageHeader
        title="Configuración"
        subtitle={isAdmin ? "Administrador" : "Colaborador (sólo lectura en precios y usuarios)"}
      />
      <Tabs defaultValue="precios">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="precios" className="flex-1">
            Precios
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="flex-1">
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="bitacora" className="flex-1">
            Bitácora
          </TabsTrigger>
        </TabsList>
        <TabsContent value="precios">
          <Precios />
        </TabsContent>
        <TabsContent value="usuarios">
          <Usuarios />
        </TabsContent>
        <TabsContent value="bitacora">
          <Bitacora />
        </TabsContent>
      </Tabs>
    </>
  );
}

function Precios() {
  const { data: rules } = usePriceRules();
  const invalidate = useInvalidate();
  const { isAdmin } = useAuth();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!rules) return;
    const v: Record<string, string> = {};
    for (const r of rules) v[`${r.modality}-${r.size_cm}`] = String(r.price);
    setValues(v);
  }, [rules]);

  const save = async () => {
    setSaving(true);
    try {
      for (const r of rules ?? []) {
        const key = `${r.modality}-${r.size_cm}`;
        const next = Number(values[key] ?? r.price);
        if (next !== Number(r.price)) {
          const { error } = await supabase
            .from("cutter_price_rules")
            .update({ price: next })
            .eq("id", r.id);
          if (error) throw error;
          await logActivity({
            action: "Precio actualizado",
            entity: "cutter_price_rule",
            old_value: String(r.price),
            new_value: String(next),
            detail: `${r.modality} ${r.size_cm} cm`,
          });
        }
      }
      toast.success("Precios guardados. Los pedidos existentes conservan su precio original.");
      invalidate("cutter-prices", "activity");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel p-4">
      <h2 className="font-display text-lg">Tabla de precios de cortadores</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        De 5 a 20 cm. Cambiar un precio no modifica pedidos ya registrados.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-2">Tamaño</th>
              {MODALITIES.map((m) => (
                <th key={m.value} className="py-2">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SIZES.map((size) => (
              <tr key={size} className="border-t border-border">
                <td className="py-2 font-medium">{size} cm</td>
                {MODALITIES.map((m) => {
                  const key = `${m.value}-${size}`;
                  return (
                    <td key={m.value} className="py-2 pr-3">
                      {isAdmin ? (
                        <Input
                          className="tap h-10 w-28"
                          inputMode="decimal"
                          value={values[key] ?? ""}
                          onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                        />
                      ) : (
                        money(Number(values[key] ?? 0))
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isAdmin && (
        <Button onClick={save} disabled={saving} className="tap mt-4 font-semibold">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar precios
        </Button>
      )}
      <DemoData />
    </div>
  );
}

function DemoData() {
  const { isAdmin } = useAuth();
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);
  if (!isAdmin) return null;
  return (
    <div className="mt-6 rounded-xl border border-destructive/40 p-4">
      <h3 className="font-display">Datos de demostración</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Elimina todos los clientes, productos y pedidos marcados como demo. No afecta la
        información real.
      </p>
      <Button
        variant="destructive"
        className="tap mt-3"
        disabled={busy}
        onClick={async () => {
          if (!confirm("¿Eliminar todos los datos de demostración?")) return;
          setBusy(true);
          const { error } = await supabase.rpc("purge_demo_data");
          setBusy(false);
          if (error) {
            toast.error(error.message);
            return;
          }
          toast.success("Datos de demostración eliminados");
          invalidate("orders", "products", "customers", "activity");
        }}
      >
        <Trash2 className="mr-2 h-4 w-4" /> Borrar datos demo
      </Button>
    </div>
  );
}

function Usuarios() {
  const { isAdmin } = useAuth();
  const users = useQuery({ queryKey: ["users"], queryFn: () => listUsers(), enabled: isAdmin });
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "colaborador">("colaborador");
  const [busy, setBusy] = useState(false);

  if (!isAdmin)
    return (
      <div className="panel p-6 text-center text-sm text-muted-foreground">
        Sólo los administradores pueden gestionar usuarios.
      </div>
    );

  const add = async () => {
    setBusy(true);
    try {
      await createUser({ data: { email, password, fullName: name, role } });
      toast.success("Usuario creado");
      setEmail("");
      setName("");
      setPassword("");
      users.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <h2 className="mb-3 font-display text-lg">Nuevo usuario autorizado</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Nombre completo</Label>
            <Input className="tap" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Correo</Label>
            <Input className="tap" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Contraseña temporal (8+)</Label>
            <Input className="tap" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "colaborador")}>
              <SelectTrigger className="tap">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="colaborador">Colaborador</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={add} disabled={busy} className="tap mt-4 font-semibold">
          <UserPlus className="mr-2 h-4 w-4" /> Crear usuario
        </Button>
      </div>

      <div className="panel p-4">
        <h2 className="mb-3 font-display text-lg">Usuarios</h2>
        <div className="space-y-2">
          {(users.data ?? []).map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-secondary p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{u.full_name ?? u.email}</p>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              </div>
              <Select
                value={u.role}
                onValueChange={async (v) => {
                  await updateUser({ data: { userId: u.id, role: v as "admin" | "colaborador" } });
                  toast.success("Rol actualizado");
                  users.refetch();
                }}
              >
                <SelectTrigger className="tap w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-xs">
                Activo
                <Switch
                  checked={u.active}
                  onCheckedChange={async (v) => {
                    await updateUser({ data: { userId: u.id, active: v } });
                    users.refetch();
                  }}
                />
              </label>
            </div>
          ))}
          {users.isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin" />}
        </div>
      </div>
    </div>
  );
}

function Bitacora() {
  const { data: activity } = useActivity();
  const { data: profiles } = useProfiles();
  return (
    <div className="panel p-4">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg">
        <ShieldCheck className="h-4 w-4 text-primary" /> Bitácora del sistema
      </h2>
      <div className="space-y-2">
        {(activity ?? []).map((a) => (
          <div key={a.id} className="rounded-lg bg-secondary p-3 text-xs">
            <p className="font-medium">{a.action}</p>
            <p className="text-muted-foreground">
              {profiles?.find((p) => p.id === a.user_id)?.full_name ?? "Sistema"} ·{" "}
              {dateTimeFmt(a.created_at)}
              {a.detail ? ` · ${a.detail}` : ""}
              {a.old_value || a.new_value ? ` · ${a.old_value ?? "—"} → ${a.new_value ?? "—"}` : ""}
            </p>
          </div>
        ))}
        {(activity ?? []).length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Sin movimientos.</p>
        )}
      </div>
    </div>
  );
}

export type { Modality };
