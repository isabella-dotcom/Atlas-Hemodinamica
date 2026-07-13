import { normalizePersonName } from "@/lib/utils";

export function normalizeCrmNumber(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizeCnpj(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizeUf(value: string): string {
  return value.trim().toUpperCase().slice(0, 2);
}

export function confidenceBand(score: number): string {
  if (score < 40) return "Baixa confiança";
  if (score < 60) return "Precisa de validação";
  if (score < 80) return "Confiança moderada";
  return "Alta confiança";
}

export function buildDoctorNormalizedName(fullName: string): string {
  return normalizePersonName(fullName);
}

export function maskContactValue(
  value: string,
  channel: string,
  restricted: boolean,
): string {
  if (!restricted) return value;
  if (channel === "email") {
    const [user, domain] = value.split("@");
    if (!domain) return "***";
    return `${(user ?? "").slice(0, 1)}***@${domain}`;
  }
  if (value.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

export function parsePage(value: string | undefined, fallback = 1): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function parsePageSize(value: string | undefined, fallback = 20): number {
  const allowed = [10, 20, 50, 100];
  const n = Number(value);
  return allowed.includes(n) ? n : fallback;
}

export function toBoolParam(value: string | undefined): boolean | null {
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return null;
}
