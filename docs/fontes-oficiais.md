# Fontes oficiais

Configuração: `etl/config/sources.yaml`.

| Código | Status | Notas |
|--------|--------|-------|
| CNES | habilitada | FTP/portal DATASUS |
| OPENDATASUS | habilitada | portal dados abertos |
| SIA_SUS / SIH_SUS | **desativadas** | requer dicionário de procedimentos |
| INSTITUTIONAL | desativada | exige allowlist |
| IMPORT_CSV | auxiliar | planilha via app |

URLs não ficam espalhadas no código — apenas no YAML. Fallback por job: `parameters.fallback_url`.

CFM/CRM: **sem scraping**; validação assistida na UI do médico.
