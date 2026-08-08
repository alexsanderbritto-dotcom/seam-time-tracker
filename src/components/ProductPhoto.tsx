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
