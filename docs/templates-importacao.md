# Templates de importação

Templates disponíveis em `/importacoes` (botões de download) e em `web/public/templates/` (cabeçalhos vazios). Exemplos fictícios também são gerados pela UI via `buildTemplateCsv`.

## Entidades

| Arquivo | Entidade |
|---------|----------|
| `template_doctors.csv` | Médicos |
| `template_facilities.csv` | Estabelecimentos |
| `template_registrations.csv` | Registros CRM/RQE |
| `template_links.csv` | Vínculos médico–estabelecimento |
| `template_contacts.csv` | Contatos profissionais |
| `template_evidences.csv` | Evidências e fontes |

## Como preencher

1. Baixe o template da entidade desejada.
2. Mantenha a primeira linha (cabeçalhos) intacta.
3. Preencha linhas com dados obtidos de fontes legítimas.
4. Use `source_code` / `source_url` / `source_origin` conforme o modelo.
5. CRM: informe número **como texto** (preserve zeros à esquerda) + UF.
6. Não inclua CPF. Data de nascimento não faz parte do template de médicos (campo sensível, só Master/Analista via UI autorizada).

## Formatos aceitos

- CSV (UTF-8 recomendado; delimitador detectado)
- XLSX / XLS (primeira planilha)

## Fixtures de teste

Arquivos fictícios em `web/src/test/fixtures/` — únicos CSV/XLSX versionáveis além dos templates públicos.
