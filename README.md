# Atlas da Hemodinâmica

Aplicação interna para construir, validar e manter a base nacional de médicos que atuam em Hemodinâmica e Cardiologia Intervencionista.

## Estrutura

```
├── web/                 # Next.js + TypeScript + Tailwind
├── supabase/migrations/ # Schema PostgreSQL + RLS
└── etl/                 # Python + pandas (importações)
```

## Recursos implementados (núcleo MVP)

- Autenticação Supabase + perfis (`master` / `analista` / `visualizador`)
- Dashboard com indicadores, pendências e atividade recente
- Busca unificada de médicos (RPC `search_doctors`)
- CRUD de médicos, estabelecimentos, vínculos, contatos e evidências
- Registros profissionais (CRM/RQE) e especialidades
- Fila de validação com assumir / aprovar / rejeitar
- Fontes, auditoria e gestão de usuários (Master)
- Diagnóstico técnico (Master)
- Pontuação de confiança explicável (`explain_doctor_confidence`)

## Rotas

| Rota | Descrição |
|------|-----------|
| `/login` | Acesso interno |
| `/dashboard` | Indicadores |
| `/medicos` | Busca e lista |
| `/medicos/novo` | Cadastro de candidato |
| `/medicos/[id]` | Detalhe com abas |
| `/estabelecimentos` | Lista e filtros |
| `/estabelecimentos/novo` | Cadastro |
| `/estabelecimentos/[id]` | Detalhe com abas |
| `/validacao` | Fila de validação |
| `/importacoes` | Prévia bruta de arquivos |
| `/fontes` | Catálogo de fontes |
| `/auditoria` | Eventos de auditoria |
| `/usuarios` | Papéis (Master) |
| `/configuracoes/diagnostico` | Diagnóstico (Master) |
| `/acesso-negado` | Sem permissão |

## Fluxo operacional do MVP

```text
Cadastrar estabelecimento
→ indicar serviço de hemodinâmica
→ cadastrar ou importar candidato
→ adicionar CRM e especialidade provável
→ vincular ao estabelecimento
→ adicionar contato institucional
→ anexar evidência
→ enviar para validação
→ revisar
→ aprovar ou rejeitar
→ manter histórico
```

## Camadas de dados

1. **Bruto** — `import_batches` / `raw_records`
2. **Candidato** — registros normalizados aguardando revisão
3. **Oficial** — aprovados por usuário autorizado

Importações **nunca** aprovam automaticamente.

## Migrations

Execute nesta ordem no SQL Editor:

1. `001_initial_schema.sql`
2. `002_auth_and_storage.sql`
3. `003_fix_auth_profile_and_policies.sql`
4. `004_unified_doctor_search.sql` — busca, validation_status, evidências, confiança
5. `005_audit_and_integrity_improvements.sql` — `write_audit_log`, índices e policies

### 004 — motivo e impacto

- Extensões `unaccent` e `pg_trgm`
- Colunas: `validation_status`, `do_not_contact`, status de evidência, justificativa de coordenador
- Funções: `search_doctors`, `explain_doctor_confidence`
- Rollback manual: dropar funções/colunas/enums criados nesta migration

### 005 — motivo e impacto

- RPC `write_audit_log`
- Constraints de unicidade (CRM principal, especialidade principal, contatos)
- Validação de coordenador/datas em trigger
- Rollback manual: dropar função/trigger/índices e restaurar policies anteriores

## Estratégia de auditoria

Auditoria de negócio é registrada pela **camada de serviços** (Server Actions) via RPC `write_audit_log`.  
Não há triggers genéricos em todas as tabelas (evita ruído). Não duplicar o mesmo evento em trigger + serviço.

## Setup

```bash
cd web
cp .env.example .env.local
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=
npm install
npm run dev
```

Promover Master:

```sql
update public.users_profile up
set role = 'master'
from auth.users au
where up.id = au.id
  and au.email = 'seu@email.com';
```

## Matriz de permissões

| Recurso                        | Master | Analista | Visualizador |
| ------------------------------ | ------ | -------- | ------------ |
| Visualizar médicos oficiais    | Sim    | Sim      | Sim          |
| Criar e editar médicos         | Sim    | Sim      | Não          |
| Visualizar dados brutos        | Sim    | Sim      | Não          |
| Importar arquivos              | Sim    | Sim      | Não          |
| Validar candidatos             | Sim    | Sim      | Não          |
| Administrar usuários           | Sim    | Não      | Não          |
| Alterar papéis                 | Sim    | Não      | Não          |
| Visualizar auditoria completa  | Sim    | Parcial  | Não          |
| Diagnóstico técnico            | Sim    | Não      | Não          |

## Pontuação de confiança

Faixas: 0–39 baixa · 40–59 precisa validação · 60–79 moderada · 80–100 alta.  
A pontuação **não** promove automaticamente a `especialista_confirmado`.

## Contatos e evidências

- Contatos com `do_not_contact` não entram como disponíveis na busca
- Viewer não vê valores restritos/completos indevidos
- Evidência não aprova automaticamente; status: pendente/aceita/rejeitada/expirada/necessita_revisao

## Testes

```bash
cd web
npm run lint
npm run typecheck
npm run test
npm run build

cd ../etl
pytest
```

## Seed opcional

Não há seed automático de dados reais. O sistema funciona com banco vazio.  
Não execute dados de médicos/hospitais reais no GitHub.

## Limitações atuais

- Sem coleta CFM/CNES/scraping
- Sem WhatsApp, e-mail transacional, IA ou geolocalização
- Importação ainda em modo prévia bruta (ETL externo)
- Remote GitHub não configurado nesta etapa

## Próximos passos

1. Conectar Supabase real e aplicar migrations 001–005
2. Validar diagnóstico Master
3. Cadastrar estabelecimentos e candidatos fictícios de MG
4. Evoluir importação CNES (futuro, com fonte oficial)
