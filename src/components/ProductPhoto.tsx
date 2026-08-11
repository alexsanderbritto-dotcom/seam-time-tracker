import { useQuery } from "@tanstack/react-query";
import { FileText, Eye, X, ImageOff, ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect, useRef, useState } from "react";


export function useSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["signed-url", path],
    enabled: !!path,
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<string | null> => {
      if (!path) return null;
      const { data, error } = await db.storage
        .from("product-files")
        .createSignedUrl(path, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

const isImage = (path: string) => /\.(png|jpe?g|webp|gif|avif)$/i.test(path);

export function ProductPhotoCell({ path, title }: { path: string | null; title: string }) {
  const [open, setOpen] = useState(false);
  const { data: url } = useSignedUrl(path);

  if (!path) return <span className="text-muted-foreground">—</span>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative flex h-14 w-14 items-center justify-center md:h-10 md:w-10 justify-center overflow-hidden rounded-md border border-border bg-muted"
        aria-label={`Visualizar ficha de ${title}`}
      >
        {url && isImage(path) ? (
          <img src={url} alt={`Ficha do produto ${title}`} className="h-full w-full object-cover" />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="absolute inset-0 hidden items-center justify-center bg-foreground/50 group-hover:flex">
          <Eye className="h-4 w-4 text-background" />
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Ficha · {title}</DialogTitle>
          </DialogHeader>
          {url ? (
            isImage(path) ? (
              <img
                src={url}
                alt={`Ficha do produto ${title}`}
                className="max-h-[70vh] w-full rounded-md object-contain"
              />
            ) : (
              <iframe src={url} title={`Ficha do produto ${title}`} className="h-[70vh] w-full rounded-md" />
            )
          ) : (
            <p className="text-sm text-muted-foreground">Carregando arquivo…</p>
          )}
          {url ? (
            <Button variant="outline" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                Abrir em nova aba
              </a>
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PilotThumb({
  path,
  title,
  onRemove,
}: {
  path: string;
  title: string;
  onRemove?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const { data: url } = useSignedUrl(path);

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border border-border bg-muted"
          aria-label={`Visualizar foto da peça piloto de ${title}`}
        >
          {url ? (
            <img src={url} alt={`Peça piloto de ${title}`} className="h-full w-full object-cover" />
          ) : (
            <FileText className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="absolute inset-0 hidden items-center justify-center bg-foreground/50 group-hover:flex">
            <Eye className="h-4 w-4 text-background" />
          </span>
        </button>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remover foto"
            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-xs text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Peça piloto · {title}</DialogTitle>
          </DialogHeader>
          {url ? (
            <img
              src={url}
              alt={`Peça piloto de ${title}`}
              className="max-h-[70vh] w-full rounded-md object-contain"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Carregando imagem…</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PilotGallery({
  paths,
  title,
  onRemove,
}: {
  paths: string[];
  title: string;
  onRemove?: (path: string) => void;
}) {
  if (paths.length === 0)
    return <p className="text-xs text-muted-foreground">Nenhuma foto da peça piloto.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {paths.map((p) => (
        <PilotThumb
          key={p}
          path={p}
          title={title}
          onRemove={onRemove ? () => onRemove(p) : undefined}
        />
      ))}
    </div>
  );
}

function PilotSlide({ path, title }: { path: string; title: string }) {
  const { data: url } = useSignedUrl(path);
  if (!url) return <p className="text-sm text-muted-foreground">Carregando imagem…</p>;
  return (
    <img
      src={url}
      alt={`Peça piloto de ${title}`}
      className="max-h-[70vh] w-full rounded-md object-contain"
      draggable={false}
    />
  );
}

export function PilotPhotoCell({ paths, title }: { paths: string[]; title: string }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const first = paths[0];
  const { data: thumbUrl } = useSignedUrl(first);
  const count = paths.length;

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);

  if (count === 0) {
    return (
      <div
        className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed md:h-10 md:w-10 border-border bg-muted/40"
        aria-label="Sem foto de peça piloto"
        title="Sem foto de peça piloto"
      >
        <ImageOff className="h-4 w-4 text-muted-foreground/60" />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative flex h-14 w-14 items-center justify-center md:h-10 md:w-10 justify-center overflow-hidden rounded-md border border-border bg-muted"
        aria-label={`Visualizar fotos da peça piloto de ${title}`}
      >
        {thumbUrl ? (
          <img src={thumbUrl} alt={`Peça piloto de ${title}`} className="h-full w-full object-cover" />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground" />
        )}
        {count > 1 ? (
          <span className="absolute bottom-0 right-0 rounded-tl bg-foreground/70 px-1 text-[10px] leading-tight text-background">
            {count}
          </span>
        ) : null}
        <span className="absolute inset-0 hidden items-center justify-center bg-foreground/50 group-hover:flex">
          <Eye className="h-4 w-4 text-background" />
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Peça piloto · {title}</DialogTitle>
          </DialogHeader>
          <div
            className="relative"
            onKeyDown={(e) => {
              if (count < 2) return;
              if (e.key === "ArrowRight") go(1);
              if (e.key === "ArrowLeft") go(-1);
            }}
            onTouchStart={(e) => {
              touchX.current = e.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
              if (touchX.current === null || count < 2) return;
              const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX.current;
              if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
              touchX.current = null;
            }}
            tabIndex={0}
          >
            <PilotSlide path={paths[index] ?? paths[0]!} title={title} />
            {count > 1 ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  aria-label="Foto anterior"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full opacity-90"
                  onClick={() => go(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  aria-label="Próxima foto"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full opacity-90"
                  onClick={() => go(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            ) : null}
          </div>
          {count > 1 ? (
            <p className="text-center text-sm text-muted-foreground">
              {index + 1} de {count}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
