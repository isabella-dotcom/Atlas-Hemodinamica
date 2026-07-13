export type AppRole = "master" | "analista" | "visualizador";

export type DoctorClassification =
  | "possivel_candidato"
  | "atuacao_provavel"
  | "atuacao_institucional_confirmada"
  | "especialista_confirmado"
  | "rejeitado"
  | "inativo";

export type RecordLayer = "bruto" | "candidato" | "oficial";

export type CrmStatus =
  | "ativo"
  | "inativo"
  | "suspenso"
  | "cancelado"
  | "desconhecido";

export type LinkStatus = "ativo" | "encerrado" | "provisorio" | "desconhecido";

export type ReviewStatus =
  | "pendente"
  | "em_analise"
  | "aprovado"
  | "rejeitado"
  | "nova_revisao";

export type ImportStatus =
  | "recebido"
  | "processando"
  | "preview"
  | "confirmado"
  | "erro"
  | "cancelado";

export type ContactChannel =
  | "email"
  | "telefone"
  | "whatsapp"
  | "site"
  | "outro";

export type EvidenceEntity =
  | "doctor"
  | "facility"
  | "link"
  | "contact"
  | "registration"
  | "specialty";

export interface UsersProfile {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Doctor {
  id: string;
  full_name: string;
  normalized_name: string;
  classification: DoctorClassification;
  layer: RecordLayer;
  confidence_score: number;
  city: string | null;
  state_uf: string | null;
  notes: string | null;
  last_validated_at: string | null;
  last_validated_by: string | null;
  is_deleted: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MedicalRegistration {
  id: string;
  doctor_id: string;
  registration_type: "CRM" | "RQE";
  number: string;
  state_uf: string;
  status: CrmStatus;
  specialty_id: string | null;
  source_id: string | null;
  confidence_score: number;
  last_validated_at: string | null;
  last_validated_by: string | null;
  notes: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface HealthFacility {
  id: string;
  name: string;
  trade_name: string | null;
  cnes: string | null;
  cnpj: string | null;
  facility_type: string | null;
  city: string;
  state_uf: string;
  address_street: string | null;
  address_number: string | null;
  address_district: string | null;
  address_zip: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  attends_sus: boolean | null;
  has_hemodynamics: boolean;
  layer: RecordLayer;
  confidence_score: number;
  source_id: string | null;
  notes: string | null;
  last_validated_at: string | null;
  last_validated_by: string | null;
  is_deleted: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DoctorFacilityLink {
  id: string;
  doctor_id: string;
  facility_id: string;
  role_title: string | null;
  department: string | null;
  is_coordinator: boolean;
  status: LinkStatus;
  started_on: string | null;
  ended_on: string | null;
  source_id: string | null;
  confidence_score: number;
  last_validated_at: string | null;
  last_validated_by: string | null;
  notes: string | null;
  layer: RecordLayer;
  created_at: string;
  updated_at: string;
}

export interface ProfessionalContact {
  id: string;
  doctor_id: string | null;
  facility_id: string | null;
  channel: ContactChannel;
  value: string;
  label: string | null;
  is_institutional: boolean;
  source_id: string | null;
  confidence_score: number;
  last_validated_at: string | null;
  last_validated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewQueueItem {
  id: string;
  doctor_id: string | null;
  facility_id: string | null;
  link_id: string | null;
  status: ReviewStatus;
  priority: number;
  duplicate_of_doctor_id: string | null;
  assigned_to: string | null;
  notes: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DataSource {
  id: string;
  code: string;
  name: string;
  description: string | null;
  url: string | null;
  reliability_score: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Specialty {
  id: string;
  code: string | null;
  name: string;
  is_hemodynamics_related: boolean;
  created_at: string;
}

export interface DashboardStats {
  candidatos: number;
  validados: number;
  crmsConfirmados: number;
  rqesConfirmados: number;
  estabelecimentosHemo: number;
  contatosDisponiveis: number;
  pendenciasValidacao: number;
  porEstado: { state_uf: string; total: number }[];
}

export const CLASSIFICATION_LABELS: Record<DoctorClassification, string> = {
  possivel_candidato: "Possível candidato",
  atuacao_provavel: "Atuação provável",
  atuacao_institucional_confirmada: "Atuação institucional confirmada",
  especialista_confirmado: "Especialista confirmado",
  rejeitado: "Rejeitado",
  inativo: "Inativo",
};

export const LAYER_LABELS: Record<RecordLayer, string> = {
  bruto: "Bruto",
  candidato: "Candidato",
  oficial: "Oficial",
};

export const ROLE_LABELS: Record<AppRole, string> = {
  master: "Master",
  analista: "Analista",
  visualizador: "Visualizador",
};
