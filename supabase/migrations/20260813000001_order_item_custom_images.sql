-- Añadir soporte explícito para artículos personalizados e imágenes de referencia de fabricación
ALTER TABLE public.order_items 
  ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.order_item_images 
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS image_type TEXT NOT NULL DEFAULT 'custom_reference';

-- Comentarios explicativos
COMMENT ON COLUMN public.order_items.is_custom IS 'Indica si el artículo es un diseño personalizado enviado por la clienta';
COMMENT ON COLUMN public.order_item_images.is_primary IS 'Indica si es la imagen principal de referencia para fabricación del artículo';
COMMENT ON COLUMN public.order_item_images.image_type IS 'Tipo de imagen: custom_reference, note_attachment, etc.';
