-- ============================================================================
-- Migración: Temáticas de Productos y Códigos de Verificación de Cuenta
-- ============================================================================

-- 1. Tabla de Temáticas de Productos
CREATE TABLE IF NOT EXISTS public.product_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Tabla puente de relación muchos a muchos: Productos <-> Temáticas
CREATE TABLE IF NOT EXISTS public.product_theme_links (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  theme_id uuid NOT NULL REFERENCES public.product_themes(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, theme_id)
);

-- 3. Tabla para códigos de verificación de posesión de número celular (OTP)
CREATE TABLE IF NOT EXISTS public.phone_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_normalized text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices de búsqueda
CREATE INDEX IF NOT EXISTS product_theme_links_product_idx ON public.product_theme_links (product_id);
CREATE INDEX IF NOT EXISTS product_theme_links_theme_idx ON public.product_theme_links (theme_id);
CREATE INDEX IF NOT EXISTS phone_verification_codes_lookup_idx ON public.phone_verification_codes (phone_normalized, consumed, expires_at);

-- 4. Semillas de Temáticas iniciales
INSERT INTO public.product_themes (name, active) VALUES
  ('Navidad', true),
  ('Día de la Madre', true),
  ('Día del Padre', true),
  ('Día del Maestro', true),
  ('Graduación', true),
  ('Halloween', true),
  ('Día de Muertos', true),
  ('San Valentín', true),
  ('Pascua', true),
  ('Cumpleaños', true),
  ('Boda', true),
  ('Baby Shower', true),
  ('Bautizo', true),
  ('Primera Comunión', true),
  ('Fútbol', true),
  ('Animales', true),
  ('Flores', true),
  ('Princesas', true),
  ('Personajes', true),
  ('México', true),
  ('Otras', true)
ON CONFLICT (name) DO NOTHING;

-- 5. Configuración de RLS y permisos

-- product_themes
ALTER TABLE public.product_themes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_themes TO authenticated;
GRANT ALL ON public.product_themes TO service_role;

DROP POLICY IF EXISTS product_themes_select ON public.product_themes;
CREATE POLICY product_themes_select ON public.product_themes
  FOR SELECT TO authenticated
  USING (public.is_staff() OR (active AND public.is_client()));

DROP POLICY IF EXISTS product_themes_staff_all ON public.product_themes;
CREATE POLICY product_themes_staff_all ON public.product_themes
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- product_theme_links
ALTER TABLE public.product_theme_links ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_theme_links TO authenticated;
GRANT ALL ON public.product_theme_links TO service_role;

DROP POLICY IF EXISTS product_theme_links_select ON public.product_theme_links;
CREATE POLICY product_theme_links_select ON public.product_theme_links
  FOR SELECT TO authenticated
  USING (public.is_staff() OR public.is_client());

DROP POLICY IF EXISTS product_theme_links_staff_all ON public.product_theme_links;
CREATE POLICY product_theme_links_staff_all ON public.product_theme_links
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- phone_verification_codes (acceso exclusivo por service_role en server functions)
ALTER TABLE public.phone_verification_codes ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.phone_verification_codes TO service_role;
