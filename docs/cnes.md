# CNES

## O que ingerimos

Estabelecimentos, profissionais, vínculos, serviços, equipamentos, CBO, município/UF, sinais SUS, contatos institucionais, competência.

## Descoberta

`atlas_etl.discovery.discover_cnes_files` monta candidatos a partir do catálogo + competência/UF, ou usa URL oficial de fallback.

## Códigos de serviço/equipamento

Os arrays `codes` em `hemodynamics_rules.yaml` começam **vazios** até validação contra o dicionário da competência (`tbTipoEquipamento`, classificações de serviço). Hints textuais pontuam de forma conservadora.

Antes de produção MG: baixar dicionário da competência, documentar códigos reais no YAML e em `docs/regras-hemodinamica.md`.

## Storage

```text
imports/cnes/{UF}/{competencia}/{arquivo}
```

Bucket privado; hash SHA-256; skip duplicados.
