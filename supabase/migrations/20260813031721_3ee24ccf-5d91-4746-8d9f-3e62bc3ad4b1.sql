ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_notes text;

ALTER TABLE public.order_item_images
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS image_type text NOT NULL DEFAULT 'custom_reference';

CREATE INDEX IF NOT EXISTS idx_order_items_is_custom ON public.order_items (is_custom) WHERE is_custom;