"use client";

import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function CatalogDescriptionDialog({
  title, description, code,
}: { title: string; description: string; code?: string }) {
  return (
    <Dialog>
      <DialogTrigger aria-label={code ? `Ver descrição completa do item ${code}` : `Ver descrição completa de ${title}`} className="inline-flex min-h-9 items-center text-sm font-semibold text-[var(--p-color-brand-500)] underline decoration-transparent underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2">
        Ver descrição completa
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-hidden text-[var(--p-color-fg)] shadow-xl sm:max-w-2xl" style={{ backgroundColor: "var(--p-color-bg-elevated, #fff)" }} showCloseButton={false}>
        <DialogHeader className="min-w-0">
          <DialogTitle className="break-words text-lg leading-6">Descrição completa</DialogTitle>
          <DialogDescription className="line-clamp-2 break-words">
            {code ? `Código ${code} · ` : ""}{title}
          </DialogDescription>
        </DialogHeader>
        <div tabIndex={0} aria-label="Texto completo do item" className="max-h-[55dvh] overflow-y-auto overscroll-contain rounded-lg border border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)] p-4 focus-visible:outline-2">
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[var(--p-color-fg)] [overflow-wrap:anywhere]">{description || "Descrição não informada."}</p>
        </div>
        <div className="flex justify-end">
          <DialogClose render={<Button variant="outline" />}>Fechar descrição</DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
