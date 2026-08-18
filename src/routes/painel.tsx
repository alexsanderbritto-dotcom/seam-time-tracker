import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, Monitor, Volume2, VolumeX, X } from "lucide-react";
import {
  ScaledPreview,
  TelaColaboradores,
  TelaSetor,
  type EmployeeCardData,
  type SectorScreenData,
} from "@/components/PainelScreens";
import { findCurrentSlot, useCelebration } from "@/lib/painel";
import { buildDaySlots, daySchedulesQuery, feriadosQuery } from "@/lib/schedule";
import {
  DEFAULT_SCREEN_CONFIG,
  formatDateBR,
  usePainelPrefs,
  type ScreenConfig,
} from "@/lib/painel-config";
import {
  catalogOperationsQuery,
  employeesQuery,
  entriesQuery,
  fmt,
  metaProducaoQuery,
  ocorrenciasQuery,
  operationsQuery,
  overtimeSlotsQuery,
  producedInSector,
  productsQuery,
  sectorsQuery,
  todayISO,
  type Slot,
} from "@/lib/production";

export const Route = createFileRoute("/painel")({
  head: () => ({
    meta: [
      { title: "Painel de TV da Produção | Controle de Confecção" },
      {
        name: "description",
        content:
          "Painel em tela cheia para o chão de fábrica: produtividade por colaborador e metas por setor em tempo real.",
      },
      { property: "og:title", content: "Painel de TV da Produção" },
      {
        property: "og:description",
        content: "Modo exibição com rotação automática de telas para a TV da fábrica.",
      },
    ],
  }),
  component: PainelPage,
});

const REFETCH = 15000;

type ScreenDef = {
  id: string;
  kind: "employees" | "sector";
  sectorId?: string;
  name: string;
};

type BuiltScreen = {
  def: ScreenDef;
  cfg: ScreenConfig;
  slots: Slot[];
  slotLabel: string;
  pastDateLabel?: string | undefined;
  sector?: SectorScreenData | undefined;
  cards: EmployeeCardData[];
};

function PainelPage() {
  const today = todayISO();
  const { prefs, update, setScreen } = usePainelPrefs();

  const { data: employees = [] } = useQuery({ ...employeesQuery, refetchInterval: REFETCH });
  const { data: products = [] } = useQuery({ ...productsQuery, refetchInterval: REFETCH });
  const { data: operations = [] } = useQuery({ ...operationsQuery, refetchInterval: REFETCH });
  const { data: catalogOps = [] } = useQuery({
    ...catalogOperationsQuery,
    refetchInterval: REFETCH,
  });
  const { data: sectors = [] } = useQuery({ ...sectorsQuery, refetchInterval: REFETCH });
  const { data: overtimeSlots = [] } = useQuery(overtimeSlotsQuery);
  const { data: allEntries = [] } = useQuery({ ...entriesQuery(), refetchInterval: 30000 });
  const { data: ocorrencias = [] } = useQuery({ ...ocorrenciasQuery, refetchInterval: REFETCH });

  const [display, setDisplay] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const { report, isCelebrating } = useCelebration(prefs.soundOn);

  /* ---------- relógio ---------- */
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(t);
  }, []);

  /* ---------- telas configuradas ---------- */
  const screenDefs = useMemo<ScreenDef[]>(
    () => [
      { id: "tela-a", kind: "employees", name: "Tela A — Produtividade por colaborador" },
      ...sectors.map((s) => ({
        id: `sector:${s.id}`,
        kind: "sector" as const,
        sectorId: s.id,
        name: `Tela B — Setor ${s.name}`,
      })),
    ],
    [sectors],
  );

  const cfgOf = (id: string): ScreenConfig => prefs.screens[id] ?? DEFAULT_SCREEN_CONFIG();

  const dates = useMemo(() => {
    const set = new Set<string>([today]);
    for (const d of screenDefs) set.add(cfgOf(d.id).date);
    return Array.from(set).sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenDefs, prefs.screens, today]);

  const entriesResults = useQueries({
    queries: dates.map((d) => ({ ...entriesQuery(d), refetchInterval: 10000 })),
  });
  const metaResults = useQueries({
    queries: dates.map((d) => ({ ...metaProducaoQuery(d), refetchInterval: REFETCH })),
  });

  const entriesByDate = useMemo(() => {
    const m = new Map<string, (typeof allEntries)[number][]>();
    dates.forEach((d, i) => m.set(d, entriesResults[i]?.data ?? []));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates, entriesResults.map((r) => r.dataUpdatedAt).join(",")]);

  const metasByDate = useMemo(() => {
    const m = new Map<string, NonNullable<(typeof metaResults)[number]["data"]>>();
    dates.forEach((d, i) => m.set(d, metaResults[i]?.data ?? []));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates, metaResults.map((r) => r.dataUpdatedAt).join(",")]);

  /* ---------- janelas ---------- */
  const { data: daySchedules = [] } = useQuery(daySchedulesQuery);
  const { data: feriados = [] } = useQuery(feriadosQuery);
  const baseDay = useMemo(
    () => buildDaySlots(daySchedules, feriados, todayISO()),
    [daySchedules, feriados],
  );
  const normalSlots = baseDay.slots;
  const slotHours = baseDay.slotMinutes / 60;
  const workHours = normalSlots.length * slotHours;

  const slotsForDate = useMemo(() => {
    const cache = new Map<string, Slot[]>();
    return (date: string): Slot[] => {
      const hit = cache.get(date);
      if (hit) return hit;
      const entries = entriesByDate.get(date) ?? [];
      const used = new Set(
        entries.filter((e) => e.is_overtime && e.quantity > 0).map((e) => fmt(e.slot_start)),
      );
      const extras = overtimeSlots
        .filter((o) => used.has(fmt(o.start_time)))
        .map((o) => ({ start: fmt(o.start_time), end: fmt(o.end_time), overtime: true }));
      const dayCfg = buildDaySlots(daySchedules, feriados, date);
      const out: Slot[] = [
        ...dayCfg.slots.map((s) => ({ ...s, overtime: Boolean(s.overtime) })),
        ...extras.sort((a, b) => a.start.localeCompare(b.start)),
      ];
      cache.set(date, out);
      return out;
    };
  }, [daySchedules, feriados, overtimeSlots, entriesByDate]);

  const opName = useMemo(
    () => new Map(operations.map((o) => [o.id, o.name] as const)),
    [operations],
  );
  const expectedPerHour = useMemo(() => {
    const byCatalog = new Map(catalogOps.map((c) => [c.id, c.expected_per_hour]));
    const map = new Map<string, number | null>();
    for (const o of operations) {
      map.set(o.id, o.catalog_operation_id ? (byCatalog.get(o.catalog_operation_id) ?? null) : null);
    }
    return map;
  }, [operations, catalogOps]);

  const opSectorLast = useMemo(() => {
    const catSector = new Map(catalogOps.map((c) => [c.id, c.sector_id]));
    const map = new Map<string, string>();
    for (const o of operations) {
      if (!o.is_last_operation || !o.catalog_operation_id) continue;
      const sid = catSector.get(o.catalog_operation_id);
      if (sid) map.set(o.id, sid);
    }
    return map;
  }, [operations, catalogOps]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const ocorrenciaName = useMemo(
    () => new Map(ocorrencias.map((o) => [o.id, o.nome] as const)),
    [ocorrencias],
  );

  /* ---------- montagem das telas ---------- */
  const built = useMemo<BuiltScreen[]>(() => {
    return screenDefs.map((def) => {
      const cfg = cfgOf(def.id);
      const slots = slotsForDate(cfg.date);
      let active: Slot[] = [];
      if (cfg.mode === "custom" && cfg.slots.length > 0) {
        active = slots.filter((s) => cfg.slots.includes(s.start));
      } else if (cfg.date === today) {
        const i = findCurrentSlot(slots, now);
        active = i >= 0 && slots[i] ? [slots[i]] : [];
      } else {
        active = slots;
      }
      const first = active[0];
      const last = active[active.length - 1];
      const slotLabel = first && last ? `${first.start} – ${last.end}` : "—";
      const pastDateLabel = cfg.date === today ? undefined : formatDateBR(cfg.date);
      const entries = entriesByDate.get(cfg.date) ?? [];
      const inActive = (e: { slot_start: string; is_overtime: boolean }) =>
        active.some(
          (s) => fmt(e.slot_start) === fmt(s.start) && Boolean(e.is_overtime) === Boolean(s.overtime),
        );
      
      const keyBase = `${def.id}:${cfg.date}:${active.map((s) => s.start).join("_")}`;

      const inSlot = (e: { slot_start: string; is_overtime: boolean }, s: Slot) =>
        fmt(e.slot_start) === fmt(s.start) && Boolean(e.is_overtime) === Boolean(s.overtime);

      if (def.kind === "employees") {
        const hourEntries = entries.filter(inActive);
        const cards = employees
          .map((emp): EmployeeCardData | null => {
            const mine = hourEntries.filter((e) => e.employee_id === emp.id);
            if (mine.length === 0) return null;
            let produced = 0;
            const ops = new Set<string>();
            for (const e of mine) {
              produced += e.quantity;
              ops.add(opName.get(e.operation_id) ?? "Operação");
            }
            const hours = active
              .map((s) => {
                const rows = mine.filter((e) => inSlot(e, s));
                if (rows.length === 0) return null;
                let f = 0;
                let prod = 0;
                const occ = new Set<string>();
                for (const e of rows) {
                  const eph = expectedPerHour.get(e.operation_id);
                  const meta = eph != null ? eph * slotHours : null;
                  if (meta != null && meta > 0) f += e.quantity / meta;
                  prod += e.quantity;
                  if (e.ocorrencia_id)
                    occ.add(ocorrenciaName.get(e.ocorrencia_id) ?? "Ocorrência");
                }
                const hasOcc = occ.size > 0;
                return {
                  key: `${s.start}-${s.overtime ? "x" : "n"}`,
                  label: `${s.start}–${s.end}${s.overtime ? " (extra)" : ""}`,
                  produced: prod,
                  meta: hasOcc ? null : f > 0 ? prod / f : null,
                  // Horário com ocorrência não gera percentual.
                  pct: hasOcc ? null : f > 0 ? f * 100 : null,
                  occurrence: hasOcc ? Array.from(occ).join(" · ") : null,
                };
              })
              .filter((h): h is NonNullable<typeof h> => h !== null);
            // Média apenas dos horários com marcação e sem ocorrência.
            const pcts = hours
              .map((h) => h.pct)
              .filter((p): p is number => p != null);
            const avgPct =
              pcts.length > 0 ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;
            return {
              key: `${keyBase}:${emp.id}`,
              // Compliance: no Painel exibimos apenas o ID anônimo do colaborador.
              name: `Colaborador-${emp.numero_id}`,
              operations: Array.from(ops),
              produced,
              pct: avgPct,
              hours,
            };

          })
          .filter((c): c is EmployeeCardData => c !== null)
          .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
        return { def, cfg, slots, slotLabel, pastDateLabel, cards };
      }

      const sectorId = def.sectorId!;
      const sectorName = sectors.find((s) => s.id === sectorId)?.name ?? "Setor";
      const rows = (metasByDate.get(cfg.date) ?? []).filter((m) => m.sector_id === sectorId);
      const totalMeta = rows.reduce((a, m) => a + (m.quantidade ?? 0), 0);
      const metaSlot = workHours > 0 ? (totalMeta / workHours) * slotHours : 0;
      const metaHora =
        workHours > 0 ? (totalMeta / workHours) * Math.max(active.length, 1) : 0;
      const sectorEntries = entries.filter((e) => opSectorLast.get(e.operation_id) === sectorId);
      const atingido = sectorEntries
        .filter((e) => inActive(e))
        .reduce((a, e) => a + e.quantity, 0);
      const hours = active.map((s) => {
        const done = sectorEntries
          .filter((e) => inSlot(e, s))
          .reduce((a, e) => a + e.quantity, 0);
        return {
          key: `${s.start}-${s.overtime ? "x" : "n"}`,
          label: `${s.start}–${s.end}${s.overtime ? " (extra)" : ""}`,
          meta: metaSlot,
          atingido: done,
          pct: metaSlot > 0 ? (done / metaSlot) * 100 : null,
        };
      });
      const sector: SectorScreenData = {
        key: keyBase,
        sectorName,
        slotLabel,
        metaHora,
        atingido,
        pct: metaHora > 0 ? (atingido / metaHora) * 100 : null,
        hours,
        products: rows
          .map((m) => {
            const p = productById.get(m.product_id);
            const produced = producedInSector(
              m.product_id,
              sectorId,
              operations,
              catalogOps,
              allEntries,
              m.lote_id ?? undefined,
            );
            const loteOp = m.lote_id
              ? (esteira.find((e) => e.id === m.lote_id)?.op_interna ?? null)
              : null;
            const meta = m.quantidade ?? 0;
            return {
              id: m.id,
              opInterna: loteOp || p?.op_interna || (p?.name ?? "—"),
              meta,
              produced,
              pct: meta > 0 ? (produced / meta) * 100 : 0,
            };
          })
          .sort((a, b) => a.opInterna.localeCompare(b.opInterna, "pt-BR", { numeric: true })),
      };
      return { def, cfg, slots, slotLabel, pastDateLabel, cards: [], sector };

    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    screenDefs,
    prefs.screens,
    slotsForDate,
    entriesByDate,
    metasByDate,
    employees,
    expectedPerHour,
    opName,
    opSectorLast,
    productById,
    ocorrenciaName,
    operations,
    catalogOps,
    allEntries,
    sectors,
    workHours,
    slotHours,
    now,
    today,
  ]);

  const builtById = useMemo(() => new Map(built.map((b) => [b.def.id, b])), [built]);

  const rotation = useMemo(
    () =>
      built.filter((b) =>
        b.def.kind === "employees" ? prefs.telaAOn : !prefs.sectorsOff[b.def.sectorId!],
      ),
    [built, prefs.telaAOn, prefs.sectorsOff],
  );

  /* ---------- celebrações ---------- */
  useEffect(() => {
    if (!display) return;
    for (const b of rotation) {
      if (b.cfg.date !== today) continue;
      for (const c of b.cards) report(c.key, c.pct);
      if (b.sector) report(b.sector.key, b.sector.pct);
    }
  }, [display, rotation, report, today]);

  /* ---------- rotação ---------- */
  const [screenIdx, setScreenIdx] = useState(0);
  const [groupIdx, setGroupIdx] = useState(0);
  const screenCount = rotation.length;
  const current = rotation[Math.min(screenIdx, Math.max(screenCount - 1, 0))];

  const groupsOf = (cards: EmployeeCardData[]) => {
    const size = Math.max(1, prefs.groupSize);
    const out: EmployeeCardData[][] = [];
    for (let i = 0; i < cards.length; i += size) out.push(cards.slice(i, i + size));
    return out.length > 0 ? out : [[]];
  };
  const groups = groupsOf(current?.cards ?? []);

  useEffect(() => {
    if (screenIdx >= screenCount) setScreenIdx(0);
  }, [screenIdx, screenCount]);
  useEffect(() => {
    if (groupIdx >= groups.length) setGroupIdx(0);
  }, [groupIdx, groups.length]);

  useEffect(() => {
    if (!display || screenCount === 0) return;
    const isEmployees = current?.def.kind === "employees";
    const lastGroup = groupIdx >= groups.length - 1;
    const wait = (isEmployees ? prefs.groupSeconds : prefs.screenSeconds) * 1000;
    const t = window.setTimeout(() => {
      if (isEmployees && !lastGroup) {
        setGroupIdx((g) => g + 1);
      } else {
        setGroupIdx(0);
        setScreenIdx((i) => (i + 1) % screenCount);
      }
    }, Math.max(2000, wait));
    return () => window.clearTimeout(t);
  }, [
    display,
    current,
    groupIdx,
    groups.length,
    prefs.groupSeconds,
    prefs.screenSeconds,
    screenCount,
  ]);

  /* ---------- fullscreen ---------- */
  const rootRef = useRef<HTMLDivElement>(null);

  const enterDisplay = async () => {
    setScreenIdx(0);
    setGroupIdx(0);
    setDisplay(true);
    try {
      await rootRef.current?.requestFullscreen?.();
    } catch {
      /* fullscreen negado: segue em overlay */
    }
  };

  const exitDisplay = () => {
    setDisplay(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDisplay(false);
    };
    const onFs = () => {
      if (!document.fullscreenElement) setDisplay(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  const activeGroup = groups[Math.min(groupIdx, groups.length - 1)] ?? [];
  const previewScreen = previewId ? builtById.get(previewId) : undefined;

  const renderScreen = (b: BuiltScreen, cards: EmployeeCardData[], gi: number, gc: number) =>
    b.def.kind === "employees" ? (
      <TelaColaboradores
        slotLabel={b.slotLabel}
        cards={cards}
        groupIndex={gi}
        groupCount={gc}
        isCelebrating={isCelebrating}
        pastDateLabel={b.pastDateLabel}
      />
    ) : b.sector ? (
      <TelaSetor data={b.sector} isCelebrating={isCelebrating} pastDateLabel={b.pastDateLabel} />
    ) : null;

  return (
    <AppLayout title="Painel" subtitle="Modo exibição para a TV do chão de fábrica.">
      <div ref={rootRef} className={display ? "fixed inset-0 z-50 bg-slate-950" : undefined}>
        {display ? (
          <div className="relative h-full w-full p-8 text-slate-100">
            <div className="absolute right-4 top-4 z-10 flex gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="text-slate-400 hover:text-slate-100"
                onClick={() => update({ soundOn: !prefs.soundOn })}
                aria-label={prefs.soundOn ? "Desativar som" : "Ativar som"}
              >
                {prefs.soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="text-slate-400 hover:text-slate-100"
                onClick={exitDisplay}
                aria-label="Sair do modo exibição"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div key={`${current?.def.id}-${groupIdx}`} className="h-full animate-fade-in">
              {screenCount === 0 || !current ? (
                <div className="flex h-full items-center justify-center text-3xl text-slate-500">
                  Nenhuma tela selecionada.
                </div>
              ) : (
                renderScreen(current, activeGroup, groupIdx, groups.length)
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Telas, métricas e prévia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {built.map((b) => {
                  const inRotation =
                    b.def.kind === "employees"
                      ? prefs.telaAOn
                      : !prefs.sectorsOff[b.def.sectorId!];
                  return (
                    <div key={b.def.id} className="rounded-lg border p-3 sm:p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
                          <Checkbox
                            checked={inRotation}
                            onCheckedChange={(v) =>
                              b.def.kind === "employees"
                                ? update({ telaAOn: v === true })
                                : update({
                                    sectorsOff: {
                                      ...prefs.sectorsOff,
                                      [b.def.sectorId!]: v !== true,
                                    },
                                  })
                            }
                          />
                          {b.def.name}
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-11"
                          onClick={() => setPreviewId(b.def.id)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Pré-visualizar
                        </Button>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
                        <div className="space-y-1.5">
                          <Label>Data dos dados</Label>
                          <Input
                            type="date"
                            value={b.cfg.date}
                            onChange={(e) =>
                              setScreen(b.def.id, { date: e.target.value || today })
                            }
                          />
                          {b.pastDateLabel ? (
                            <p className="text-xs font-medium text-amber-600">
                              Exibindo {b.pastDateLabel} (dia passado)
                            </p>
                          ) : null}
                        </div>

                        <div className="space-y-1.5">
                          <Label>Horários exibidos</Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={b.cfg.mode === "current" ? "default" : "outline"}
                              onClick={() => setScreen(b.def.id, { mode: "current" })}
                            >
                              Janela atual
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={b.cfg.mode === "custom" ? "default" : "outline"}
                              onClick={() => setScreen(b.def.id, { mode: "custom" })}
                            >
                              Escolher janelas
                            </Button>
                            {b.cfg.mode === "custom" ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    setScreen(b.def.id, {
                                      slots: b.slots.map((s) => s.start),
                                    })
                                  }
                                >
                                  Todas
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setScreen(b.def.id, { slots: [] })}
                                >
                                  Limpar
                                </Button>
                              </>
                            ) : null}
                          </div>
                          {b.cfg.mode === "custom" ? (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {b.slots.map((s) => {
                                const on = b.cfg.slots.includes(s.start);
                                return (
                                  <button
                                    key={`${s.start}-${s.overtime ? "x" : "n"}`}
                                    type="button"
                                    onClick={() =>
                                      setScreen(b.def.id, {
                                        slots: on
                                          ? b.cfg.slots.filter((v) => v !== s.start)
                                          : [...b.cfg.slots, s.start],
                                      })
                                    }
                                    className={
                                      on
                                        ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                                        : "rounded-full border px-3 py-1.5 text-xs text-muted-foreground"
                                    }
                                  >
                                    {s.start}–{s.end}
                                    {s.overtime ? " (extra)" : ""}
                                  </button>
                                );
                              })}
                              {b.cfg.slots.length === 0 ? (
                                <span className="text-xs text-muted-foreground">
                                  Nenhuma janela marcada: será usada a janela atual.
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {sectors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum setor cadastrado.</p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ritmo da rotação</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-4">
                <div className="w-52 space-y-1.5">
                  <Label>Colaboradores por tela</Label>
                  <Input
                    type="number"
                    min={2}
                    max={12}
                    value={prefs.groupSize}
                    onChange={(e) => update({ groupSize: Number(e.target.value) || 6 })}
                  />
                </div>
                <div className="w-52 space-y-1.5">
                  <Label>Segundos por grupo</Label>
                  <Input
                    type="number"
                    min={2}
                    value={prefs.groupSeconds}
                    onChange={(e) => update({ groupSeconds: Number(e.target.value) || 7 })}
                  />
                </div>
                <div className="w-52 space-y-1.5">
                  <Label>Segundos por tela de setor</Label>
                  <Input
                    type="number"
                    min={2}
                    value={prefs.screenSeconds}
                    onChange={(e) => update({ screenSeconds: Number(e.target.value) || 15 })}
                  />
                </div>
                <div className="flex items-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => update({ soundOn: !prefs.soundOn })}
                  >
                    {prefs.soundOn ? (
                      <Volume2 className="mr-2 h-4 w-4" />
                    ) : (
                      <VolumeX className="mr-2 h-4 w-4" />
                    )}
                    Som {prefs.soundOn ? "ativado" : "desativado"}
                  </Button>
                  <Button type="button" className="min-h-11" onClick={enterDisplay}>
                    <Monitor className="mr-2 h-4 w-4" />
                    Modo Exibição
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={!!previewScreen} onOpenChange={(o) => !o && setPreviewId(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              Prévia — {previewScreen?.def.name} · {previewScreen?.slotLabel}
              {previewScreen?.pastDateLabel ? ` · ${previewScreen.pastDateLabel}` : ""}
            </DialogTitle>
          </DialogHeader>
          {previewScreen ? (
            <ScaledPreview>
              {renderScreen(
                previewScreen,
                groupsOf(previewScreen.cards)[0] ?? [],
                0,
                groupsOf(previewScreen.cards).length,
              )}
            </ScaledPreview>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
