import Papa from "papaparse";
import * as XLSX from "xlsx";

export type ParsedTabular = {
  headers: string[];
  rows: Record<string, string>[];
  encoding: string;
  delimiter: string;
  rowCount: number;
};

function cellsToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return String(value);
}

/** Preserva zeros à esquerda — nunca converte CRM/CNES para number. */
export function parseCsvText(text: string): ParsedTabular {
  const detected = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  const headers = detected.meta.fields ?? [];
  const rows = (detected.data ?? []).map((row) => {
    const out: Record<string, string> = {};
    for (const key of headers) {
      out[key] = cellsToString(row[key]).trim();
    }
    return out;
  });
  return {
    headers,
    rows,
    encoding: "utf-8",
    delimiter: detected.meta.delimiter || ",",
    rowCount: rows.length,
  };
}

export async function parseTabularFile(file: File): Promise<ParsedTabular> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", raw: false, cellDates: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { headers: [], rows: [], encoding: "binary", delimiter: "", rowCount: 0 };
    }
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });
    const headers =
      json.length > 0
        ? Object.keys(json[0]!)
        : (XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] as string[]) ?? [];
    const rows = json.map((row) => {
      const out: Record<string, string> = {};
      for (const key of headers) {
        out[key] = cellsToString(row[key]).trim();
      }
      return out;
    });
    return {
      headers,
      rows,
      encoding: "xlsx",
      delimiter: "",
      rowCount: rows.length,
    };
  }

  const text = await file.text();
  return parseCsvText(text);
}

export async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function applyColumnMapping(
  row: Record<string, string>,
  mapping: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [target, source] of Object.entries(mapping)) {
    if (!source) continue;
    out[target] = row[source] ?? "";
  }
  return out;
}

export function parseBool(value: string | undefined): boolean | null {
  if (value == null || value.trim() === "") return null;
  const v = value.trim().toLowerCase();
  if (["1", "true", "sim", "yes", "s"].includes(v)) return true;
  if (["0", "false", "nao", "não", "no", "n"].includes(v)) return false;
  return null;
}
