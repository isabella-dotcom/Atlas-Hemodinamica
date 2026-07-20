# Importação de dados reais

Este documento descreve o fluxo operacional para trazer dados reais ao Atlas **sem** versioná-los no Git e **sem** inseri-los direto na base oficial.

## Princípios

1. Dados reais entram **somente** por arquivo (CSV/XLSX) fornecido manualmente ou por integração oficial futura.
2. Não há scraping do CFM, CAPTCHA ou inventário automático de CRM/RQE/contatos.
3. Todo arquivo passa por: **RAW → normalização → CANDIDATO → review_queue → aprovação humana → GOLDEN**.
4. Arquivos reais, ZIPs do CNES, relatórios com dados reais e evidências reais **não** devem ser commitados.

## Pré-requisitos

- Migrations até `012_import_workflow_enrichment.sql` aplicadas no Supabase.
- Usuário Master ou Analista ativo (sessão autenticada).
- Fonte cadastrada em `data_sources` (CNES, CFM, CRM estadual, SBHCI, hospital, clínica, site, Lattes, publicação, contato direto, planilha interna, etc.).

## Fluxo resumido

1. Baixar o template em `/importacoes`.
2. Preencher com dados obtidos legitimamente.
3. Informar entidade, fonte, competência e UF.
4. Enviar CSV ou XLSX.
5. Revisar mapeamento e prévia (20 linhas).
6. Corrigir erros (baixar relatório) se necessário.
7. Confirmar importação → gera candidatos + fila.
8. Revisar em `/validacao`.
9. Aprovar, rejeitar ou solicitar informações.
10. Conferir auditoria (ator = usuário autenticado da sessão).

## Duplicidades

- Hash SHA-256 impede reenvio do mesmo arquivo enquanto o lote não estiver `cancelado` ou `erro`.
- CRM duplicado (tipo+número+UF) no arquivo gera pendência.
- CNES duplicado no arquivo gera pendência.
- Vínculo resolve médico por **CRM+UF** e estabelecimento por **CNES** (nome é auxiliar).
- Contato sem origem (`source_origin` ou `source_code`) é inválido.

## Limpeza de lotes de teste

1. Cancelar o lote em `/importacoes/[id]` (libera o hash para reenvio).
2. Candidatos de teste: arquivar/excluir soft na interface ou usar seed clear **somente** para dados com `is_demo = true`.
3. Nunca apagar em massa a base oficial por engano.

## O que não fazer

- Não versionar `data/`, `imports/`, `uploads/`, `*.csv` reais, `*.xlsx`, `*.zip`.
- Não colocar e-mails de usuários reais no código.
- Não usar `service_role` no navegador.
- Não promover candidato a oficial sem revisão humana.
