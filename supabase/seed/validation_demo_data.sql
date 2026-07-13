-- Seed MANUAL e OPCIONAL — dados claramente fictícios para validação.
-- NÃO executar em produção sem revisão.
-- Domínio de e-mail: example.com (RFC 2606)
-- Prefixo de identificação: [DEMO-ATLAS]

-- Fontes já existentes (MANUAL). Usar source MANUAL se disponível.

do $$
declare
  v_source_id uuid;
  v_specialty_id uuid;
  v_f1 uuid;
  v_f2 uuid;
  v_f3 uuid;
  v_d1 uuid;
  v_d2 uuid;
  v_d3 uuid;
  v_d4 uuid;
  v_c1 uuid;
begin
  select id into v_source_id from public.data_sources where code = 'MANUAL' limit 1;
  select id into v_specialty_id from public.specialties where code = 'HEMOCIR' limit 1;

  -- Estabelecimentos fictícios
  insert into public.health_facilities (
    id, name, trade_name, cnes, cnpj, facility_type, city, state_uf,
    has_hemodynamics, attends_sus, layer, confidence_score, notes, source_id
  ) values
  (
    'a1000000-0000-4000-8000-000000000001',
    '[DEMO-ATLAS] Instituto Cardiovascular Horizonte',
    'IC Horizonte Demo',
    '9990001',
    '00000000000191',
    'Hospital',
    'Belo Horizonte',
    'MG',
    true,
    true,
    'candidato',
    40,
    'Dado fictício de demonstração. Não é instituição real.',
    v_source_id
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    '[DEMO-ATLAS] Hospital Metropolitano das Montanhas',
    'HMM Demo',
    '9990002',
    '00000000000272',
    'Hospital',
    'Uberlândia',
    'MG',
    true,
    true,
    'candidato',
    35,
    'Dado fictício de demonstração.',
    v_source_id
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    '[DEMO-ATLAS] Centro Intervencionista Vida Plena',
    'CIVP Demo',
    null,
    null,
    'Clínica',
    'Juiz de Fora',
    'MG',
    true,
    false,
    'candidato',
    25,
    'Estabelecimento fictício sem médicos vinculados (cenário de pendência).',
    v_source_id
  )
  on conflict (id) do nothing;

  v_f1 := 'a1000000-0000-4000-8000-000000000001';
  v_f2 := 'a1000000-0000-4000-8000-000000000002';
  v_f3 := 'a1000000-0000-4000-8000-000000000003';

  -- Médicos fictícios
  insert into public.doctors (
    id, full_name, normalized_name, classification, validation_status, layer,
    confidence_score, city, state_uf, notes
  ) values
  (
    'b1000000-0000-4000-8000-000000000001',
    '[DEMO-ATLAS] Eduardo Martins Ferraz',
    'eduardo martins ferraz',
    'possivel_candidato',
    'em_revisao',
    'candidato',
    35,
    'Belo Horizonte',
    'MG',
    'Candidato fictício em revisão.'
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    '[DEMO-ATLAS] Helena Duarte Campos',
    'helena duarte campos',
    'atuacao_provavel',
    'parcialmente_validada',
    'candidato',
    55,
    'Uberlândia',
    'MG',
    'Parcialmente validada (fictício).'
  ),
  (
    'b1000000-0000-4000-8000-000000000003',
    '[DEMO-ATLAS] Rafael Nogueira Bastos',
    'rafael nogueira bastos',
    'especialista_confirmado',
    'validada',
    'oficial',
    85,
    'Belo Horizonte',
    'MG',
    'Especialista fictício para demonstração de base oficial.'
  ),
  (
    'b1000000-0000-4000-8000-000000000004',
    '[DEMO-ATLAS] Camila Andrade Vasconcelos',
    'camila andrade vasconcelos',
    'possivel_candidato',
    'nao_iniciada',
    'candidato',
    15,
    'Contagem',
    'MG',
    'Candidata sem vínculo (pendência).'
  )
  on conflict (id) do nothing;

  v_d1 := 'b1000000-0000-4000-8000-000000000001';
  v_d2 := 'b1000000-0000-4000-8000-000000000002';
  v_d3 := 'b1000000-0000-4000-8000-000000000003';
  v_d4 := 'b1000000-0000-4000-8000-000000000004';

  insert into public.medical_registrations (
    doctor_id, registration_type, number, state_uf, status, is_primary, confidence_score, source_id
  ) values
  (v_d1, 'CRM', '90001', 'MG', 'desconhecido', true, 20, v_source_id),
  (v_d2, 'CRM', '90002', 'MG', 'ativo', true, 40, v_source_id),
  (v_d2, 'RQE', '80002', 'MG', 'desconhecido', false, 30, v_source_id),
  (v_d3, 'CRM', '90003', 'MG', 'ativo', true, 70, v_source_id),
  (v_d3, 'RQE', '80003', 'MG', 'ativo', false, 75, v_source_id)
  on conflict do nothing;

  if v_specialty_id is not null then
    insert into public.doctor_specialties (
      doctor_id, specialty_id, is_confirmed, is_primary, confidence_score, source_id
    ) values
    (v_d2, v_specialty_id, false, true, 40, v_source_id),
    (v_d3, v_specialty_id, true, true, 80, v_source_id)
    on conflict do nothing;
  end if;

  insert into public.doctor_facility_links (
    doctor_id, facility_id, role_title, department, is_coordinator,
    coordinator_justification, coordinator_confirmed, status, layer,
    confidence_score, source_id, notes
  ) values
  (
    v_d1, v_f1, 'Médico assistente', 'Hemodinâmica', false,
    null, false, 'provisorio', 'candidato', 30, v_source_id,
    'Vínculo fictício provável'
  ),
  (
    v_d2, v_f2, 'Coordenadora', 'Hemodinâmica', true,
    'Informação institucional fictícia para demo (não confirmada).', false,
    'ativo', 'candidato', 50, v_source_id,
    'Coordenador provável fictício'
  ),
  (
    v_d3, v_f1, 'Médico hemodinamicista', 'Hemodinâmica', true,
    'Corpo clínico fictício de demonstração.', true,
    'ativo', 'oficial', 80, v_source_id,
    'Vínculo confirmado fictício'
  )
  on conflict do nothing;

  insert into public.professional_contacts (
    id, doctor_id, facility_id, channel, value, label, is_institutional,
    is_publicly_available, is_primary, do_not_contact, confidence_score, source_id
  ) values
  (
    'c1000000-0000-4000-8000-000000000001',
    null, v_f1, 'telefone', '+55 31 3999-0001', 'Secretaria demo',
    true, true, true, false, 50, v_source_id
  ),
  (
    'c1000000-0000-4000-8000-000000000002',
    v_d3, null, 'email', 'rafael.bastos.demo@example.com', 'Profissional demo',
    false, true, true, false, 60, v_source_id
  ),
  (
    'c1000000-0000-4000-8000-000000000003',
    v_d1, null, 'telefone', '+55 31 3999-0099', 'Não contatar demo',
    false, false, false, true, 10, v_source_id
  )
  on conflict do nothing;

  v_c1 := 'c1000000-0000-4000-8000-000000000003';

  insert into public.contact_restrictions (doctor_id, contact_id, reason)
  values (v_d1, v_c1, 'Solicitação fictícia de não contato (demo)');

  insert into public.evidences (
    entity_type, entity_id, source_id, title, description, status,
    confirmed_field, captured_value, reliability_score
  ) values
  (
    'doctor', v_d1, v_source_id,
    '[DEMO-ATLAS] Evidência pendente de corpo clínico',
    'Arquivo fictício — não baixar de fonte real.',
    'pendente', 'vinculo', 'assistente', 40
  ),
  (
    'facility', v_f1, v_source_id,
    '[DEMO-ATLAS] Evidência de serviço de hemodinâmica',
    'Demonstração apenas.',
    'aceita', 'has_hemodynamics', 'true', 70
  );

  insert into public.review_queue (
    doctor_id, status, priority, review_type, origin, reason, notes
  ) values
  (
    v_d1, 'pendente', 70, 'candidato', 'seed_demo',
    'Revisão de demonstração',
    '[DEMO-ATLAS] Item gerado pelo seed de validação'
  );
end $$;
