import { useCallback, useEffect, useState } from "react";
import { todayISO } from "@/lib/production";

export type ScreenConfig = {
  /** data dos dados exibidos (YYYY-MM-DD) */
  date: string;
  /** "current" = janela do horário atual; "custom" = janelas escolhidas */
  mode: "current" | "custom";
  /** horários de início das janelas escolhidas (modo custom) */
  slots: string[];
};

export type PainelPrefs = {
  telaAOn: boolean;
  sectorsOff: Record<string, boolean>;
  groupSize: number;
  groupSeconds: number;
  screenSeconds: number;
  soundOn: boolean;
  screens: Record<string, ScreenConfig>;
};

export const DEFAULT_SCREEN_CONFIG = (): ScreenConfig => ({
  date: todayISO(),
  mode: "current",
  slots: [],
});

const DEFAULTS = (): PainelPrefs => ({
  telaAOn: true,
  sectorsOff: {},
  groupSize: 6,
  groupSeconds: 7,
  screenSeconds: 15,
  soundOn: true,
  screens: {},
});

const KEY = "painel:prefs:v1";

/** Preferências do painel persistidas no navegador. */
export function usePainelPrefs() {
  const [prefs, setPrefs] = useState<PainelPrefs>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PainelPrefs>;
        setPrefs({ ...DEFAULTS(), ...parsed });
      }
    } catch {
      /* preferências inválidas: usa padrão */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* storage indisponível */
    }
  }, [prefs, loaded]);

  const update = useCallback(
    (patch: Partial<PainelPrefs>) => setPrefs((p) => ({ ...p, ...patch })),
    [],
  );

  const setScreen = useCallback(
    (id: string, patch: Partial<ScreenConfig>) =>
      setPrefs((p) => ({
        ...p,
        screens: {
          ...p.screens,
          [id]: { ...DEFAULT_SCREEN_CONFIG(), ...p.screens[id], ...patch },
        },
      })),
    [],
  );

  return { prefs, update, setScreen };
}

export const formatDateBR = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
