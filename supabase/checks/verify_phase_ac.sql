-- verify_phase_ac.sql
-- Execute no SQL Editor do Supabase (preferencialmente como role com acesso a information_schema).
-- Uso: cole este arquivo e rode. Não altera dados.

-- 1) Colunas doctors
select 'doctors' as tabela, column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'doctors'
  and column_name in (
    'social_name','biography','declared_practice_area','confirmed_practice_area',
    'graduation_institution','graduation_year','residency','specialization',
    'fellowships','masters_degree','doctorate_degree','professional_titles',
    'medical_societies','is_sbhci_member','lattes_url','orcid',
    'scientific_identifiers','is_demo','deleted_at'
  )
order by column_name;

-- 2) Colunas medical_registrations
select 'medical_registrations' as tabela, column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'medical_registrations'
  and column_name in (
    'inscription_type','consulted_at','verified_at','verification_status',
    'registration_details','rqe_area','rqe_status'
  )
order by column_name;

-- 3) Colunas health_facilities
select 'health_facilities' as tabela, column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'health_facilities'
  and column_name in (
    'normalized_name','legal_nature','ownership_type','branch_type','is_active',
    'address_zip','address_street','address_number','address_complement','address_district',
    'ibge_city_code','region','latitude','longitude','hemodynamics_phone',
    'institutional_whatsapp','hemodynamics_email','secretary_contact','service_manager_contact',
    'has_catheterization_lab','has_interventional_cardiology','has_interventional_radiology',
    'has_interventional_neuroradiology','attends_private','attends_insurance','is_24_hours',
    'has_emergency_service','estimated_rooms','estimated_equipment','procedures',
    'service_notes','last_service_confirmed_at','is_demo'
  )
order by column_name;

-- 4) Colunas vínculos
select 'doctor_facility_links' as tabela, column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'doctor_facility_links'
  and column_name in (
    'function_title','practiced_specialty','is_team_leader','is_clinical_staff',
    'weekly_hours','is_sus_link','evidence_id','last_verified_at','verified_by'
  )
order by column_name;

-- 5) Colunas contatos
select 'professional_contacts' as tabela, column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'professional_contacts'
  and column_name in (
    'contact_status','accepts_contact','source_origin','collected_at',
    'last_attempt_at','last_attempt_result','verified_at','verified_by'
  )
order by column_name;

-- 6) Valores dos enums
select t.typname as enum_name, e.enumlabel as valor
from pg_type t
join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
  and t.typname in (
    'doctor_classification','contact_channel','contact_status',
    'registration_verification_status'
  )
order by t.typname, e.enumsortorder;

-- 7) Políticas RLS (amostra)
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'doctors','health_facilities','professional_contacts',
    'doctor_sensitive_fields','doctor_facility_links'
  )
order by tablename, policyname;

-- 8) Especialidades
select code, name, is_hemodynamics_related
from public.specialties
order by name;

-- 9) Contagem demo
select
  (select count(*) from public.doctors where is_demo = true) as doctors_demo,
  (select count(*) from public.health_facilities where is_demo = true) as facilities_demo,
  (select count(*) from public.medical_registrations mr
     join public.doctors d on d.id = mr.doctor_id where d.is_demo = true) as registrations_demo,
  (select count(*) from public.doctor_facility_links l
     join public.doctors d on d.id = l.doctor_id where d.is_demo = true) as links_demo,
  (select count(*) from public.professional_contacts pc
     left join public.doctors d on d.id = pc.doctor_id
     left join public.health_facilities f on f.id = pc.facility_id
     where coalesce(d.is_demo, false) or coalesce(f.is_demo, false)) as contacts_demo,
  (select count(*) from public.review_queue where origin = 'seed_demo') as review_demo;

-- 10) Órfãos
select 'links_sem_medico' as problema, count(*)::int as total
from public.doctor_facility_links l
left join public.doctors d on d.id = l.doctor_id
where d.id is null
union all
select 'links_sem_estabelecimento', count(*)::int
from public.doctor_facility_links l
left join public.health_facilities f on f.id = l.facility_id
where f.id is null;

-- 11) Duplicidades CRM+UF
select registration_type, number, state_uf, count(*) as qtd
from public.medical_registrations
group by registration_type, number, state_uf
having count(*) > 1;

-- 12) RPC (Master)
-- select public.diagnostic_phase_ac_check();
