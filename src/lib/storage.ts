import { supabase } from "@/integrations/supabase/client";

export const BUCKET = "cookies-moon";

export type Folder =
  | "catalogo"
  | "pedidos"
  | "notas"
  | "comprobantes"
  | "guias"
  | "importaciones";

export async function uploadFile(folder: Folder, file: File, keyHint = "") {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${folder}/${keyHint ? keyHint + "/" : ""}${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function uploadBlob(folder: Folder, name: string, blob: Blob, keyHint = "") {
  const ext = name.split(".").pop() ?? "bin";
  const path = `${folder}/${keyHint ? keyHint + "/" : ""}${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob);
  if (error) throw error;
  return path;
}

const cache = new Map<string, { url: string; exp: number }>();

export async function signedUrl(path: string | null | undefined) {
  if (!path) return null;
  const hit = cache.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (!data?.signedUrl) return null;
  cache.set(path, { url: data.signedUrl, exp: Date.now() + 3000_000 });
  return data.signedUrl;
}

export async function removeFile(path: string) {
  await supabase.storage.from(BUCKET).remove([path]);
}

export async function logActivity(entry: {
  action: string;
  entity?: string;
  order_id?: string | null;
  product_id?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  detail?: string | null;
}) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("activity_log").insert({ ...entry, user_id: data.user.id });
}
