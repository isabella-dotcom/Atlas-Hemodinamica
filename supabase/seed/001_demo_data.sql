-- 001_demo_data.sql
-- DADOS FICTÍCIOS — NÃO EXECUTAR EM PRODUÇÃO SEM REVISÃO EXPLÍCITA.
-- Domínio: example.com | Prefixo: DADO FICTÍCIO | is_demo = true
-- Idempotente: UUIDs fixos + ON CONFLICT DO UPDATE / DO NOTHING.
-- Requer migrations 007–011 aplicadas.

-- Fonte demo
insert into public.data_sources (code, name, description, reliability_score, is_active)
values (
  'DEMO',
  'Dados fictícios de demonstração',
  'DADO FICTÍCIO — seed de homologação. Não misturar com base oficial.',
  10,
  true
)
on conflict (code) do update
set description = excluded.description, is_active = true;

insert into public.specialties (code, name, is_hemodynamics_related)
values
  ('HEMOCIR', 'Hemodinâmica e Cardiologia Intervencionista', true),
  ('CARDIO', 'Cardiologia', false),
  ('VASC', 'Cirurgia Vascular', false),
  ('RADIO_INT', 'Radiologia Intervencionista', true),
  ('NEURO_INT', 'Neurorradiologia Intervencionista', true),
  ('ELETRO', 'Eletrofisiologia', true)
on conflict (name) do nothing;

do $$
declare
  v_source uuid;
  v_hemo uuid;
  v_cardio uuid;
  v_i int;
  v_fac uuid;
  v_doc uuid;
  v_cities text[] := array[
    'Belo Horizonte','Uberlândia','Juiz de Fora','Montes Claros','Uberaba',
    'Contagem','Betim','Governador Valadares','Ipatinga','Sete Lagoas'
  ];
  v_fac_names text[] := array[
    'Hospital Demonstração Belo Horizonte',
    'Instituto Fictício de Cardiologia MG',
    'Centro Demonstração Hemodinâmica Uberlândia',
    'Hospital Demonstração Juiz de Fora',
    'Clínica Fictícia Intervencionista Montes Claros',
    'Hospital Demonstração Contagem',
    'Instituto Demonstração Betim',
    'Hospital Fictício Valadares',
    'Centro Demonstração Ipatinga',
    'Hospital Demonstração Sete Lagoas'
  ];
begin
  select id into v_source from public.data_sources where code = 'DEMO' limit 1;
  select id into v_hemo from public.specialties where code = 'HEMOCIR' limit 1;
  select id into v_cardio from public.specialties where code = 'CARDIO' limit 1;

  -- 10 estabelecimentos
  for v_i in 1..10 loop
    v_fac := ('b1000000-0000-4000-8000-' || lpad(v_i::text, 12, '0'))::uuid;
    insert into public.health_facilities (
      id, name, trade_name, normalized_name, cnes, cnpj, facility_type,
      legal_nature, ownership_type, branch_type, is_active,
      city, state_uf, address_street, address_number, address_district, address_zip,
      address_complement, region, has_hemodynamics, has_catheterization_lab,
      has_interventional_cardiology, attends_sus, attends_private, attends_insurance,
      is_24_hours, has_emergency_service, estimated_rooms, phone, email, website,
      hemodynamics_phone, hemodynamics_email, layer, confidence_score, notes,
      source_id, is_demo, service_notes, procedures
    ) values (
      v_fac,
      v_fac_names[v_i],
      'Demo Hemo ' || v_i,
      public.normalize_search_text(v_fac_names[v_i]),
      '99' || lpad(v_i::text, 5, '0'),
      '00000000000' || lpad(v_i::text, 3, '0'),
      'Hospital',
      'Privada',
      case when v_i % 2 = 0 then 'privado' else 'filantropico' end,
      'unico',
      true,
      v_cities[v_i],
      'MG',
      'Rua Fictícia ' || v_i,
      (100 + v_i)::text,
      'Bairro Demonstração',
      '3000000' || v_i::text,
      'DADO FICTÍCIO',
      'Minas Gerais',
      true,
      true,
      true,
      v_i % 3 <> 0,
      true,
      v_i % 2 = 0,
      v_i <= 5,
      true,
      1 + (v_i % 3),
      '313000' || lpad(v_i::text, 4, '0'),
      'contato@hospital-demo' || v_i || '.example.com',
      'https://hospital-demo' || v_i || '.example.com',
      '3199000' || lpad(v_i::text, 4, '0'),
      'hemo@hospital-demo' || v_i || '.example.com',
      case when v_i <= 4 then 'oficial' else 'candidato' end,
      40 + v_i,
      'DADO FICTÍCIO — estabelecimento de demonstração. Não é instituição real.',
      v_source,
      true,
      'DADO FICTÍCIO — serviço de hemodinâmica simulado.',
      'Cateterismo diagnóstico; angioplastia (fictício)'
    )
    on conflict (id) do update set
      name = excluded.name,
      is_demo = true,
      notes = excluded.notes,
      has_hemodynamics = true,
      updated_at = now();
  end loop;

  -- 30 médicos
  for v_i in 1..30 loop
    v_doc := ('b2000000-0000-4000-8000-' || lpad(v_i::text, 12, '0'))::uuid;
    insert into public.doctors (
      id, full_name, normalized_name, social_name, classification, validation_status,
      layer, confidence_score, city, state_uf, biography, notes,
      declared_practice_area, confirmed_practice_area, graduation_institution,
      graduation_year, residency, specialization, fellowships, is_sbhci_member,
      lattes_url, orcid, is_demo, practice_keywords
    ) values (
      v_doc,
      'Médico Demonstração ' || lpad(v_i::text, 3, '0'),
      public.normalize_search_text('Medico Demonstracao ' || lpad(v_i::text, 3, '0')),
      null,
      case
        when v_i <= 8 then 'especialista_confirmado'::public.doctor_classification
        when v_i <= 16 then 'atuacao_institucional_confirmada'::public.doctor_classification
        when v_i <= 22 then 'atuacao_provavel'::public.doctor_classification
        when v_i = 29 then 'rejeitado'::public.doctor_classification
        when v_i = 30 then 'registro_duplicado'::public.doctor_classification
        else 'possivel_candidato'::public.doctor_classification
      end,
      case
        when v_i <= 8 then 'validada'::public.validation_status
        when v_i <= 16 then 'parcialmente_validada'::public.validation_status
        when v_i <= 22 then 'em_revisao'::public.validation_status
        when v_i = 29 then 'rejeitada'::public.validation_status
        else 'nao_iniciada'::public.validation_status
      end,
      case when v_i <= 8 then 'oficial' else 'candidato' end,
      least(95, 20 + v_i * 2),
      v_cities[1 + ((v_i - 1) % 10)],
      'MG',
      'DADO FICTÍCIO — biografia de demonstração do médico ' || v_i,
      'DADO FICTÍCIO — médico fictício. CRM FICTÍCIO — NÃO UTILIZAR.',
      'Hemodinâmica',
      case when v_i <= 16 then 'Hemodinâmica e Cardiologia Intervencionista' else null end,
      'Universidade Fictícia de Minas Gerais',
      1995 + (v_i % 20),
      'Residência fictícia em Cardiologia',
      'Especialização fictícia em Hemodinâmica',
      array['Fellowship demonstração'],
      v_i % 4 = 0,
      'https://lattes.example.com/demo' || v_i,
      '0000-0002-1825-' || lpad((1000 + v_i)::text, 4, '0'),
      true,
      array['hemodinamica','dado-ficticio']
    )
    on conflict (id) do update set
      full_name = excluded.full_name,
      is_demo = true,
      notes = excluded.notes,
      updated_at = now();
  end loop;

  -- 15 CRM + 10 RQE (números reservados 900000+)
  for v_i in 1..15 loop
    v_doc := ('b2000000-0000-4000-8000-' || lpad(v_i::text, 12, '0'))::uuid;
    insert into public.medical_registrations (
      id, doctor_id, registration_type, number, state_uf, status, is_primary,
      confidence_score, source_id, notes, inscription_type, consulted_at,
      verification_status, registration_details
    ) values (
      ('b3000000-0000-4000-8000-' || lpad(v_i::text, 12, '0'))::uuid,
      v_doc,
      'CRM',
      (900000 + v_i)::text,
      'MG',
      'ativo',
      true,
      50,
      v_source,
      'CRM FICTÍCIO — NÃO UTILIZAR. DADO FICTÍCIO.',
      'principal',
      current_date - v_i,
      case when v_i <= 8 then 'verificado' else 'nao_verificado' end,
      'DADO FICTÍCIO'
    )
    on conflict (registration_type, number, state_uf) do update set
      notes = excluded.notes,
      doctor_id = excluded.doctor_id;
  end loop;

  for v_i in 1..10 loop
    v_doc := ('b2000000-0000-4000-8000-' || lpad(v_i::text, 12, '0'))::uuid;
    insert into public.medical_registrations (
      id, doctor_id, registration_type, number, state_uf, status, is_primary,
      specialty_id, confidence_score, source_id, notes, consulted_at,
      verification_status, rqe_area, rqe_status
    ) values (
      ('b3100000-0000-4000-8000-' || lpad(v_i::text, 12, '0'))::uuid,
      v_doc,
      'RQE',
      (910000 + v_i)::text,
      'MG',
      'ativo',
      true,
      v_hemo,
      55,
      v_source,
      'RQE FICTÍCIO — NÃO UTILIZAR. DADO FICTÍCIO.',
      current_date - (v_i + 3),
      'verificado',
      'Hemodinâmica e Cardiologia Intervencionista',
      'ativo'
    )
    on conflict (registration_type, number, state_uf) do update set
      notes = excluded.notes,
      doctor_id = excluded.doctor_id;
  end loop;

  -- Especialidades dos médicos (primeiros 20)
  for v_i in 1..20 loop
    v_doc := ('b2000000-0000-4000-8000-' || lpad(v_i::text, 12, '0'))::uuid;
    insert into public.doctor_specialties (
      id, doctor_id, specialty_id, is_primary, is_confirmed, confidence_score, source_id
    ) values (
      ('b4000000-0000-4000-8000-' || lpad(v_i::text, 12, '0'))::uuid,
      v_doc,
      case when v_i % 2 = 0 then v_hemo else coalesce(v_cardio, v_hemo) end,
      true,
      v_i <= 12,
      40 + v_i,
      v_source
    )
    on conflict (doctor_id, specialty_id) do update set
      is_confirmed = excluded.is_confirmed,
      confidence_score = excluded.confidence_score;
  end loop;

  -- 35 vínculos (role_title distinto para evitar unique parcial ativo)
  for v_i in 1..35 loop
    v_doc := ('b2000000-0000-4000-8000-' || lpad(((v_i - 1) % 30 + 1)::text, 12, '0'))::uuid;
    v_fac := ('b1000000-0000-4000-8000-' || lpad(((v_i - 1) % 10 + 1)::text, 12, '0'))::uuid;
    insert into public.doctor_facility_links (
      id, doctor_id, facility_id, role_title, function_title, practiced_specialty,
      department, is_coordinator, is_team_leader, is_technical_responsible,
      is_clinical_staff, weekly_hours, is_sus_link, status, layer, confidence_score,
      source_id, notes, coordinator_justification, coordinator_confirmed
    ) values (
      ('b5000000-0000-4000-8000-' || lpad(v_i::text, 12, '0'))::uuid,
      v_doc,
      v_fac,
      'Hemodinamicista demo ' || v_i,
      'Hemodinamicista',
      'Hemodinâmica',
      'Hemodinâmica',
      v_i <= 8,
      v_i between 9 and 12,
      v_i between 13 and 15,
      true,
      12 + (v_i % 20),
      v_i % 3 = 0,
      case when v_i > 32 then 'encerrado' else 'ativo' end,
      case when v_i <= 10 then 'oficial' else 'candidato' end,
      35 + (v_i % 40),
      v_source,
      'DADO FICTÍCIO — vínculo de demonstração.',
      case when v_i <= 8 then 'DADO FICTÍCIO — coordenação simulada' else null end,
      v_i <= 5
    )
    on conflict (id) do update set
      notes = excluded.notes,
      function_title = excluded.function_title,
      role_title = excluded.role_title,
      is_deleted = false;
  end loop;

  -- 25 contatos
  for v_i in 1..25 loop
    insert into public.professional_contacts (
      id, doctor_id, facility_id, channel, value, label, is_institutional,
      is_publicly_available, is_primary, do_not_contact, contact_status,
      accepts_contact, source_origin, collected_at, confidence_score, source_id
    ) values (
      ('b6000000-0000-4000-8000-' || lpad(v_i::text, 12, '0'))::uuid,
      case when v_i <= 18 then ('b2000000-0000-4000-8000-' || lpad(v_i::text, 12, '0'))::uuid else null end,
      case when v_i > 18 then ('b1000000-0000-4000-8000-' || lpad((v_i - 18)::text, 12, '0'))::uuid else null end,
      case
        when v_i % 5 = 0 then 'whatsapp'::public.contact_channel
        when v_i % 5 = 1 then 'email'::public.contact_channel
        when v_i % 5 = 2 then 'telefone'::public.contact_channel
        when v_i % 5 = 3 then 'celular'::public.contact_channel
        else 'site'::public.contact_channel
      end,
      case
        when v_i % 5 = 1 then 'medico' || lpad(v_i::text, 3, '0') || '@example.com'
        when v_i % 5 = 4 then 'https://perfil-demo' || v_i || '.example.com'
        else '3198' || lpad((1000000 + v_i)::text, 7, '0')
      end,
      'DADO FICTÍCIO',
      v_i > 18,
      v_i <> 7,
      v_i % 4 = 1,
      v_i = 7,
      case when v_i = 7 then 'invalido' when v_i <= 10 then 'valido' else 'nao_validado' end,
      v_i <> 7,
      'seed_demo',
      current_date,
      40,
      v_source
    )
    on conflict (id) do update set
      value = excluded.value,
      contact_status = excluded.contact_status,
      is_deleted = false;
  end loop;

  -- 15 evidências
  for v_i in 1..15 loop
    insert into public.evidences (
      id, entity_type, entity_id, source_id, title, description, url,
      collected_at, status, confirmed_field, captured_value
    ) values (
      ('b7000000-0000-4000-8000-' || lpad(v_i::text, 12, '0'))::uuid,
      case when v_i <= 10 then 'doctor' else 'facility' end,
      case
        when v_i <= 10 then ('b2000000-0000-4000-8000-' || lpad(v_i::text, 12, '0'))::uuid
        else ('b1000000-0000-4000-8000-' || lpad((v_i - 10)::text, 12, '0'))::uuid
      end,
      v_source,
      'Evidência fictícia ' || v_i,
      'DADO FICTÍCIO — evidência de demonstração.',
      'https://evidencia-demo' || v_i || '.example.com',
      current_date - v_i,
      case when v_i <= 5 then 'aceita' when v_i <= 10 then 'pendente' else 'necessita_revisao' end,
      case when v_i <= 10 then 'full_name' else 'has_hemodynamics' end,
      'DADO FICTÍCIO'
    )
    on conflict (id) do update set
      title = excluded.title,
      description = excluded.description;
  end loop;
end $$;
