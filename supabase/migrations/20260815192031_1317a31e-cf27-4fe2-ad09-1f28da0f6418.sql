CREATE TABLE public.schedule_day_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday integer NOT NULL UNIQUE CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL DEFAULT '07:00',
  end_time time NOT NULL DEFAULT '17:00',
  slot_minutes integer NOT NULL DEFAULT 60,
  breaks jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_folga boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.schedule_day_config TO service_role;
ALTER TABLE public.schedule_day_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY schedule_day_config_service_role_only ON public.schedule_day_config FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER update_schedule_day_config_updated_at BEFORE UPDATE ON public.schedule_day_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.feriados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL UNIQUE,
  nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.feriados TO service_role;
ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;
CREATE POLICY feriados_service_role_only ON public.feriados FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.schedule_day_config (weekday, start_time, end_time, slot_minutes, breaks, is_folga)
SELECT w.weekday,
       COALESCE(c.start_time, '07:00'::time),
       COALESCE(c.end_time, '17:00'::time),
       COALESCE(c.slot_minutes, 60),
       COALESCE(c.breaks, '[]'::jsonb),
       w.weekday IN (0, 6)
FROM (SELECT generate_series(0, 6) AS weekday) w
LEFT JOIN LATERAL (SELECT * FROM public.schedule_config LIMIT 1) c ON true;