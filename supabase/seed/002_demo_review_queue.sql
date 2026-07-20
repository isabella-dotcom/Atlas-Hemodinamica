-- 002_demo_review_queue.sql
-- Itens fictícios na fila de validação. Idempotente por IDs fixos.
-- Requer 001_demo_data.sql aplicado.

do $$
declare
  v_i int;
  v_doc uuid;
begin
  -- Pendentes / em análise / nova revisão / aprovados / rejeitados / mais info
  for v_i in 1..12 loop
    v_doc := ('b2000000-0000-4000-8000-' || lpad((16 + v_i)::text, 12, '0'))::uuid;
    insert into public.review_queue (
      id, doctor_id, status, priority, review_type, origin, reason, notes
    ) values (
      ('b8000000-0000-4000-8000-' || lpad(v_i::text, 12, '0'))::uuid,
      v_doc,
      case
        when v_i <= 3 then 'pendente'
        when v_i <= 5 then 'em_analise'
        when v_i <= 7 then 'nova_revisao'
        when v_i <= 9 then 'aprovado'
        when v_i = 10 then 'rejeitado'
        else 'nova_revisao'
      end,
      40 + v_i,
      'candidato',
      'seed_demo',
      case
        when v_i <= 3 then 'DADO FICTÍCIO — pendente de revisão'
        when v_i <= 5 then 'DADO FICTÍCIO — em análise'
        when v_i <= 7 then 'DADO FICTÍCIO — solicitar mais informações'
        when v_i <= 9 then 'DADO FICTÍCIO — aprovado em demonstração'
        when v_i = 10 then 'DADO FICTÍCIO — rejeitado em demonstração'
        else 'DADO FICTÍCIO — aguardando informação adicional'
      end,
      'DADO FICTÍCIO — item de fila gerado pelo seed.'
    )
    on conflict (id) do update set
      status = excluded.status,
      reason = excluded.reason,
      notes = excluded.notes,
      updated_at = now();
  end loop;

  update public.review_queue
  set decided_at = now(),
      notes = coalesce(notes, '') || ' Decisão fictícia de seed.'
  where id in (
    'b8000000-0000-4000-8000-000000000009'::uuid,
    'b8000000-0000-4000-8000-000000000010'::uuid
  );
end $$;
