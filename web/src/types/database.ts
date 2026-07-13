export type AppRole = "master" | "analista" | "visualizador";

export type DoctorClassification =
  | "possivel_candidato"
  | "atuacao_provavel"
  | "atuacao_institucional_confirmada"
  | "especialista_confirmado"
  | "rejeitado"
  | "inativo";

export type ValidationStatus =
  | "nao_iniciada"
  | "em_revisao"
  | "parcialmente_validada"
  | "validada"
  | "rejeitada"
  | "aguardando_informacao";

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

export type EvidenceStatus =
  | "pendente"
  | "aceita"
  | "rejeitada"
  | "expirada"
  | "necessita_revisao";

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
  validation_status: ValidationStatus;
  layer: RecordLayer;
  confidence_score: number;
  city: string | null;
  state_uf: string | null;
  notes: string | null;
  last_validated_at: string | null;
  last_validated_by: string | null;
  is_deleted: boolean;
  archived_at: string | null;
  archived_by: string | null;
  archive_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DoctorSearchRow extends Doctor {
  primary_crm: string | null;
  primary_crm_uf: string | null;
  primary_rqe: string | null;
  primary_specialty: string | null;
  primary_facility: string | null;
  links_count: number;
  has_contact: boolean;
  total_count: number;
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

export interface DoctorSpecialty {
  id: string;
  doctor_id: string;
  specialty_id: string;
  source_id: string | null;
  is_confirmed: boolean;
  is_primary: boolean;
  confidence_score: number;
  last_validated_at: string | null;
  last_validated_by: string | null;
  created_at: string;
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
  service_status: string | null;
  layer: RecordLayer;
  confidence_score: number;
  source_id: string | null;
  notes: string | null;
  last_validated_at: string | null;
  last_validated_by: string | null;
  is_deleted: boolean;
  archived_at: string | null;
  archived_by: string | null;
  archive_reason: string | null;
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
  relationship_type: string | null;
  is_coordinator: boolean;
  is_technical_responsible: boolean;
  coordinator_justification: string | null;
  coordinator_confirmed: boolean;
  status: LinkStatus;
  started_on: string | null;
  ended_on: string | null;
  source_id: string | null;
  confidence_score: number;
  last_validated_at: string | null;
  last_validated_by: string | null;
  notes: string | null;
  layer: RecordLayer;
  is_deleted: boolean;
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
  is_publicly_available: boolean;
  is_primary: boolean;
  do_not_contact: boolean;
  source_id: string | null;
  confidence_score: number;
  last_validated_at: string | null;
  last_validated_by: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Evidence {
  id: string;
  entity_type: EvidenceEntity;
  entity_id: string;
  source_id: string | null;
  title: string;
  description: string | null;
  url: string | null;
  collected_at: string | null;
  storage_path: string | null;
  status: EvidenceStatus;
  confirmed_field: string | null;
  captured_value: string | null;
  reliability_score: number | null;
  rejection_reason: string | null;
  validated_by: string | null;
  validated_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ReviewQueueItem {
  id: string;
  doctor_id: string | null;
  facility_id: string | null;
  link_id: string | null;
  status: ReviewStatus;
  priority: number;
  review_type: string | null;
  origin: string | null;
  reason: string | null;
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

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface DashboardStats {
  totalMedicos: number;
  candidatos: number;
  emRevisao: number;
  parcialmenteValidados: number;
  validados: number;
  especialistasConfirmados: number;
  estabelecimentosAtivos: number;
  estabelecimentosHemo: number;
  vinculosAtivos: number;
  contatosDisponiveis: number;
  evidenciasPendentes: number;
  pendenciasValidacao: number;
  semCrm: number;
  semVinculo: number;
  semEvidencia: number;
  baixaConfianca: number;
  vinculosSemValidacaoRecente: number;
  hemoSemMedicos: number;
  porEstado: { state_uf: string; total: number }[];
}

export interface ConfidenceExplanation {
  score: number;
  band: "baixa" | "precisa_validacao" | "moderada" | "alta";
  components: {
    crm: number;
    rqe: number;
    links: number;
    evidences: number;
    contacts: number;
    penalties: number;
  };
  calculated_at: string;
  human_decision_required: boolean;
  note: string;
}

export const CLASSIFICATION_LABELS: Record<DoctorClassification, string> = {
  possivel_candidato: "Possível candidato",
  atuacao_provavel: "Atuação provável",
  atuacao_institucional_confirmada: "Atuação institucional confirmada",
  especialista_confirmado: "Especialista confirmado",
  rejeitado: "Rejeitado",
  inativo: "Inativo",
};

export const VALIDATION_STATUS_LABELS: Record<ValidationStatus, string> = {
  nao_iniciada: "Não iniciada",
  em_revisao: "Em revisão",
  parcialmente_validada: "Parcialmente validada",
  validada: "Validada",
  rejeitada: "Rejeitada",
  aguardando_informacao: "Aguardando informação",
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

export const EVIDENCE_STATUS_LABELS: Record<EvidenceStatus, string> = {
  pendente: "Pendente",
  aceita: "Aceita",
  rejeitada: "Rejeitada",
  expirada: "Expirada",
  necessita_revisao: "Necessita revisão",
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pendente: "Pendente",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  nova_revisao: "Nova revisão",
};
