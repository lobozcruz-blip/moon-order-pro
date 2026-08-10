CREATE TABLE IF NOT EXISTS public.product_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_themes TO authenticated;
GRANT ALL ON public.product_themes TO service_role;
ALTER TABLE public.product_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_themes_read ON public.product_themes
  FOR SELECT TO authenticated USING (public.is_staff() OR public.is_client());
CREATE POLICY product_themes_insert ON public.product_themes
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY product_themes_update ON public.product_themes
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY product_themes_delete ON public.product_themes
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER t_product_themes_upd BEFORE UPDATE ON public.product_themes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.product_theme_links (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  theme_id uuid NOT NULL REFERENCES public.product_themes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, theme_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_theme_links TO authenticated;
GRANT ALL ON public.product_theme_links TO service_role;
ALTER TABLE public.product_theme_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY ptl_read ON public.product_theme_links
  FOR SELECT TO authenticated USING (public.is_staff() OR public.is_client());
CREATE POLICY ptl_insert ON public.product_theme_links
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY ptl_update ON public.product_theme_links
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY ptl_delete ON public.product_theme_links
  FOR DELETE TO authenticated USING (public.is_staff());

CREATE INDEX IF NOT EXISTS idx_ptl_theme ON public.product_theme_links(theme_id);

CREATE TABLE IF NOT EXISTS public.phone_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_normalized text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.phone_verification_codes TO service_role;
ALTER TABLE public.phone_verification_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_pvc_phone ON public.phone_verification_codes(phone_normalized, consumed);