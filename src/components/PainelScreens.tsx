import { useEffect, useRef, useState, type ReactNode } from "react";
import { PERF_COLOR, PERF_TEXT, perfLevel } from "@/lib/painel";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, CalendarClock, PartyPopper } from "lucide-react";

/* ---------------- prévia em escala reduzida ---------------- */

const BASE_W = 1280;
const BASE_H = 720;

export function ScaledPreview({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / BASE_W));
    ro.observe(el);
    setScale(el.clientWidth / BASE_W);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="w-full overflow-hidden rounded-xl bg-slate-950"
      style={{ height: BASE_H * scale }}
    >
      <div
        className="p-8 text-slate-100"
        style={{
          width: BASE_W,
          height: BASE_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function PastBadge({ label }: { label?: string }) {
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
          <span className="mt-1 text-[10px] uppercase tracking-widest text-slate-400">
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------- Tela A ---------------- */

export type EmployeeCardData = {
  key: string;
  name: string;
  operations: string[];
  produced: number;
  pct: number | null;
};

export function TelaColaboradores({
  slotLabel,
  cards,
  groupIndex,
  groupCount,
  isCelebrating,
}: {
  slotLabel: string;
  cards: EmployeeCardData[];
  groupIndex: number;
  groupCount: number;
  isCelebrating: (key: string) => boolean;
}) {
  return (
    <div className="flex h-full flex-col gap-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-400">
            Produtividade da hora
          </p>
          <h2 className="text-5xl font-black tracking-tight text-slate-50">{slotLabel}</h2>
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
        <div className="grid flex-1 grid-cols-2 gap-5 xl:grid-cols-3">
          {cards.map((c) => {
            const level = perfLevel(c.pct);
            const party = isCelebrating(c.key);
            return (
              <div
                key={c.key}
                className={cn(
                  "relative flex items-center gap-5 overflow-hidden rounded-2xl border-2 bg-slate-900/70 p-5 transition-colors",
                  level === "ok"
                    ? "border-emerald-500/70"
                    : level === "near"
                      ? "border-amber-500/60"
                      : "border-red-500/50",
                )}
              >
                {party ? <Confetti /> : null}
                <ProgressRing pct={c.pct} size={130} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-3xl font-bold leading-tight text-slate-50">
                    {c.name}
                  </p>
                  <p className="mt-1 line-clamp-2 text-lg text-slate-400">
                    {c.operations.join(" · ") || "—"}
                  </p>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-slate-200">
                    {c.produced} <span className="text-sm text-slate-500">peças</span>
                  </p>
                  {party ? (
                    <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-bold text-emerald-300">
                      <PartyPopper className="h-4 w-4" /> Meta batida!
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Tela B ---------------- */

export type SectorScreenData = {
  key: string;
  sectorName: string;
  slotLabel: string;
  metaHora: number;
  atingido: number;
  pct: number | null;
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
}: {
  data: SectorScreenData;
  isCelebrating: (key: string) => boolean;
}) {
  const level = perfLevel(data.pct);
  const resultado = data.atingido - data.metaHora;
  const party = isCelebrating(data.key);
  return (
    <div className="relative flex h-full flex-col gap-6 overflow-hidden">
      {party ? <Confetti /> : null}
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-400">Setor</p>
        <h2 className="text-6xl font-black uppercase tracking-tight text-slate-50">
          {data.sectorName}
        </h2>
        <p className="mt-1 text-xl text-slate-400">Janela {data.slotLabel}</p>
      </header>

      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-8 rounded-2xl border-2 border-slate-800 bg-slate-900/70 p-6">
        <ProgressRing pct={data.pct} size={180} label="da hora" />
        <div className="grid grid-cols-3 gap-6">
          <Stat label="Meta da hora" value={Math.round(data.metaHora)} tone="text-slate-100" />
          <Stat label="Atingido" value={data.atingido} tone={PERF_TEXT[level]} />
          <div>
            <p className="text-sm uppercase tracking-widest text-slate-400">Resultado</p>
            <p
              className={cn(
                "flex items-center gap-2 text-6xl font-black tabular-nums",
                resultado >= 0 ? "text-emerald-400" : "text-red-400",
              )}
            >
              {resultado >= 0 ? (
                <ArrowUpRight className="h-10 w-10" />
              ) : (
                <ArrowDownRight className="h-10 w-10" />
              )}
              {resultado > 0 ? "+" : ""}
              {Math.round(resultado)}
            </p>
          </div>
          <div className="col-span-3">
            <div className="h-5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(data.pct ?? 0, 100)}%`,
                  backgroundColor: PERF_COLOR[level],
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
          Metas do dia por OP interna
        </p>
        {data.products.length === 0 ? (
          <p className="text-2xl text-slate-500">Nenhuma meta cadastrada para hoje.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
            {data.products.map((p) => {
              const lv = perfLevel(p.pct);
              return (
                <div
                  key={p.id}
                  className="rounded-2xl border-2 border-slate-800 bg-slate-900/70 p-4"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-2xl font-black text-slate-50">
                      OP {p.opInterna}
                    </p>
                    <p className={cn("text-2xl font-bold tabular-nums", PERF_TEXT[lv])}>
                      {Math.round(p.pct)}%
                    </p>
                  </div>
                  <p className="mt-1 text-lg tabular-nums text-slate-300">
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

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <p className="text-sm uppercase tracking-widest text-slate-400">{label}</p>
      <p className={cn("text-6xl font-black tabular-nums", tone)}>{value}</p>
    </div>
  );
}
