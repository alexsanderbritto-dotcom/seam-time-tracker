import { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type SearchableOption = {
  value: string;
  label: string;
  /** extra text used for matching (ex: OP interna) */
  searchText?: string;
  /** sempre visível, mesmo sem termo de busca (ex: "Todos") */
  alwaysShow?: boolean;

  /** custom rendering inside the list */
  node?: ReactNode;
  /** custom rendering in the trigger when selected */
  triggerNode?: ReactNode;
};

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum resultado encontrado.",
  disabled = false,
  searchOnly = false,
  searchHint = "Digite para buscar...",
}: {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  /** não lista opções até o usuário digitar */
  searchOnly?: boolean;
  searchHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  const term = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!term) return searchOnly ? [] : options;
    return options.filter((o) =>
      `${o.label} ${o.searchText ?? ""}`.toLowerCase().includes(term),
    );
  }, [options, term, searchOnly]);


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-11 w-full justify-between px-3 text-base font-normal md:h-10 md:text-sm"
          disabled={disabled}
        >
          <span className="min-w-0 truncate text-left">
            {selected ? (selected.triggerNode ?? selected.label) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[45vh]">
            {filtered.length === 0 ? (
              <CommandEmpty>{searchOnly && !term ? searchHint : emptyMessage}</CommandEmpty>

            ) : (
              <CommandGroup>
                {filtered.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={o.value}
                    className="min-h-11 py-2.5 text-base md:min-h-0 md:py-1.5 md:text-sm"
                    onSelect={() => {
                      onChange(o.value);
                      setSearch("");
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === o.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">{o.node ?? o.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
