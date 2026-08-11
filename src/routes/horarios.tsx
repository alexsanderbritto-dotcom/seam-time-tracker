import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { buildSlots, fmt, scheduleQuery, type Break } from "@/lib/production";
import { Plus, Save, Trash2 } from "lucide-react";

export const Route = createFileRoute("/horarios")({
  head: () => ({
    meta: [
      { title: "Horários da Empresa | Controle de Confecção" },
      {
        name: "description",
        content:
          "Configure o horário de funcionamento, a duração das janelas de marcação e as pausas.",
      },
      { property: "og:title", content: "Horários da Empresa | Controle de Confecção" },
      {
        property: "og:description",
        content: "Configure janelas de marcação, horário de funcionamento e pausas.",
      },
    ],
  }),
  component: HorariosPage,
});

function HorariosPage() {
  const qc = useQueryClient();
  const { data: config } = useQuery(scheduleQuery);

  const [start, setStart] = useState("07:00");
  const [end, setEnd] = useState("17:00");
  const [slot, setSlot] = useState("60");
  const [breaks, setBreaks] = useState<Break[]>([]);

  useEffect(() => {
    if (!config) return;
    setStart(fmt(config.start_time));
    setEnd(fmt(config.end_time));
    setSlot(String(config.slot_minutes));
    setBreaks((config.breaks ?? []).map((b) => ({ ...b, start: fmt(b.start), end: fmt(b.end) })));
  }, [config]);

  const preview = useMemo(
    () =>
      buildSlots({
        id: "preview",
        start_time: start,
        end_time: end,
        slot_minutes: Number(slot) || 60,
        breaks,
      }),
    [start, end, slot, breaks],
  );

  async function save() {
    if (!config) return;
    const { error } = await supabase
      .from("schedule_config")
      .update({
        start_time: start,
        end_time: end,
        slot_minutes: Number(slot) || 60,
        breaks,
        updated_at: new Date().toISOString(),
      })
      .eq("id", config.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Configuração de horários salva.");
    qc.invalidateQueries({ queryKey: ["schedule_config"] });
  }

  return (
    <AppLayout
      title="Configuração de Horários"
      subtitle="Define as janelas usadas na marcação de produção."
    >
      <div className="grid max-w-4xl gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Funcionamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Início</Label>
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Término</Label>
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Janela (min)</Label>
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={slot}
                  onChange={(e) => setSlot(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Pausas (almoço, lanche)</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setBreaks([...breaks, { start: "11:00", end: "12:00", label: "Pausa" }])
                  }
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
                </Button>
              </div>
              {breaks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma pausa configurada.</p>
              ) : (
                breaks.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      className="flex-1"
                      value={b.label}
                      onChange={(e) => {
                        const next = [...breaks];
                        next[i] = { ...b, label: e.target.value };
                        setBreaks(next);
                      }}
                    />
                    <Input
                      type="time"
                      className="w-32"
                      value={b.start}
                      onChange={(e) => {
                        const next = [...breaks];
                        next[i] = { ...b, start: e.target.value };
                        setBreaks(next);
                      }}
                    />
                    <Input
                      type="time"
                      className="w-32"
                      value={b.end}
                      onChange={(e) => {
                        const next = [...breaks];
                        next[i] = { ...b, end: e.target.value };
                        setBreaks(next);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setBreaks(breaks.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <Button onClick={save}>
              <Save className="mr-2 h-4 w-4" /> Salvar configuração
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Janelas geradas <Badge variant="secondary">{preview.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {preview.map((s) => (
                <span
                  key={s.start}
                  className="rounded-md border border-border bg-secondary px-2.5 py-1 font-mono text-xs text-secondary-foreground"
                >
                  {s.start} – {s.end}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <OvertimeCard />
      </div>

    </AppLayout>
  );
}
