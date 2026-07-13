import type { AppRole, UsersProfile } from "@/types/database";

export function canWrite(role: AppRole | null | undefined): boolean {
  return role === "master" || role === "analista";
}

export function isMaster(role: AppRole | null | undefined): boolean {
  return role === "master";
}

export function canViewAudit(role: AppRole | null | undefined): boolean {
  return role === "master" || role === "analista";
}

export function canManageUsers(role: AppRole | null | undefined): boolean {
  return role === "master";
}

export function canAccessRawData(role: AppRole | null | undefined): boolean {
  return role === "master" || role === "analista";
}

export function assertCanWrite(profile: UsersProfile | null): string | null {
  if (!profile || !profile.is_active) {
    return "Sessão inválida ou usuário inativo.";
  }
  if (!canWrite(profile.role)) {
    return "Você não possui permissão para editar este registro.";
  }
  return null;
}

export function assertMaster(profile: UsersProfile | null): string | null {
  if (!profile || !profile.is_active) {
    return "Sessão inválida ou usuário inativo.";
  }
  if (!isMaster(profile.role)) {
    return "Acesso restrito a Master.";
  }
  return null;
}
