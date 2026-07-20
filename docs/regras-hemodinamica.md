# Regras de hemodinâmica

Arquivo: `etl/config/hemodynamics_rules.yaml` (versionado).

## Pontuação

Cada regra gera pontos + justificativa. A UI/logs devem expor `score_parts`.

## Classificações automáticas permitidas

- `possivel_candidato`
- `atuacao_provavel`

## Exigem humano

- `atuacao_institucional_confirmada`
- `especialista_confirmado`

## Proibido

- Inferir RQE
- Promover a oficial
- Merge só por nome

## CBO documentados (oficiais)

Ver `etl/config/cbo_rules.yaml` — ex.: 225120 cardiologista, 225210 cirurgião cardiovascular. Confirmar presença na `tbCbo` da competência.
