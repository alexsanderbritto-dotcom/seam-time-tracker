import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { buildSlots, fmt, overtimeSlotsQuery, type Break } from "@/lib/production";
import {
  daySchedulesQuery,
  feriadosQuery,
  WEEKDAY_NAMES,
  type DaySchedule,
} from "@/lib/schedule";
import { AlertTriangle, CalendarPlus, Plus, Save, Trash2 } from "lucide-react";

export const Route = createFileRoute("/horarios")({
  head: () => ({
    meta: [
      { title: "Horários da Empresa | Controle de Confecção" },
      {
        name: "description",
        content:
          "Configure o horário por dia da semana, pausas, dias de folga e o calendário de feriados.",
      },
      { property: "og:title", content: "Horários da Empresa | Controle de Confecção" },
      {
        property: "og:description",
        content: "Horário por dia da semana, pausas com fusão de janelas, folgas e feriados.",
      },
    ],
  }),
  component: HorariosPage,
});

function HorariosPage() {
  const { data: days = [] } = useQuery(daySchedulesQuery);
  const [weekday, setWeekday] = useState(1);

  const current = useMemo(() => days.find((d) => d.weekday === weekday) ?? null, [days, weekday]);

  return (
    <AppLayout
      title="Configuração de Horários"
      subtitle="Horário por dia da semana, pausas, folgas e feriados usados na marcação de produção."
    >
      <div className="grid max-w-5xl gap-5 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dia da semana</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_NAMES.map((name, i) => {
                const cfg = days.find((d) => d.weekday === i);
                const active = i === weekday;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setWeekday(i)}
                    className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-secondary text-secondary-foreground hover:bg-accent"
                    }`}
                  >
                    {name}
                    {cfg?.is_folga ? (
                      <span className="ml-1.5 text-[10px] uppercase opacity-70">folga</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {current ? <DayCard key={current.id} day={current} /> : null}

        <FeriadosCard />
        <OvertimeCard />
      </div>
    </AppLayout>
  );
}

function DayCard({ day }: { day: DaySchedule }) {
  const qc = useQueryClient();
  const [start, setStart] = useState(day.start_time);
  const [end, setEnd] = useState(day.end_time);
  const [slot, setSlot] = useState(String(day.slot_minutes));
  const [breaks, setBreaks] = useState<Break[]>(day.breaks);
  const [folga, setFolga] = useState(day.is_folga);

  useEffect(() => {
    setStart(day.start_time);
    setEnd(day.end_time);
    setSlot(String(day.slot_minutes));
    setBreaks(day.breaks);
    setFolga(day.is_folga);
  }, [day]);

  const preview = useMemo(
    () =>
      buildSlots({
        start_time: start,
        end_time: end,
        slot_minutes: Number(slot) || 60,
        breaks,
      }),
    [start, end, slot, breaks],
  );

  async function save() {
    const { error } = await db
      .from("schedule_day_config")
      .update({
        start_time: start,
        end_time: end,
        slot_minutes: Number(slot) || 60,
        breaks,
        is_folga: folga,
      })
      .eq("id", day.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Horário de ${WEEKDAY_NAMES[day.weekday]} salvo.`);
    qc.invalidateQueries({ queryKey: ["schedule_day_config"] });
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Funcionamento — {WEEKDAY_NAMES[day.weekday]}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div>
              <Label className="text-sm">Dia de folga</Label>
              <p className="text-xs text-muted-foreground">
                Não gera janelas normais; marcações viram hora extra.
              </p>
            </div>
            <Switch checked={folga} onCheckedChange={setFolga} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input
                type="time"
                value={start}
                disabled={folga}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Término</Label>
              <Input
                type="time"
                value={end}
                disabled={folga}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Janela (min)</Label>
              <Input
                type="number"
                min={5}
                step={5}
                value={slot}
                disabled={folga}
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
                disabled={folga}
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
            Prévia das janelas <Badge variant="secondary">{folga ? 0 : preview.length}</Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Pausas desalinhadas fundem as janelas atingidas em uma só.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {folga ? (
            <p className="text-sm text-muted-foreground">
              Dia de folga: nenhuma janela normal é gerada. Marcações nesse dia contam como hora
              extra.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {preview.map((s) => (
                  <span
                    key={s.start}
                    className={`rounded-md border px-2.5 py-1 font-mono text-xs ${
                      s.ambiguous
                        ? "border-destructive text-destructive"
                        : s.merged
                          ? "border-primary bg-secondary text-secondary-foreground"
                          : "border-border bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {s.start} – {s.end}
                    {s.merged ? (
                      <span className="ml-1 font-sans text-[10px] opacity-80">
                        ({s.workMinutes} min úteis)
                      </span>
                    ) : null}
                  </span>
                ))}
              </div>
              {preview.some((s) => s.ambiguous) ? (
                <p className="flex items-start gap-2 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Há pausa atravessando várias janelas: o tempo útil da janela fundida é diferente
                  de uma janela inteira. Revise os horários da pausa.
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function FeriadosCard() {
  const qc = useQueryClient();
  const { data: feriados = [] } = useQuery(feriadosQuery);
  const [data, setData] = useState("");
  const [nome, setNome] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["feriados"] });

  async function add() {
    if (!data) {
      toast.error("Informe a data do feriado.");
      return;
    }
    if (feriados.some((f) => f.data === data)) {
      toast.error("Essa data já está cadastrada como feriado.");
      return;
    }
    const { error } = await db.from("feriados").insert({ data, nome: nome || null });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNome("");
    toast.success("Feriado cadastrado.");
    invalidate();
  }

  async function remove(id: string) {
    const { error } = await db.from("feriados").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Feriado removido.");
    invalidate();
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Calendário de feriados <Badge variant="secondary">{feriados.length}</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Usado na geração de janelas e no cálculo de dias úteis das metas de faturamento.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input
              type="date"
              className="w-44"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Input
              className="w-56"
              placeholder="Ex.: Natal"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={add}>
            <CalendarPlus className="mr-1 h-4 w-4" /> Adicionar feriado
          </Button>
        </div>

        {feriados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum feriado cadastrado.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {feriados.map((f) => (
              <span
                key={f.id}
                className="flex items-center gap-2 rounded-md border border-border bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
              >
                <span className="font-mono">{f.data.split("-").reverse().join("/")}</span>
                {f.nome ? <span className="opacity-80">{f.nome}</span> : null}
                <button
                  type="button"
                  className="text-destructive"
                  onClick={() => remove(f.id)}
                  aria-label="Remover feriado"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OvertimeCard() {
  const qc = useQueryClient();
  const { data: overtime = [] } = useQuery(overtimeSlotsQuery);
  const [newStart, setNewStart] = useState("18:00");
  const [newEnd, setNewEnd] = useState("19:00");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["overtime_slots"] });

  async function add() {
    if (!newStart || !newEnd || newStart >= newEnd) {
      toast.error("Informe um intervalo válido de hora extra.");
      return;
    }
    const { error } = await db
      .from("overtime_slots")
      .insert({ start_time: newStart, end_time: newEnd });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Janela de hora extra criada.");
    invalidate();
  }

  async function update(id: string, patch: { start_time?: string; end_time?: string }) {
    const { error } = await db.from("overtime_slots").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate();
  }

  async function remove(id: string) {
    const { error } = await db.from("overtime_slots").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Janela de hora extra excluída.");
    invalidate();
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Horas extras <Badge variant="secondary">{overtime.length}</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Janelas fora do expediente padrão, usadas apenas quando a marcação for de hora extra.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Início</Label>
            <Input
              type="time"
              className="w-32"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Término</Label>
            <Input
              type="time"
              className="w-32"
              value={newEnd}
              onChange={(e) => setNewEnd(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={add}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar hora extra
          </Button>
        </div>

        {overtime.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma janela de hora extra cadastrada.
          </p>
        ) : (
          <div className="space-y-2">
            {overtime.map((o) => (
              <div key={o.id} className="flex items-center gap-2">
                <Input
                  type="time"
                  className="w-32"
                  value={fmt(o.start_time)}
                  onChange={(e) => update(o.id, { start_time: e.target.value })}
                />
                <Input
                  type="time"
                  className="w-32"
                  value={fmt(o.end_time)}
                  onChange={(e) => update(o.id, { end_time: e.target.value })}
                />
                <Button variant="ghost" size="icon" onClick={() => remove(o.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
