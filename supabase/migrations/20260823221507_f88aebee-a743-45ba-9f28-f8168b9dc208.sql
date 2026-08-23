ALTER TABLE public.marcadores
  ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL;

CREATE TABLE public.avisos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  texto text NOT NULL,
  criado_por uuid REFERENCES public.marcadores(id) ON DELETE SET NULL,
  criado_por_nome text NOT NULL,
  resolvido boolean NOT NULL DEFAULT false,
  resolvido_por uuid REFERENCES public.marcadores(id) ON DELETE SET NULL,
  resolvido_por_nome text,
  resolvido_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.avisos TO service_role;

ALTER TABLE public.avisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avisos_service_role_only" ON public.avisos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_avisos_updated_at
  BEFORE UPDATE ON public.avisos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_avisos_resolvido_created ON public.avisos (resolvido, created_at DESC);