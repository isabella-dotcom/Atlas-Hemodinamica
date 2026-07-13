-- Remove APENAS dados do seed [DEMO-ATLAS].
-- Não usa TRUNCATE. Não desativa RLS. Não remove usuários.

delete from public.review_queue
where notes like '%[DEMO-ATLAS]%'
   or reason = 'Revisão de demonstração'
   or doctor_id in (
     select id from public.doctors where full_name like '[DEMO-ATLAS]%'
   );

delete from public.evidences
where title like '[DEMO-ATLAS]%'
   or entity_id in (
     select id from public.doctors where full_name like '[DEMO-ATLAS]%'
   )
   or entity_id in (
     select id from public.health_facilities where name like '[DEMO-ATLAS]%'
   );

delete from public.contact_restrictions
where contact_id in (
  select id from public.professional_contacts
  where id in (
    'c1000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000003'
  )
)
or doctor_id in (
  select id from public.doctors where full_name like '[DEMO-ATLAS]%'
);

delete from public.professional_contacts
where id in (
  'c1000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000003'
)
or doctor_id in (select id from public.doctors where full_name like '[DEMO-ATLAS]%')
or facility_id in (select id from public.health_facilities where name like '[DEMO-ATLAS]%');

delete from public.doctor_facility_links
where doctor_id in (select id from public.doctors where full_name like '[DEMO-ATLAS]%')
   or facility_id in (select id from public.health_facilities where name like '[DEMO-ATLAS]%');

delete from public.doctor_specialties
where doctor_id in (select id from public.doctors where full_name like '[DEMO-ATLAS]%');

delete from public.medical_registrations
where doctor_id in (select id from public.doctors where full_name like '[DEMO-ATLAS]%');

delete from public.doctors where full_name like '[DEMO-ATLAS]%';

delete from public.health_facilities where name like '[DEMO-ATLAS]%';

-- Auditoria do seed pode permanecer para histórico; se desejar limpar:
-- delete from public.audit_logs where metadata->>'seed' = 'demo-atlas';
