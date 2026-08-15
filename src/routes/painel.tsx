import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Monitor, Volume2, VolumeX, X } from "lucide-react";
import {
  TelaColaboradores,
  TelaSetor,
  type EmployeeCardData,
  type SectorScreenData,
} from "@/components/PainelScreens";
import { findCurrentSlot, useCelebration } from "@/lib/painel";
import {
  buildSlots,
  catalogOperationsQuery,
  employeesQuery,
  entriesQuery,
  esteiraQuery,
  fmt,
  metaProducaoQuery,
  operationsQuery,
  overtimeSlotsQuery,
  producedInSector,
  productsQuery,
  scheduleQuery,
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

function PainelPage() {
  const date = todayISO();

  const { data: employees = [] } = useQuery({ ...employeesQuery, refetchInterval: REFETCH });
  const { data: products = [] } = useQuery({ ...productsQuery, refetchInterval: REFETCH });
  const { data: operations = [] } = useQuery({ ...operationsQuery, refetchInterval: REFETCH });
  const { data: catalogOps = [] } = useQuery({
    ...catalogOperationsQuery,
    refetchInterval: REFETCH,
  });
  const { data: sectors = [] } = useQuery({ ...sectorsQuery, refetchInterval: REFETCH });
  const { data: config } = useQuery(scheduleQuery);
  const { data: overtimeSlots = [] } = useQuery(overtimeSlotsQuery);
  const { data: dayEntries = [] } = useQuery({ ...entriesQuery(date), refetchInterval: 10000 });
  const { data: allEntries = [] } = useQuery({ ...entriesQuery(), refetchInterval: 30000 });
  const { data: metas = [] } = useQuery({ ...metaProducaoQuery(date), refetchInterval: REFETCH });
  const { data: esteira = [] } = useQuery({ ...esteiraQuery, refetchInterval: REFETCH });

  /* ---------- configuração ---------- */
  const [telaAOn, setTelaAOn] = useState(true);
  const [sectorsOff, setSectorsOff] = useState<Record<string, boolean>>({});
  const [groupSize, setGroupSize] = useState(6);
  const [groupSeconds, setGroupSeconds] = useState(7);
  const [screenSeconds, setScreenSeconds] = useState(15);
  const [soundOn, setSoundOn] = useState(true);
  const [display, setDisplay] = useState(false);

  const { report, isCelebrating } = useCelebration(soundOn);

  /* ---------- relógio (para a janela atual) ---------- */
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(t);
  }, []);

  /* ---------- janelas ---------- */
  const normalSlots = useMemo(() => buildSlots(config), [config]);
  const slots = useMemo<Slot[]>(() => {
    const used = new Set(
      dayEntries.filter((e) => e.is_overtime && e.quantity > 0).map((e) => fmt(e.slot_start)),
    );
    const extras = overtimeSlots
      .filter((o) => used.has(fmt(o.start_time)))
      .map((o) => ({ start: fmt(o.start_time), end: fmt(o.end_time), overtime: true }));
    return [
      ...normalSlots.map((s) => ({ ...s, overtime: false })),
      ...extras.sort((a, b) => a.start.localeCompare(b.start)),
    ];
  }, [normalSlots, overtimeSlots, dayEntries]);

  const slotIdx = useMemo(() => findCurrentSlot(slots, now), [slots, now]);
  const slot = slotIdx >= 0 ? slots[slotIdx] : undefined;
  const slotLabel = slot ? `${slot.start} – ${slot.end}` : "—";
  const slotHours = (config?.slot_minutes ?? 60) / 60;

  const inSlot = (e: { slot_start: string; is_overtime: boolean }) =>
    !!slot && fmt(e.slot_start) === fmt(slot.start) && Boolean(e.is_overtime) === Boolean(slot.overtime);

  const opCatalog = useMemo(
    () => new Map(operations.map((o) => [o.id, o.catalog_operation_id] as const)),
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
  const opName = useMemo(() => new Map(operations.map((o) => [o.id, o.name] as const)), [operations]);

  /* ---------- Tela A: colaboradores da hora ---------- */
  const employeeCards = useMemo<EmployeeCardData[]>(() => {
    if (!slot) return [];
    const hourEntries = dayEntries.filter(inSlot);
    return employees
      .map((emp) => {
        const mine = hourEntries.filter((e) => e.employee_id === emp.id);
        if (mine.length === 0) return null;
        let fraction = 0;
        let produced = 0;
        const ops = new Set<string>();
        for (const e of mine) {
          const eph = expectedPerHour.get(e.operation_id);
          const meta = eph != null ? eph * slotHours : null;
          if (meta != null && meta > 0) fraction += e.quantity / meta;
          produced += e.quantity;
          ops.add(opName.get(e.operation_id) ?? "Operação");
        }
        return {
          key: `emp:${emp.id}:${slot.start}:${slot.overtime ? "x" : "n"}`,
          name: emp.name,
          operations: Array.from(ops),
          produced,
          pct: fraction * 100,
        } satisfies EmployeeCardData;
      })
      .filter((c): c is EmployeeCardData => c !== null)
      .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  }, [employees, dayEntries, slot, expectedPerHour, slotHours, opName]);

  /* ---------- Tela B: setores ---------- */
  const workHours = normalSlots.length * slotHours;

  const activeSectors = useMemo(
    () => sectors.filter((s) => !sectorsOff[s.id]),
    [sectors, sectorsOff],
  );

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
  const esteiraIds = useMemo(() => new Set(esteira.map((e) => e.produto_id)), [esteira]);

  const sectorScreens = useMemo<SectorScreenData[]>(
    () =>
      activeSectors.map((s) => {
        const rows = metas.filter((m) => m.sector_id === s.id);
        const totalMeta = rows.reduce((a, m) => a + (m.quantidade ?? 0), 0);
        const metaHora = workHours > 0 ? totalMeta / workHours : 0;
        const atingido = dayEntries
          .filter((e) => opSectorLast.get(e.operation_id) === s.id && inSlot(e))
          .reduce((a, e) => a + e.quantity, 0);
        return {
          key: `sector:${s.id}:${slot?.start ?? ""}:${slot?.overtime ? "x" : "n"}`,
          sectorName: s.name,
          slotLabel,
          metaHora,
          atingido,
          pct: metaHora > 0 ? (atingido / metaHora) * 100 : null,
          products: rows
            .map((m) => {
              const p = productById.get(m.product_id);
              const produced = producedInSector(
                m.product_id,
                s.id,
                operations,
                catalogOps,
                allEntries,
              );
              const meta = m.quantidade ?? 0;
              return {
                id: m.id,
                opInterna: p?.op_interna || (p?.name ?? "—"),
                meta,
                produced,
                pct: meta > 0 ? (produced / meta) * 100 : 0,
                inEsteira: esteiraIds.has(m.product_id),
              };
            })
            .sort((a, b) => a.opInterna.localeCompare(b.opInterna, "pt-BR", { numeric: true })),
        } satisfies SectorScreenData;
      }),
    [
      activeSectors,
      metas,
      workHours,
      dayEntries,
      opSectorLast,
      slot,
      slotLabel,
      productById,
      operations,
      catalogOps,
      allEntries,
      esteiraIds,
    ],
  );

  /* ---------- celebrações ---------- */
  useEffect(() => {
    if (!display) return;
    for (const c of employeeCards) report(c.key, c.pct);
    for (const s of sectorScreens) report(s.key, s.pct);
  }, [display, employeeCards, sectorScreens, report]);

  /* ---------- telas da rotação ---------- */
  const groups = useMemo(() => {
    const size = Math.max(1, groupSize);
    const out: EmployeeCardData[][] = [];
    for (let i = 0; i < employeeCards.length; i += size) out.push(employeeCards.slice(i, i + size));
    return out.length > 0 ? out : [[]];
  }, [employeeCards, groupSize]);

  type Screen = { id: string; kind: "employees" | "sector"; sector?: SectorScreenData };
  const screens = useMemo<Screen[]>(() => {
    const list: Screen[] = [];
    if (telaAOn) list.push({ id: "tela-a", kind: "employees" });
    for (const s of sectorScreens) list.push({ id: s.key, kind: "sector", sector: s });
    return list;
  }, [telaAOn, sectorScreens]);

  const [screenIdx, setScreenIdx] = useState(0);
  const [groupIdx, setGroupIdx] = useState(0);
  const screenCount = screens.length;

  useEffect(() => {
    if (screenIdx >= screenCount) setScreenIdx(0);
  }, [screenIdx, screenCount]);
  useEffect(() => {
    if (groupIdx >= groups.length) setGroupIdx(0);
  }, [groupIdx, groups.length]);

  const current = screens[Math.min(screenIdx, Math.max(screenCount - 1, 0))];

  useEffect(() => {
    if (!display || screenCount === 0) return;
    const isEmployees = current?.kind === "employees";
    const lastGroup = groupIdx >= groups.length - 1;
    const wait = (isEmployees ? groupSeconds : screenSeconds) * 1000;
    const t = window.setTimeout(() => {
      if (isEmployees && !lastGroup) {
        setGroupIdx((g) => g + 1);
      } else {
        setGroupIdx(0);
        setScreenIdx((i) => (i + 1) % screenCount);
      }
    }, Math.max(2000, wait));
    return () => window.clearTimeout(t);
  }, [display, current, groupIdx, groups.length, groupSeconds, screenSeconds, screenCount]);

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
                onClick={() => setSoundOn((v) => !v)}
                aria-label={soundOn ? "Desativar som" : "Ativar som"}
              >
                {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
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
            <div key={`${current?.id}-${groupIdx}`} className="h-full animate-fade-in">
              {screenCount === 0 ? (
                <div className="flex h-full items-center justify-center text-3xl text-slate-500">
                  Nenhuma tela selecionada.
                </div>
              ) : current?.kind === "employees" ? (
                <TelaColaboradores
                  slotLabel={slotLabel}
                  cards={activeGroup}
                  groupIndex={groupIdx}
                  groupCount={groups.length}
                  isCelebrating={isCelebrating}
                />
              ) : current?.sector ? (
                <TelaSetor data={current.sector} isCelebrating={isCelebrating} />
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Telas em exibição</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <Checkbox
                    checked={telaAOn}
                    onCheckedChange={(v) => setTelaAOn(v === true)}
                  />
                  Tela A — Produtividade por colaborador e operação
                </label>
                {sectors.map((s) => (
                  <label key={s.id} className="flex min-h-11 items-center gap-3 text-sm">
                    <Checkbox
                      checked={!sectorsOff[s.id]}
                      onCheckedChange={(v) =>
                        setSectorsOff((prev) => ({ ...prev, [s.id]: v !== true }))
                      }
                    />
                    Tela B — Setor {s.name}
                  </label>
                ))}
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
                    value={groupSize}
                    onChange={(e) => setGroupSize(Number(e.target.value) || 6)}
                  />
                </div>
                <div className="w-52 space-y-1.5">
                  <Label>Segundos por grupo</Label>
                  <Input
                    type="number"
                    min={2}
                    value={groupSeconds}
                    onChange={(e) => setGroupSeconds(Number(e.target.value) || 7)}
                  />
                </div>
                <div className="w-52 space-y-1.5">
                  <Label>Segundos por tela de setor</Label>
                  <Input
                    type="number"
                    min={2}
                    value={screenSeconds}
                    onChange={(e) => setScreenSeconds(Number(e.target.value) || 15)}
                  />
                </div>
                <div className="flex items-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => setSoundOn((v) => !v)}
                  >
                    {soundOn ? (
                      <Volume2 className="mr-2 h-4 w-4" />
                    ) : (
                      <VolumeX className="mr-2 h-4 w-4" />
                    )}
                    Som {soundOn ? "ativado" : "desativado"}
                  </Button>
                  <Button type="button" className="min-h-11" onClick={enterDisplay}>
                    <Monitor className="mr-2 h-4 w-4" />
                    Modo Exibição
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Prévia — janela {slotLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl bg-slate-950 p-6 text-slate-100">
                  <TelaColaboradores
                    slotLabel={slotLabel}
                    cards={groups[0] ?? []}
                    groupIndex={0}
                    groupCount={groups.length}
                    isCelebrating={() => false}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
