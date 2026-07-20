# Segurança e dados (LGPD)

## Não coletar

CPF, CNS, dados de pacientes, endereço residencial, dados familiares, contato pessoal não profissional.

## Priorizar

CRM+UF, nome profissional, vínculo institucional, contatos institucionais, evidências públicas.

## Controles

- Contatos restritos ocultos ao visualizador (RLS existente)
- Overrides e auditoria por campo
- Pedidos de correção/exclusão/não contatar via campos de contato (`do_not_contact`, status)
- Service role só no worker
