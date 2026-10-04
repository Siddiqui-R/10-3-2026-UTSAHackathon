import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { CSSProperties } from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Stagger index for the page-load reveal (see .reveal in globals.css). */
export function at(i: number) {
  return { "--i": i } as CSSProperties;
}
