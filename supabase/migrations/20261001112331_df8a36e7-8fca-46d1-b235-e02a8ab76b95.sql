WITH ranked AS (
  SELECT id, product_id, catalog_operation_id,
         first_value(id) OVER (PARTITION BY product_id, catalog_operation_id ORDER BY created_at, id) AS keeper
  FROM public.operations WHERE catalog_operation_id IS NOT NULL
), dupes AS (SELECT id, keeper FROM ranked WHERE id <> keeper)
UPDATE public.production_entries pe SET operation_id = d.keeper FROM dupes d WHERE pe.operation_id = d.id;

WITH ranked AS (
  SELECT id, first_value(id) OVER (PARTITION BY product_id, catalog_operation_id ORDER BY created_at, id) AS keeper
  FROM public.operations WHERE catalog_operation_id IS NOT NULL
)
DELETE FROM public.operations o USING ranked r WHERE o.id = r.id AND r.id <> r.keeper;

CREATE UNIQUE INDEX IF NOT EXISTS operations_product_catalog_unique
  ON public.operations (product_id, catalog_operation_id) WHERE catalog_operation_id IS NOT NULL;

SELECT public.recalc_product_status(id) FROM public.products
WHERE id IN ('c675864c-f7bc-4c90-890c-7a115e1d2db7','fb845f76-f7ad-4b8f-a30f-7cb81507731a');