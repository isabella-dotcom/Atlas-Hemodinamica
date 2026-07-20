# Arquitetura — ingestão automática

Fluxo principal:

```text
FONTES OFICIAIS → DOWNLOAD → RAW/source_files → NORMALIZAÇÃO
→ MATCHING → CANDIDATOS (layer=candidato) → review_queue
→ edição humana / overrides → aprovação → GOLDEN
```

## Componentes

| Camada | Onde |
|--------|------|
| Catálogo de fontes | `etl/config/sources.yaml` |
| Worker Python | `etl/atlas_etl/`, `etl/cli.py` |
| Fila de jobs | tabelas `ingestion_*` (migrations 013–017) |
| Disparo | `/importacoes` → RPC `enqueue_ingestion_job` |
| Execução | GitHub Actions (fora da Vercel) |
| Planilha manual | canal auxiliar em `/importacoes` (já existente) |

## Dependências de schema

- **012** enriquecer importação manual (recomendada antes de 013+)
- **013–017** jobs, arquivos, normalizados, matching, observações, overrides, RLS/RPCs

Não executar migrations automaticamente no remoto — aplicar no SQL Editor.

## Regras de ouro

- Nunca insert em `layer=oficial` pelo worker
- Nunca inferir RQE / especialista_confirmado
- Overrides manuais bloqueiam overwrite de campo
- Service role só no GitHub Actions / Docker
