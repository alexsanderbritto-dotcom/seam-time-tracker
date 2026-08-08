ALTER TABLE public.products RENAME COLUMN brand TO cliente;
ALTER TABLE public.products
  ADD COLUMN empresa text,
  ADD COLUMN unit_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN entry_date date,
  ADD COLUMN nf_number text;

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO anon, authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY companies_public_all ON public.companies FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);