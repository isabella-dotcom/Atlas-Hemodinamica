# Atlas da Hemodinâmica

Aplicação interna para construir, validar e manter a base nacional de médicos que atuam em Hemodinâmica e Cardiologia Intervencionista.

## Estrutura

```
├── web/                 # Next.js + TypeScript + Tailwind
├── supabase/migrations/ # Schema PostgreSQL + RLS
├── supabase/seed/       # Seed fictício opcional
└── etl/                 # Python + pandas (importações)
```

Papéis no banco (`app_role`): `master`, `analista`, `visualizador`.

## Conexão ao Supabase

1. Criar projeto no Supabase.
2. SQL Editor — executar nesta ordem:
   - `001_initial_schema.sql`
   - `002_auth_and_storage.sql`
   - `003_fix_auth_profile_and_policies.sql`
   - `004_unified_doctor_search.sql`
   - `005_audit_and_integrity_improvements.sql`
   - `006_supabase_integration_fixes.sql`
   - `007_doctor_profile_enrichment.sql`
   - `008_registrations_and_specialties.sql`
   - `009_facilities_enrichment.sql`
   - `010_links_contacts_enrichment.sql`
   - `011_ensure_phase_ac_schema.sql` (rede de segurança idempotente)
3. Confirmar buckets privados `imports` e `evidences`.
4. Criar usuários **somente no Auth** (sem cadastro público na app):
   - Master, Analista, Visualizador (e-mails de teste do proprietário).
5. Confirmar perfil automático:

```sql
select up.id, up.full_name, up.role, up.is_active, au.email
from public.users_profile up
join auth.users au on au.id = up.id
order by up.created_at desc;
```

6. Promover papéis (use o e-mail real do Auth; **não** use `analyst`/`viewer` — os valores corretos são `analista`/`visualizador`):

```sql
update public.users_profile up
set role = 'master'
from auth.users au
where up.id = au.id
  and au.email = 'EMAIL_DO_MASTER';

update public.users_profile up
set role = 'analista'
from auth.users au
where up.id = au.id
  and au.email = 'EMAIL_DO_ANALISTA';
```

O Visualizador permanece com `visualizador` (padrão do trigger).

7. Copiar Project URL + anon key.
8. Criar `web/.env.local` (nunca versionar):

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

9. `cd web && npm install && npm run dev`
10. Login → `/configuracoes/diagnostico` (Master) → **Executar diagnóstico**.

A `SUPABASE_SERVICE_ROLE_KEY` **não** é necessária no frontend.

### Smoke SQL pós-migration

```sql
select extensions.unaccent('Hemodinâmica');
select public.normalize_search_text('José da Silva');
select public.diagnostic_foundation_check(); -- somente Master
```

## Validação ponta a ponta (checklist)

Com Master, após `.env.local` válido:

1. Diagnóstico verde (tabelas, RPCs, buckets)
2. Cadastrar estabelecimento fictício com hemodinâmica + SUS
3. Editar estabelecimento (`/estabelecimentos/[id]/editar`)
4. Contato institucional + evidência
5. Cadastrar médico candidato + CRM + RQE + especialidade
6. Vincular (coordenador **provável** com justificativa)
7. Contato profissional + evidência
8. Enviar à fila → assumir → mais info → aprovar
9. Buscar por nome/CRM/cidade/sem acento
10. Arquivar e restaurar médico
11. Confirmar auditoria
12. Repetir leituras com Analista e Visualizador (URLs diretas)

## Dados fictícios (seed de demonstração)

**AVISO:** o seed é 100% fictício (`is_demo = true`, domínio `example.com`, textos “DADO FICTÍCIO”).  
**Nunca** use como base oficial / GOLDEN. **Não** execute em produção sem revisão explícita.

### Pré-requisito
Migrations `007`–`011` aplicadas no projeto Supabase de homologação.

### Popular

```bash
cd web
npm run seed:demo
# O comando valida e lista os arquivos. Em seguida, no SQL Editor:
# 1) supabase/seed/001_demo_data.sql
# 2) supabase/seed/002_demo_review_queue.sql
```

Conteúdo aproximado: 10 estabelecimentos MG, 30 médicos, CRM/RQE fictícios, vínculos, contatos, evidências e fila.

### Limpar somente demo

```bash
cd web
npm run seed:demo:clear
# Depois execute no SQL Editor:
# supabase/seed/999_clear_demo_data.sql
```

### Verificar colunas e integridade

No SQL Editor, execute:

```text
supabase/checks/verify_phase_ac.sql
```

Ou, como Master na app: `/configuracoes/diagnostico` → Schema Fase A–C + RPC `diagnostic_phase_ac_check`.

### Testar edição na interface

1. Login Master/Analista
2. Buscar “Médico Demonstração” ou “Hospital Demonstração”
3. Abrir detalhe → Editar → alterar biografia/serviço → Salvar
4. Confirmar toast de sucesso e dados persistidos após refresh
5. Visualizador: apenas consulta; sem botão Editar; sem `birth_date`; contatos restritos ocultos

## Dados fictícios (legado)

```sql
-- seed antigo (menor)
\i supabase/seed/validation_demo_data.sql
\i supabase/seed/cleanup_validation_demo_data.sql
```

- Prefixo `[DEMO-ATLAS]`
- Domínio `example.com`
- **Não** executar seed em produção sem revisão

## Testes por papel

| Papel | Pode | Não pode |
|-------|------|----------|
| Master | tudo operacional + usuários + diagnóstico + auditoria completa | — |
| Analista | CRUD operacional + validação + auditoria própria | promover papéis, diagnóstico, configs críticas |
| Visualizador | consultar oficiais autorizados | criar/editar/validar/importar/auditoria/usuários/diagnóstico |

Policies + Server Actions bloqueiam escalonamento; UI apenas esconde botões.

## Testes integrados (E2E)

Preparados com Playwright. **Não foram executados** sem `.env.local` / credenciais de teste.

```bash
cd web
# preencha web/.env.e2e (ignorado pelo Git) ou exporte:
# E2E_BASE_URL=http://127.0.0.1:3000
# E2E_SUPABASE_PROJECT_REF=projeto-de-teste
# E2E_ALLOW_DESTRUCTIVE_TESTS=true
# E2E_MASTER_EMAIL=...
# E2E_MASTER_PASSWORD=...
npx playwright install chromium
npm run test:e2e
```

Proteções: exige `E2E_ALLOW_DESTRUCTIVE_TESTS=true`, hostname local e `E2E_SUPABASE_PROJECT_REF`.

## Erros comuns

| Sintoma | Ação |
|---------|------|
| “Supabase não configurado” | Criar `web/.env.local` |
| RPC search_doctors falhou | Aplicar 004 (+ 006) |
| Bucket indisponível | Aplicar 002 |
| Perfil ausente | Conferir trigger 002/003 |
| RLS bloqueando | Papel/ativo + policies 003/005/006 |
| unaccent não encontrado | Schema `extensions` + migration 006 |
| Usuário inativo | Master reativa em `/usuarios` |

## Migration 006

Correções:

- schema `extensions` + grants de `normalize_search_text`
- `audit_logs` insert exige `actor_id = auth.uid()`
- self-insert de perfil só como `visualizador`
- RPC `diagnostic_foundation_check` (Master)

## Limitações atuais

- Sem CNES/CFM automático, scraping, WhatsApp, IA
- Importação ainda em prévia bruta
- Integração real depende de `web/.env.local` do proprietário
- E2E preparado, não executado sem credenciais

## Comandos

```bash
cd web
npm install
npm run lint
npm run typecheck
npm run test
npm run build
npm run seed:demo        # lista SQL fictício (não aplica remoto)
npm run seed:demo:clear  # lista SQL de limpeza
# npm run test:e2e  # somente com env de teste

cd ../etl
pytest
```

## Fluxo operacional do MVP

```text
Cadastrar estabelecimento
→ indicar hemodinâmica
→ cadastrar candidato
→ CRM/especialidade
→ vínculo + contato + evidência
→ fila de validação
→ aprovar/rejeitar
→ histórico
```
