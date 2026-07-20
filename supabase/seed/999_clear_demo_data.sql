-- 999_clear_demo_data.sql
-- Remove SOMENTE dados de demonstração (is_demo = true e órfãos ligados a eles).
-- Seguro para reexecução. NÃO apaga registros oficiais.

-- Ordem respeitando FKs

-- Fila ligada a médicos demo
delete from public.review_queue rq
using public.doctors d
where rq.doctor_id = d.id and d.is_demo = true;

delete from public.review_queue rq
using public.health_facilities f
where rq.facility_id = f.id and f.is_demo = true;

-- Evidências de entidades demo
delete from public.evidences e
using public.doctors d
where e.entity_type = 'doctor' and e.entity_id = d.id and d.is_demo = true;

delete from public.evidences e
using public.health_facilities f
where e.entity_type = 'facility' and e.entity_id = f.id and f.is_demo = true;

-- Contatos
delete from public.contact_restrictions cr
using public.professional_contacts pc
join public.doctors d on d.id = pc.doctor_id
where cr.contact_id = pc.id and d.is_demo = true;

delete from public.contact_restrictions cr
using public.doctors d
where cr.doctor_id = d.id and d.is_demo = true;

delete from public.professional_contacts pc
using public.doctors d
where pc.doctor_id = d.id and d.is_demo = true;

delete from public.professional_contacts pc
using public.health_facilities f
where pc.facility_id = f.id and f.is_demo = true;

-- Vínculos (limpa evidence_id antes se apontar para evidência já removida)
update public.doctor_facility_links l
set evidence_id = null
from public.doctors d
where l.doctor_id = d.id and d.is_demo = true;

delete from public.doctor_facility_links l
using public.doctors d
where l.doctor_id = d.id and d.is_demo = true;

delete from public.doctor_facility_links l
using public.health_facilities f
where l.facility_id = f.id and f.is_demo = true;

-- Registros e especialidades
delete from public.medical_registrations mr
using public.doctors d
where mr.doctor_id = d.id and d.is_demo = true;

delete from public.doctor_specialties ds
using public.doctors d
where ds.doctor_id = d.id and d.is_demo = true;

delete from public.doctor_sensitive_fields sf
using public.doctors d
where sf.doctor_id = d.id and d.is_demo = true;

-- Entidades raiz demo
delete from public.doctors where is_demo = true;
delete from public.health_facilities where is_demo = true;

-- IDs fixos do seed (rede de segurança caso is_demo falhe em ambiente antigo)
delete from public.doctors
where id between 'b2000000-0000-4000-8000-000000000001'::uuid
  and 'b2000000-0000-4000-8000-000000000030'::uuid;

delete from public.health_facilities
where id between 'b1000000-0000-4000-8000-000000000001'::uuid
  and 'b1000000-0000-4000-8000-00000000000a'::uuid;
