import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Envolve qualquer botão de exclusão com uma confirmação, evitando exclusões acidentais.
 */
export function ConfirmDelete({
  title = "Confirmar exclusão",
  description,
  confirmLabel = "Excluir",
  onConfirm,
  children,
}: {
  title?: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  children: ReactNode;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 sm:h-9">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:h-9"
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
