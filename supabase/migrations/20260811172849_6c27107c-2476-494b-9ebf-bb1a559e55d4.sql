CREATE TABLE public.overtime_slots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.overtime_slots TO anon, authenticated;
GRANT ALL ON public.overtime_slots TO service_role;

ALTER TABLE public.overtime_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY overtime_slots_public_all ON public.overtime_slots
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_overtime_slots_updated_at
BEFORE UPDATE ON public.overtime_slots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.production_entries
  ADD COLUMN is_overtime boolean NOT NULL DEFAULT false;