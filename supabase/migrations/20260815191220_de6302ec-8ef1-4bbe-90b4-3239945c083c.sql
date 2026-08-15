ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS numero_id integer;

WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY name, created_at) + 9 AS n
  FROM public.employees
)
UPDATE public.employees e SET numero_id = o.n FROM ordered o WHERE e.id = o.id AND e.numero_id IS NULL;

CREATE SEQUENCE IF NOT EXISTS public.employees_numero_id_seq AS integer START WITH 10;

SELECT setval('public.employees_numero_id_seq', GREATEST((SELECT COALESCE(max(numero_id), 9) FROM public.employees), 9));

ALTER TABLE public.employees ALTER COLUMN numero_id SET DEFAULT nextval('public.employees_numero_id_seq');
ALTER TABLE public.employees ALTER COLUMN numero_id SET NOT NULL;
ALTER SEQUENCE public.employees_numero_id_seq OWNED BY public.employees.numero_id;

CREATE UNIQUE INDEX IF NOT EXISTS employees_numero_id_key ON public.employees (numero_id);