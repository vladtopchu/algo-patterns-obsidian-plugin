import { normalizePath } from "obsidian";

export const DEFAULT_DATA_FOLDER = "_algo_patterns";
export const LEGACY_DATA_FOLDER = "Algo Patterns";

export function dataFolderPath(value: string): string {
  const path = value.trim().replace(/\\/g, "/");
  const parts = path.split("/");
  if (
    !path ||
    parts.some(
      (part) =>
        !part ||
        part.startsWith(".") ||
        part !== part.trim() ||
        /[<>:"|?*\x00-\x1f]/.test(part) ||
        part.endsWith(".") ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
    )
  ) {
    throw new Error(
      "Укажите относительную папку внутри vault, например _algo_patterns или Учёба/Алгоритмы. Скрытые и системные пути недоступны.",
    );
  }
  return normalizePath(path);
}
