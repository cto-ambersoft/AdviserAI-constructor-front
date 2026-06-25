import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Locale date-time, or "—" when absent; passes through unparseable strings. */
export function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "—"
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}
