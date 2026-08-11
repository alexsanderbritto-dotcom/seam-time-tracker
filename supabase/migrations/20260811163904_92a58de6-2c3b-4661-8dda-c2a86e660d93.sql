DROP POLICY IF EXISTS esteira_producao_public_all ON public.esteira_producao;

REVOKE INSERT, UPDATE, DELETE ON public.esteira_producao FROM anon, authenticated;
GRANT SELECT ON public.esteira_producao TO anon, authenticated;
GRANT ALL ON public.esteira_producao TO service_role;

CREATE POLICY esteira_producao_read ON public.esteira_producao
FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY esteira_producao_service_all ON public.esteira_producao
FOR ALL TO service_role USING (true) WITH CHECK (true);