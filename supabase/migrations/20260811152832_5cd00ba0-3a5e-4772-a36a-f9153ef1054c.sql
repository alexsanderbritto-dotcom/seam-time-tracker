CREATE TABLE public.marcadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  senha_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.marcadores TO service_role;

ALTER TABLE public.marcadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marcadores_service_role_only" ON public.marcadores
FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_marcadores_updated_at BEFORE UPDATE ON public.marcadores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();