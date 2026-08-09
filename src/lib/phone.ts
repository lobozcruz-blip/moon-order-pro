/** Utilidades de celular para el portal de clientas. */

export const CLIENT_EMAIL_DOMAIN = "clientes.cookiesmoon.app";

/** Deja sólo dígitos y antepone 52 cuando son 10 dígitos (México). */
export function normalizePhone(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) return "52" + digits;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

/** Correo sintético determinista: el celular es el usuario. */
export function clientEmail(phoneNormalized: string) {
  return `${phoneNormalized}@${CLIENT_EMAIL_DOMAIN}`;
}

export function isClientEmail(email: string | null | undefined) {
  return !!email && email.endsWith(`@${CLIENT_EMAIL_DOMAIN}`);
}

export function prettyPhone(phoneNormalized: string | null | undefined) {
  const d = (phoneNormalized ?? "").replace(/\D/g, "");
  const local = d.length === 12 && d.startsWith("52") ? d.slice(2) : d;
  return local.replace(/(\d{2})(\d{4})(\d{4})/, "$1 $2 $3") || "—";
}
