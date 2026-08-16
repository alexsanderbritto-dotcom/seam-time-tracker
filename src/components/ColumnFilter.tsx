import { useMemo, useState } from "react";
import { Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ColumnFilterState = Record<string, string[]>;

export const EMPTY_LABEL = "(vazio)";

export const valueOf = (v: string | null | undefined) =>
  v && String(v).trim() ? String(v) : EMPTY_LABEL;

/** aplica todos os filtros de coluna combinados (E lógico), estilo Excel */
export function applyColumnFilters<T>(
  rows: T[],
  filters: ColumnFilterState,
  accessors: Record<string, (row: T) => string | null | undefined>,
): T[] {
  const active = Object.entries(filters).filter(([, vals]) => vals.length > 0);
  if (active.length === 0) return rows;
  return rows.filter((row) =>
    active.every(([col, vals]) => {
      const get = accessors[col];
      if (!get) return true;
      return vals.includes(valueOf(get(row)));
    }),
  );
}

export function ColumnFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return options.filter((o) => !q || o.toLowerCase().includes(q));
  }, [options, search]);

  const active = selected.length > 0;
  const toggle = (value: string, checked: boolean) =>
    onChange(checked ? [...selected, value] : selected.filter((v) => v !== value));

  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Filtrar ${label}`}
            className={cn(
              "rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground",
              active && "bg-primary/15 text-primary",
            )}
          >
            <Filter className={cn("h-3.5 w-3.5", active && "fill-current")} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-60 p-2">
          <Input
            placeholder="Buscar…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2 h-8"
          />
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {list.length === 0 ? (
              <p className="px-1 py-3 text-center text-xs text-muted-foreground">
                Nenhum valor.
              </p>
            ) : (
              list.map((o) => (
                <label
                  key={o}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted"
                >
                  <Checkbox
                    checked={selected.includes(o)}
                    onCheckedChange={(v) => toggle(o, v === true)}
                  />
                  <span className="truncate">{o}</span>
                </label>
              ))
            )}
          </div>
          <div className="mt-2 flex justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onChange([])}
            >
              Limpar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onChange(list)}
            >
              Selecionar todos
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </span>
  );
}
