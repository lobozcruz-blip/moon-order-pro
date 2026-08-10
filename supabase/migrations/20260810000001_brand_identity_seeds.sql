-- Brand identity defaults
INSERT INTO public.app_settings (key, value) VALUES
  ('brand_logo', ''),
  ('brand_logo_alt', ''),
  ('brand_favicon', ''),
  ('brand_name', 'Cookies Moon'),
  ('brand_slogan', ''),
  ('brand_color_primary', '#5CC6D0'),
  ('brand_color_secondary', '#7D421F'),
  ('brand_color_accent', '#EFCE8B')
ON CONFLICT (key) DO NOTHING;
