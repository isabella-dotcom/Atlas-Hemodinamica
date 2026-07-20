# Operação — ingestão

1. Aplicar migrations **012** (se pendente) e **013→017** no Supabase.
2. Cadastrar secrets no GitHub Actions.
3. Login Master/Analista → `/importacoes`.
4. Nova ingestão: fonte CNES, UF `MG`, competência, opcional URL fallback.
5. Acompanhar `/importacoes/jobs/[id]`.
6. Revisar candidatos em `/validacao`.
7. Editar/overrides no detalhe do médico/estabelecimento.
8. Aprovar para oficial apenas pela fila.

## Primeira ingestão MG

1. Informar competência desejada (ex. `2026-06`).
2. Se a descoberta automática falhar, colar URL oficial do arquivo no fallback.
3. Iniciar job → aguardar worker → abrir fila.
