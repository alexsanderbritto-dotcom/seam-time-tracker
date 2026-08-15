CREATE TABLE public.ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.ocorrencias TO service_role;

ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY ocorrencias_service_role_only ON public.ocorrencias
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.production_entries
  ADD COLUMN ocorrencia_id uuid REFERENCES public.ocorrencias(id) ON DELETE SET NULL;