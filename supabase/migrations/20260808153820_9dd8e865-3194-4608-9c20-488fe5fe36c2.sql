CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  reference text NOT NULL,
  op_number text NOT NULL,
  brand text,
  total_quantity integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'em_producao',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_public_all" ON public.products FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  standard_time numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX operations_product_id_idx ON public.operations(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operations TO anon, authenticated;
GRANT ALL ON public.operations TO service_role;
ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operations_public_all" ON public.operations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO anon, authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees_public_all" ON public.employees FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.schedule_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_time time NOT NULL DEFAULT '07:00',
  end_time time NOT NULL DEFAULT '17:00',
  slot_minutes integer NOT NULL DEFAULT 60,
  breaks jsonb NOT NULL DEFAULT '[{"start":"11:00","end":"12:00","label":"Almoço"}]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_config TO anon, authenticated;
GRANT ALL ON public.schedule_config TO service_role;
ALTER TABLE public.schedule_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedule_config_public_all" ON public.schedule_config FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.production_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL REFERENCES public.operations(id) ON DELETE CASCADE,
  slot_start time NOT NULL,
  slot_end time NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX production_entries_date_idx ON public.production_entries(entry_date);
CREATE INDEX production_entries_product_idx ON public.production_entries(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_entries TO anon, authenticated;
GRANT ALL ON public.production_entries TO service_role;
ALTER TABLE public.production_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "production_entries_public_all" ON public.production_entries FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.schedule_config (start_time, end_time, slot_minutes) VALUES ('07:00','17:00',60);