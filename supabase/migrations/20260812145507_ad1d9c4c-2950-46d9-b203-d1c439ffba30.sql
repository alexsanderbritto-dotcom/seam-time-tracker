ALTER TABLE public.operations
  ADD COLUMN IF NOT EXISTS is_last_operation boolean NOT NULL DEFAULT false;

UPDATE public.operations o
SET is_last_operation = true
FROM public.catalog_operations c
WHERE o.catalog_operation_id = c.id
  AND c.is_last_operation = true
  AND o.is_last_operation = false;