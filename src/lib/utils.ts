import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Picks the readable text color (black or white) for a given background
 * color, based on relative luminance (WCAG-style YIQ approximation).
 * @param hexColor a hex color string, e.g. "#ffcc00" (with or without alpha)
 * @returns "#000000" for light backgrounds, "#ffffff" for dark backgrounds
 */
export function getContrastingTextColor(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

