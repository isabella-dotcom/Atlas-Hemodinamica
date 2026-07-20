# Operação Master — Isabella

Guia para entrar como Master, importar dados reais e promover candidatos à base oficial.

**Não** há e-mail fixo no código. A auditoria registra o ID do usuário autenticado na sessão (o perfil Master vinculado à conta usada no login).

## Passo a passo

1. **Entrar com a conta Master**  
   Faça login na aplicação publicada (Vercel) com a conta Master já criada no Supabase Auth. Confirme em `/configuracoes` ou no perfil que o papel é `master` e `is_active = true`.

2. **Acessar `/importacoes`**  
   Visualizadores são redirecionados para acesso negado. Master e Analista veem o assistente de importação.

3. **Baixar o template**  
   Na seção “Templates (fictícios)”, escolha a entidade (Médicos, Estabelecimentos, CRM/RQE, Vínculos, Contatos ou Evidências).

4. **Preencher com dados obtidos legitimamente**  
   Use apenas informações de fontes autorizadas (CNES, CRM, SBHCI, hospitais, Lattes, contato direto documentado, planilha interna etc.). Não invente CRM/RQE/contatos.

5. **Informar a fonte**  
   No formulário, selecione a fonte (`data_sources`), competência (ex.: `2026-01`) e UF.

6. **Enviar o arquivo**  
   Selecione CSV ou XLSX. O sistema calcula SHA-256, detecta encoding/delimitador e impede arquivo duplicado.

7. **Revisar a prévia**  
   Ajuste o mapeamento de colunas se necessário e confira as 20 primeiras linhas, totais de válidas/inválidas/duplicadas.

8. **Corrigir erros**  
   Se houver inválidas, baixe o relatório de erros no detalhe do lote, corrija a planilha e, se precisar reenviar o mesmo conteúdo, cancele o lote anterior (libera o hash).

9. **Confirmar a importação**  
   “Confirmar e gerar candidatos” grava RAW, cria registros em camada `candidato` e envia itens à `review_queue`. **Nada** vai direto para oficial/GOLDEN.

10. **Abrir `/validacao`**  
    A fila lista candidatos gerados pela importação (e demais pendências).

11. **Revisar os candidatos**  
    Confira CRM, estabelecimento, vínculo, contatos e evidências. Contatos restritos não são expostos a visualizadores.

12. **Aprovar, rejeitar ou solicitar informações**  
    Use as ações da fila. Somente após aprovação humana o registro sobe para a base oficial.

13. **Verificar auditoria**  
    Em `/auditoria`, confira eventos `import.preview`, `import.confirm`, `import.cancel`, `import.reprocess` com o **ID autenticado** da sessão (não um e-mail hardcoded).

## Lembretes

- Aplicar a migration `012_import_workflow_enrichment.sql` no SQL Editor se ainda não estiver no projeto remoto.
- Não versionar planilhas reais no Git.
- Não alterar variáveis da Vercel para esta operação.
- Reprocessar um lote não duplica linhas já vinculadas (idempotente).
