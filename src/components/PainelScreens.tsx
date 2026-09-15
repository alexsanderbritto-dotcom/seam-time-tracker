import { useEffect, useRef, useState, type ReactNode } from "react";
import { PERF_COLOR, PERF_TEXT, perfLevel } from "@/lib/painel";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, CalendarClock, PartyPopper } from "lucide-react";

/* ---------------- tela 16:9 com escala proporcional ---------------- */

const BASE_W = 1920;
const BASE_H = 1080;

export function ScaledPanel({
  children,
  preview = false,
}: {
  children: ReactNode;
  preview?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: BASE_W, height: BASE_H, scale: 1 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      const availableHeight = preview ? width * (BASE_H / BASE_W) : el.clientHeight;
      const height = Math.max(1, availableHeight);
      setViewport({ width, height, scale: Math.min(width / BASE_W, height / BASE_H) });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [preview]);

  const renderedWidth = BASE_W * viewport.scale;
  const renderedHeight = BASE_H * viewport.scale;

  return (
    <div
      ref={ref}
      className={cn(
        "relative w-full overflow-hidden bg-slate-950",
        preview ? "aspect-video rounded-xl" : "h-full",
      )}
    >
      <div
        className="absolute p-12 text-slate-100"
        style={{
          width: BASE_W,
          height: BASE_H,
          left: Math.max(0, (viewport.width - renderedWidth) / 2),
          top: Math.max(0, (viewport.height - renderedHeight) / 2),
          transform: `scale(${viewport.scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function ScaledPreview({ children }: { children: ReactNode }) {
  return (
    <ScaledPanel preview>
      {children}
    </ScaledPanel>
  );
}

function PastBadge({ label }: { label?: string | undefined }) {
  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-4 py-1.5 text-lg font-bold text-amber-300">
      <CalendarClock className="h-5 w-5" /> Dados de {label}
    </span>
  );
}


/* ---------------- confete leve (CSS puro) ---------------- */

const CONFETTI = Array.from({ length: 24 }, (_, i) => ({
  left: (i * 41) % 100,
  delay: (i % 8) * 0.15,
  color: ["#22c55e", "#f59e0b", "#38bdf8", "#e879f9", "#facc15"][i % 5]!,
}));

export function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className="absolute top-[-10%] h-3 w-1.5 rounded-sm animate-[painel-fall_2.4s_linear_infinite]"
          style={{
            left: `${c.left}%`,
            backgroundColor: c.color,
            animationDelay: `${c.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ---------------- anel de progresso ---------------- */

export function ProgressRing({
  pct,
  size = 150,
  label,
}: {
  pct: number | null;
  size?: number;
  label?: string;
}) {
  const level = perfLevel(pct);
  const color = PERF_COLOR[level];
  const value = Math.max(0, Math.min(pct ?? 0, 150));
  const r = 42;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(value, 100) / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#1e293b" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: "stroke-dasharray .6s ease, stroke .4s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn("font-black tabular-nums leading-none", PERF_TEXT[level])}
          style={{ fontSize: size * 0.26 }}
        >
          {pct == null ? "–" : Math.round(pct)}
          <span style={{ fontSize: size * 0.13 }}>%</span>
        </span>
        {label ? (
          <span className="mt-1 text-sm uppercase tracking-widest text-slate-400">
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------- Tela A ---------------- */

export type HourBlockData = {
  key: string;
  label: string;
  produced: number;
  meta: number | null;
  pct: number | null;
  occurrence?: string | null;
};

export type EmployeeCardData = {
  key: string;
  name: string;
  operations: string[];
  produced: number;
  pct: number | null;
  hours: HourBlockData[];
};

function HourBlock({ h }: { h: HourBlockData }) {
  const lv = perfLevel(h.pct);
  return (
    <div
      className={cn(
        "min-h-0 rounded-lg border px-4 py-3",
        lv === "ok"
          ? "border-emerald-500/60 bg-emerald-500/10"
          : lv === "near"
            ? "border-amber-500/60 bg-amber-500/10"
            : "border-red-500/50 bg-red-500/10",
      )}
    >
      <p className="text-lg font-semibold tracking-wide text-slate-300">{h.label}</p>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-2xl font-bold tabular-nums text-slate-100">
          {h.produced}
          <span className="text-slate-500">/{h.meta == null ? "–" : Math.round(h.meta)}</span>
        </p>
        <p className={cn("text-2xl font-black tabular-nums", PERF_TEXT[lv])}>
          {h.pct == null ? "–" : `${Math.round(h.pct)}%`}
        </p>
      </div>
      {h.occurrence ? (
        <p className="mt-1 line-clamp-2 text-base font-semibold leading-tight text-red-400">
          {h.occurrence}
        </p>
      ) : null}
    </div>
  );
}


export function TelaColaboradores({
  slotLabel,
  cards,
  groupIndex,
  groupCount,
  isCelebrating,
  pastDateLabel,
}: {
  slotLabel: string;
  cards: EmployeeCardData[];
  groupIndex: number;
  groupCount: number;
  isCelebrating: (key: string) => boolean;
  pastDateLabel?: string | undefined;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-8">
      <header className="flex shrink-0 items-end justify-between pr-16">
        <div>
          <p className="text-xl font-semibold uppercase tracking-[0.3em] text-sky-400">
            Produtividade da hora
          </p>
          <h2 className="text-7xl font-black tracking-tight text-slate-50">{slotLabel}</h2>
          <div className="mt-2">
            <PastBadge label={pastDateLabel} />
          </div>
        </div>
        {groupCount > 1 ? (
          <div className="flex items-center gap-2">
            {Array.from({ length: groupCount }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === groupIndex ? "w-8 bg-sky-400" : "w-2 bg-slate-700",
                )}
              />
            ))}
          </div>
        ) : null}
      </header>


      {cards.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-3xl font-semibold text-slate-500">
          Nenhuma marcação nesta hora ainda
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-3 gap-6">
          {cards.map((c) => {
            const level = perfLevel(c.pct);
            const party = isCelebrating(c.key);
            return (
              <div
                key={c.key}
                className={cn(
                  "relative flex min-h-0 flex-col gap-5 overflow-hidden rounded-2xl border-2 bg-slate-900/70 p-6 transition-colors",
                  level === "ok"
                    ? "border-emerald-500/70"
                    : level === "near"
                      ? "border-amber-500/60"
                      : "border-red-500/50",
                )}
              >
                {party ? <Confetti /> : null}
                <div className="flex min-h-0 items-center gap-6">
                  <ProgressRing pct={c.pct} size={156} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-4xl font-bold leading-tight text-slate-50">
                      {c.name}
                    </p>
                    <p className="mt-2 line-clamp-2 text-xl text-slate-400">
                      {c.operations.join(" · ") || "—"}
                    </p>
                    <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-200">
                      {c.produced} <span className="text-base text-slate-500">peças</span>
                    </p>
                    {party ? (
                      <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-1.5 text-base font-bold text-emerald-300">
                        <PartyPopper className="h-5 w-5" /> Meta batida!
                      </p>
                    ) : null}
                  </div>
                </div>
                {c.hours.length > 0 ? (
                  <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-3 overflow-hidden">
                    {c.hours.map((h) => (
                      <HourBlock key={h.key} h={h} />
                    ))}
                  </div>
                ) : null}
              </div>

            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Tela B ---------------- */

export type SectorHourData = {
  key: string;
  label: string;
  meta: number;
  atingido: number;
  pct: number | null;
};

export type SectorScreenData = {
  key: string;
  sectorName: string;
  slotLabel: string;
  metaHora: number;
  atingido: number;
  pct: number | null;
  hours: SectorHourData[];
  products: {
    id: string;
    opInterna: string;
    meta: number;
    produced: number;
    pct: number;
  }[];
};


export function TelaSetor({
  data,
  isCelebrating,
  pastDateLabel,
  groupIndex = 0,
  groupCount = 1,
}: {
  data: SectorScreenData;
  isCelebrating: (key: string) => boolean;
  pastDateLabel?: string | undefined;
  groupIndex?: number;
  groupCount?: number;
}) {
  

  const party = isCelebrating(data.key);
  return (
    <div className="relative flex h-full min-h-0 flex-col gap-8 overflow-hidden">
      {party ? <Confetti /> : null}
      <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-8 pr-16">
        <div className="min-w-0">
          <p className="text-xl font-semibold uppercase tracking-[0.3em] text-sky-400">Setor</p>
          <h2 className="truncate text-7xl font-black uppercase tracking-tight text-slate-50">
            {data.sectorName}
          </h2>
          <p className="mt-2 text-2xl text-slate-400">Janela {data.slotLabel}</p>
          <div className="mt-2">
            <PastBadge label={pastDateLabel} />
          </div>
        </div>
        {groupCount > 1 ? (
          <div className="mb-2 flex shrink-0 items-center gap-3">
            {Array.from({ length: groupCount }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-3 rounded-full transition-all",
                  i === groupIndex ? "w-10 bg-sky-400" : "w-3 bg-slate-700",
                )}
              />
            ))}
          </div>
        ) : null}
      </header>


      <div className="flex min-h-0 shrink-0 items-center gap-10 rounded-2xl border-2 border-slate-800 bg-slate-900/70 p-7">
        <ProgressRing pct={data.pct} size={220} label="do período" />
        <div className="grid min-w-0 flex-1 auto-rows-fr grid-cols-3 gap-4">
          {data.hours.length === 0 ? (
            <p className="text-2xl text-slate-500">Nenhuma janela selecionada.</p>
          ) : (
            data.hours.map((h) => {
              const lv = perfLevel(h.pct);
              const res = h.atingido - h.meta;
              return (
                <div
                  key={h.key}
                  className={cn(
                    "min-h-0 rounded-xl border-2 p-5",
                    lv === "ok"
                      ? "border-emerald-500/60 bg-emerald-500/10"
                      : lv === "near"
                        ? "border-amber-500/60 bg-amber-500/10"
                        : "border-red-500/50 bg-red-500/10",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-3xl font-black text-slate-50">{h.label}</p>
                    <p className={cn("text-3xl font-black tabular-nums", PERF_TEXT[lv])}>
                      {h.pct == null ? "–" : Math.round(h.pct)}%
                    </p>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <MiniStat label="Meta" value={Math.round(h.meta)} tone="text-slate-100" />
                    <MiniStat label="Atingido" value={h.atingido} tone={PERF_TEXT[lv]} />
                    <div>
                      <p className="text-base uppercase tracking-widest text-slate-400">Resultado</p>
                      <p
                        className={cn(
                          "flex items-center gap-1 text-3xl font-black tabular-nums",
                          res >= 0 ? "text-emerald-400" : "text-red-400",
                        )}
                      >
                        {res >= 0 ? (
                          <ArrowUpRight className="h-6 w-6" />
                        ) : (
                          <ArrowDownRight className="h-6 w-6" />
                        )}
                        {res > 0 ? "+" : ""}
                        {Math.round(res)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(h.pct ?? 0, 100)}%`,
                        backgroundColor: PERF_COLOR[lv],
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>



      <div className="min-h-0 flex-1">
        <p className="mb-4 text-xl font-semibold uppercase tracking-[0.3em] text-slate-400">
          Metas do dia por OP interna
        </p>
        {data.products.length === 0 ? (
          <p className="text-2xl text-slate-500">Nenhuma meta cadastrada para hoje.</p>
        ) : (
          <div className="grid min-h-0 auto-rows-fr grid-cols-3 gap-5 overflow-hidden">
            {data.products.map((p) => {
              const lv = perfLevel(p.pct);
              return (
                <div
                  key={p.id}
                  className="min-h-0 rounded-2xl border-2 border-slate-800 bg-slate-900/70 p-5"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-3xl font-black text-slate-50">
                      OP {p.opInterna}
                    </p>
                    <p className={cn("text-3xl font-bold tabular-nums", PERF_TEXT[lv])}>
                      {Math.round(p.pct)}%
                    </p>
                  </div>
                  <p className="mt-2 text-2xl tabular-nums text-slate-300">
                    {p.produced} <span className="text-slate-500">/ {p.meta} peças</span>
                  </p>
                  <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(p.pct, 100)}%`,
                        backgroundColor: PERF_COLOR[lv],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <p className="text-base uppercase tracking-widest text-slate-400">{label}</p>
      <p className={cn("text-3xl font-black tabular-nums", tone)}>{value}</p>
    </div>
  );
}
