import { useQuery } from "@tanstack/react-query";
import { FileText, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

export function useSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["signed-url", path],
    enabled: !!path,
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<string | null> => {
      if (!path) return null;
      const { data, error } = await supabase.storage
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
        className="group relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border border-border bg-muted"
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
  onRemove?: () => void;
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
