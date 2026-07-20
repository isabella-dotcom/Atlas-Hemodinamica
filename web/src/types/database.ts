export type AppRole = "master" | "analista" | "visualizador";

export type DoctorClassification =
  | "possivel_candidato"
  | "atuacao_provavel"
  | "atuacao_institucional_confirmada"
  | "especialista_confirmado"
  | "rejeitado"
  | "inativo"
  | "falecido"
  | "registro_duplicado";

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

export type RegistrationVerificationStatus =
  | "nao_verificado"
  | "em_verificacao"
  | "verificado"
  | "divergente"
  | "invalido";

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
  | "celular"
  | "whatsapp"
  | "site"
  | "secretaria"
  | "formulario"
  | "linkedin"
  | "outro";

export type ContactStatus =
  | "nao_validado"
  | "valido"
  | "invalido"
  | "desatualizado";

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

export type OwnershipType = "publico" | "privado" | "filantropico" | "misto";
export type BranchType = "matriz" | "filial" | "unico";
export type SexCode = "F" | "M" | "X" | "NI";

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
  social_name: string | null;
  sex: SexCode | null;
  /** Carregado apenas para master/analista (tabela doctor_sensitive_fields). */
  birth_date: string | null;
  nationality: string | null;
  photo_path: string | null;
  biography: string | null;
  classification: DoctorClassification;
  validation_status: ValidationStatus;
  layer: RecordLayer;
  confidence_score: number;
  city: string | null;
  state_uf: string | null;
  notes: string | null;
  declared_practice_area: string | null;
  confirmed_practice_area: string | null;
  practice_keywords: string[];
  graduation_institution: string | null;
  graduation_year: number | null;
  residency: string | null;
  specialization: string | null;
  fellowships: string[];
  masters_degree: string | null;
  doctorate_degree: string | null;
  professional_titles: string[];
  medical_societies: string[];
  is_sbhci_member: boolean | null;
  lattes_url: string | null;
  orcid: string | null;
  scientific_identifiers: Record<string, unknown>;
  is_demo: boolean;
  last_validated_at: string | null;
  last_validated_by: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  archived_at: string | null;
  archived_by: string | null;
  archive_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DoctorSearchRow {
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
  created_at: string;
  updated_at: string;
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
  inscription_type: string | null;
  consulted_at: string | null;
  verified_at: string | null;
  verification_status: RegistrationVerificationStatus;
  registration_details: string | null;
  rqe_area: string | null;
  rqe_status: string | null;
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
  normalized_name: string | null;
  cnes: string | null;
  cnpj: string | null;
  facility_type: string | null;
  legal_nature: string | null;
  ownership_type: OwnershipType | null;
  branch_type: BranchType | null;
  is_active: boolean;
  city: string;
  state_uf: string;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_zip: string | null;
  ibge_city_code: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  hemodynamics_phone: string | null;
  institutional_whatsapp: string | null;
  hemodynamics_email: string | null;
  secretary_contact: string | null;
  service_manager_contact: string | null;
  attends_sus: boolean | null;
  attends_private: boolean | null;
  attends_insurance: boolean | null;
  has_hemodynamics: boolean;
  has_catheterization_lab: boolean | null;
  has_interventional_cardiology: boolean | null;
  has_interventional_radiology: boolean | null;
  has_interventional_neuroradiology: boolean | null;
  is_24_hours: boolean | null;
  has_emergency_service: boolean | null;
  estimated_rooms: number | null;
  estimated_equipment: number | null;
  procedures: string | null;
  service_notes: string | null;
  last_service_confirmed_at: string | null;
  service_status: string | null;
  layer: RecordLayer;
  confidence_score: number;
  source_id: string | null;
  notes: string | null;
  is_demo: boolean;
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
  function_title: string | null;
  department: string | null;
  practiced_specialty: string | null;
  relationship_type: string | null;
  is_coordinator: boolean;
  is_team_leader: boolean;
  is_technical_responsible: boolean;
  is_clinical_staff: boolean;
  coordinator_justification: string | null;
  coordinator_confirmed: boolean;
  weekly_hours: number | null;
  is_sus_link: boolean | null;
  evidence_id: string | null;
  status: LinkStatus;
  started_on: string | null;
  ended_on: string | null;
  source_id: string | null;
  confidence_score: number;
  last_validated_at: string | null;
  last_validated_by: string | null;
  last_verified_at: string | null;
  verified_by: string | null;
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
  contact_status: ContactStatus;
  accepts_contact: boolean | null;
  source_origin: string | null;
  collected_at: string | null;
  last_attempt_at: string | null;
  last_attempt_result: string | null;
  verified_at: string | null;
  verified_by: string | null;
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

export interface ImportBatch {
  id: string;
  file_name: string;
  file_type: string | null;
  file_hash: string | null;
  storage_path: string | null;
  status: ImportStatus;
  entity_type: string | null;
  source_id: string | null;
  competencia: string | null;
  state_uf: string | null;
  encoding: string | null;
  delimiter: string | null;
  column_mapping: Record<string, string> | null;
  row_count: number | null;
  valid_count: number | null;
  invalid_count: number | null;
  duplicate_count: number | null;
  doctors_found: number | null;
  facilities_found: number | null;
  links_found: number | null;
  contacts_found: number | null;
  evidences_found: number | null;
  preview_summary: Record<string, unknown> | null;
  uploaded_by: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  processing_started_at: string | null;
  processing_finished_at: string | null;
  reprocessed_from: string | null;
  error_message: string | null;
  error_report: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface RawRecord {
  id: string;
  batch_id: string;
  row_number: number | null;
  payload: Record<string, unknown> | null;
  normalized_payload: Record<string, unknown> | null;
  validation_errors: string[] | null;
  is_valid: boolean | null;
  is_duplicate: boolean;
  match_status: string;
  linked_doctor_id: string | null;
  linked_facility_id: string | null;
  error_message: string | null;
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
  falecido: "Falecido",
  registro_duplicado: "Registro duplicado",
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

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  nao_validado: "Não validado",
  valido: "Válido",
  invalido: "Inválido",
  desatualizado: "Desatualizado",
};

export const CONTACT_CHANNEL_LABELS: Record<ContactChannel, string> = {
  email: "E-mail",
  telefone: "Telefone",
  celular: "Celular",
  whatsapp: "WhatsApp",
  site: "Site",
  secretaria: "Secretaria",
  formulario: "Formulário",
  linkedin: "LinkedIn",
  outro: "Outro",
};

export const OWNERSHIP_TYPE_LABELS: Record<OwnershipType, string> = {
  publico: "Público",
  privado: "Privado",
  filantropico: "Filantrópico",
  misto: "Misto",
};
