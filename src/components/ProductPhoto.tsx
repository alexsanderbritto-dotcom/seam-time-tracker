import { useQuery } from "@tanstack/react-query";
import { FileText, Eye, ImageOff } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

/**
 * A URL assinada só é buscada quando `enabled` fica verdadeiro (após o clique),
 * evitando carregar imagens que o usuário talvez nem abra.
 */
export function useSignedUrl(path: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["signed-url", path],
    enabled: !!path && enabled,
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<string | null> => {
      if (!path) return null;
      const { data, error } = await db.storage
        .from("product-files")
        .createSignedUrl(path, 60 * 60);
      if (error) throw error;
      return data?.signedUrl ?? null;
    },
  });
}

const isImage = (path: string) => /\.(png|jpe?g|webp|gif|avif)$/i.test(path);

export function ProductPhotoCell({ path, title }: { path: string | null; title: string }) {
  const [open, setOpen] = useState(false);
  // carregamento sob demanda: só busca o arquivo depois do clique
  const { data: url, isFetching } = useSignedUrl(path, open);

  if (!path)
    return (
      <div
        className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-border bg-muted/40 md:h-10 md:w-10"
        aria-label="Sem ficha"
        title="Sem ficha"
      >
        <ImageOff className="h-4 w-4 text-muted-foreground/60" />
      </div>
    );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-md border border-border bg-muted md:h-10 md:w-10"
        aria-label={`Visualizar ficha de ${title}`}
        title="Clique para carregar a ficha"
      >
        <FileText className="h-4 w-4 text-muted-foreground" />
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
            <p className="text-sm text-muted-foreground">
              {isFetching ? "Carregando arquivo…" : "Arquivo indisponível."}
            </p>
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
