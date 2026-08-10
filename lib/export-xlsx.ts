import * as XLSX from "xlsx";

/**
 * Real .xlsx workbook export via SheetJS (the "xlsx" package) -- a proper
 * native spreadsheet (multiple named sheets, sized columns) rather than a
 * CSV, so it's easier to open and analyze directly in Excel. Client-only:
 * XLSX.writeFile triggers the browser download itself, so only call this
 * from "use client" components.
 */

export type SheetCell = string | number | boolean | null | undefined;

export interface ExportSheet {
  /** Sheet tab name -- Excel caps this at 31 characters and disallows : \ / ? * [ ] */
  name: string;
  rows: SheetCell[][];
}

function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, " ").trim();
  return (cleaned || "Sheet1").slice(0, 31);
}

/** Rough auto-width per column based on the longest cell, capped so one huge cell doesn't blow out the sheet. */
function columnWidths(rows: SheetCell[][]): { wch: number }[] {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, i) => {
      const len = cell === null || cell === undefined ? 0 : String(cell).length;
      widths[i] = Math.max(widths[i] ?? 8, Math.min(len + 2, 60));
    });
  }
  return widths.map((wch) => ({ wch }));
}

/** Filesystem-safe filename fragment from arbitrary title text. */
export function slugifyFilename(title: string): string {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "export";
}

export function downloadXlsx(filename: string, sheets: ExportSheet[]) {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
    worksheet["!cols"] = columnWidths(sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(sheet.name));
  }

  XLSX.writeFile(workbook, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
