ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS delivery_date date,
  ADD COLUMN IF NOT EXISTS forecast_date date,
  ADD COLUMN IF NOT EXISTS nf_out_number text;