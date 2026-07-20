import { normalizePersonName } from "@/lib/utils";

/**
 * Normaliza CRM/RQE: remove pontuação, preserva dígitos (incluindo zeros à esquerda).
 */
export function normalizeCrmNumber(value: string): string {
  return value.replace(/\D/g, "");
}

/** Extrai apenas dígitos do telefone (formato armazenado). */
export function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Exibe telefone BR de forma amigável sem alterar o valor persistido. */
export function formatPhoneDisplay(value: string | null | undefined): string {
  if (!value) return "";
  const digits = normalizePhoneDigits(value);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return value;
}

/** Máscara de input de telefone (apenas UI). */
export function maskPhoneInput(value: string): string {
  const digits = normalizePhoneDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
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
