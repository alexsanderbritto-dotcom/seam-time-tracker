
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO anon, authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY clients_public_all ON public.clients FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sectors TO anon, authenticated;
GRANT ALL ON public.sectors TO service_role;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY sectors_public_all ON public.sectors FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.catalog_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  name text NOT NULL,
  expected_per_hour numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_operations TO anon, authenticated;
GRANT ALL ON public.catalog_operations TO service_role;
ALTER TABLE public.catalog_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalog_operations_public_all ON public.catalog_operations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS catalog_operation_id uuid REFERENCES public.catalog_operations(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.products ALTER COLUMN status SET DEFAULT 'em_estoque';

INSERT INTO public.clients (name)
SELECT DISTINCT cliente FROM public.products WHERE cliente IS NOT NULL AND cliente <> '';

INSERT INTO public.sectors (name) VALUES ('Corte'), ('Costura'), ('Acabamento'), ('Revisão'), ('Embalagem');

CREATE OR REPLACE FUNCTION public.mark_product_in_production()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quantity > 0 THEN
    UPDATE public.products SET status = 'em_producao', updated_at = now()
    WHERE id = NEW.product_id AND status <> 'em_producao';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_product_in_production ON public.production_entries;
CREATE TRIGGER trg_mark_product_in_production
AFTER INSERT OR UPDATE OF quantity ON public.production_entries
FOR EACH ROW EXECUTE FUNCTION public.mark_product_in_production();

UPDATE public.products p SET status = CASE
  WHEN EXISTS (SELECT 1 FROM public.production_entries e WHERE e.product_id = p.id AND e.quantity > 0)
  THEN 'em_producao' ELSE 'em_estoque' END;

CREATE POLICY "product_files_read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'product-files');
CREATE POLICY "product_files_write" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'product-files');
CREATE POLICY "product_files_update" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'product-files');
CREATE POLICY "product_files_delete" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'product-files');
