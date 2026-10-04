"use client";
import { Toaster as Sonner } from "sonner";

// Confirmations ("Contact saved", "History cleared") in large, high-contrast text. Toasts are announced to screen readers.
export function Toaster() {
  return <Sonner position="top-center" richColors closeButton duration={5000} visibleToasts={3}
    toastOptions={{ classNames: { toast: "font-sans !text-lg !rounded-xl !border-2 !p-4 !gap-3", title: "!text-lg !font-bold", description: "!text-base" } }} />;
}
