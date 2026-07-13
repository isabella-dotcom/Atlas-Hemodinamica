# Atlas da Hemodinâmica

Aplicação interna para construir, validar e manter a base nacional de médicos que atuam em Hemodinâmica e Cardiologia Intervencionista.

## Estrutura

```
├── web/                 # Next.js + TypeScript + Tailwind
├── supabase/migrations/ # Schema PostgreSQL + RLS
└── etl/                 # Python + pandas (importações)
```

## Camadas de dados

1. **Bruto** — `import_batches` / `raw_records`
2. **Candidato** — registros normalizados aguardando revisão
3. **Oficial** — aprovados por usuário autorizado

Importações **nunca** aprovam automaticamente.

Papéis no banco (`app_role`): `master`, `analista`, `visualizador` (viewer).

## Setup rápido (frontend)

```bash
cd web
cp .env.example .env.local
# preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```

A `SUPABASE_SERVICE_ROLE_KEY` **não** é necessária para o frontend.

## Checklist de ativação do Supabase

1. Criar projeto no Supabase.
2. Abrir o **SQL Editor**.
3. Executar as migrations **nesta ordem**:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_auth_and_storage.sql`
   - `supabase/migrations/003_fix_auth_profile_and_policies.sql`
4. Confirmar tabelas principais (`doctors`, `health_facilities`, `doctor_facility_links`, `users_profile`, etc.).
5. Confirmar RLS habilitado nas tabelas de domínio.
6. Confirmar buckets privados `evidences` e `imports` em Storage.
7. Criar o primeiro usuário em **Authentication → Users** (sem cadastro público na app).
8. Confirmar criação automática do perfil:

```sql
select up.id, up.full_name, up.role, up.is_active, au.email
from public.users_profile up
join auth.users au on au.id = up.id
order by up.created_at desc
limit 20;
```

9. Promover o primeiro usuário para **Master** (use o e-mail real do Auth):

```sql
update public.users_profile up
set role = 'master'
from auth.users au
where up.id = au.id
  and au.email = 'seu@email.com';
```

> A tabela `users_profile` possui coluna `email` (cópia para exibição), mas a promoção deve usar `auth.users` como fonte de verdade do login. O `id` de `users_profile` é o mesmo UUID de `auth.users` (não existe coluna `auth_user_id`).

10. Em **Project Settings → API**, copiar **Project URL** e **anon public** key.
11. Criar `web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

12. Executar `npm run dev` dentro de `web/`.
13. Entrar no sistema com e-mail e senha do Auth.
14. Abrir `/configuracoes/diagnostico` (somente Master) e clicar em **Executar diagnóstico**.
15. Confirmar Dashboard com contadores zerados (ainda sem dados reais).
16. Testar logout.
17. Em janela anônima, confirmar redirecionamento de rotas protegidas para `/login`.

### Fluxo de perfil

```text
Usuário criado no Supabase Auth
→ trigger handle_new_user cria users_profile
→ role inicial visualizador (viewer)
→ Master promove manualmente para master ou analista
```

Ninguém é promovido automaticamente a Master.

## Matriz de permissões

| Recurso                        | Master | Analista (Analyst) | Visualizador (Viewer) |
| ------------------------------ | ------ | ------------------ | --------------------- |
| Visualizar médicos oficiais    | Sim    | Sim                | Sim                   |
| Criar e editar médicos         | Sim    | Sim                | Não                   |
| Visualizar dados brutos        | Sim    | Sim                | Não                   |
| Importar arquivos              | Sim    | Sim                | Não                   |
| Validar candidatos             | Sim    | Sim                | Não                   |
| Administrar usuários           | Sim    | Não                | Não                   |
| Alterar papéis                 | Sim    | Não                | Não                   |
| Visualizar auditoria completa  | Sim    | Parcial (próprios) | Não                   |
| Exportar contatos              | Sim    | Conforme permissão | Não                   |
| Alterar configurações críticas | Sim    | Não                | Não                   |
| Diagnóstico técnico            | Sim    | Não                | Não                   |

Entidades principais usam **exclusão lógica** (`is_deleted`), sem delete físico via policies.

## ETL

```bash
cd etl
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
python normalize_import.py caminho/arquivo.csv --preview
pytest
```

## Scripts web

```bash
cd web
npm install
npm run lint
npm run typecheck
npm run test
npm run build
```

## Regras críticas

- CRM = número + UF
- Nome não é identificador único
- Toda informação com fonte
- Sem CPF
- RLS ativo
- Sem dados reais no GitHub
- Sem scraping que contorne CAPTCHA/bloqueios
- Sem aprovação automática na importação

## MVP (Minas Gerais)

- 10–20 estabelecimentos com hemodinâmica
- 50–100 médicos candidatos
- 20–40 médicos validados

Não avance para dados reais até o diagnóstico Master estar verde.
