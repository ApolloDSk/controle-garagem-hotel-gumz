# RELATÓRIO — Reserva de Garagem v1.5.1

**Data:** 08/07/2026 · **Repo:** `ApolloDSk/controle-garagem-hotel-gumz` (branch `master`).
**Nenhum repositório do Garage Spot foi tocado.**

---

## Objetivo

Completar o controle com **dois documentos**:

1. **Listagem de Reservas** (quem vai chegar — já lido desde a v1.0.0).
2. **Comandas em aberto** (hospedados que **já fizeram check-in** e usam garagem — **NOVO**).

Além de: dois slots identificados com **emissão** visível, **bloqueio de documento mais antigo**,
**validação por presença de informação** e **trava anti-duplicação** entre os documentos.

---

## Implementado (5.1–5.9)

### PARTE A — Ingestão (dois slots, emissão, validação)
- **5.1 — Dois slots** "Reservas (PDF)" e "Hospedados (Comandas)" no cabeçalho, cada um com botão,
  rótulo e **info própria** (data/hora do upload **e** data/hora de **emissão** do documento em uso),
  persistidas por slot (`garagem_upload_info` / `garagem_upload_info_hosp`) e sempre visíveis.
  Parse **sempre pelo conteúdo**, nunca pelo nome do arquivo.
- **5.2 — Validação por informação** (`validarDocumentoReservas` / `validarDocumentoComandas`,
  puras): gera o controle se o documento **tem as infos** (parse extrai ≥1 registro), **mesmo em
  formato/PMS diferente**; **não gera + avisa** ("As informações deste documento não conferem…")
  quando não tem. Recusa cruzada natural: comanda no slot de reservas (e vice-versa) não confere.
- **5.3 — Bloqueio de documento mais antigo** (`compararEmissao`, pura, por slot): emissão
  `igual/mais recente` → aplica; `mais antiga` → **recusa** e mantém o atual (sem opção de forçar);
  `desconhecida` → prossegue sinalizando "emissão não detectada". Emissão via **`CreationDate`**
  (PDF.js `getMetadata()`), com **reforço** de data impressa (`extrairEmissaoImpressa`).

### PARTE B — Parser do Comandas
- **5.4 — `parsearComandas`** (pura): blocos por `<apto> <NOME> <entrada dd/mm/aaaa> <saída
  dd/mm/aaaa> [<CANAL>] Extras` (canal opcional); veículo pelo PDV **GARAGEM** —
  `CARRO DE PASSEIO`→P, `CAMIONETE`→G, `MOTO`→moto; **sem tamanho → `null` (padrão de lançamento
  atual)**. Auto-filtro (só bloco com ≥1 GARAGEM), multi-veículo (tipos distintos → um ocupante por
  tipo). Tolera valor colado, descrição quebrada em linhas e "Origem" repetindo o apto; **nunca
  quebra** num bloco malformado (pula com log). O tipo é decidido **só** no segmento do lançamento
  GARAGEM, evitando falso-positivo do canal (ex.: "MOTOR OMNIBEES" não vira moto).

### PARTE C — Hospedados no mapa
- **5.5 — Store `hospedados`** (DB **v4→v5**, `keyPath:'id'`): criado no `onupgradeneeded` só se não
  existir, sem tocar em `reservas`/`contatos`/`gestao`/`ajustes`/`envios`. Chave estável
  `${apto}__${entradaISO}__${tipoVeiculo||'x'}`. **Só o comandas escreve** — reconstruído (clear+put)
  a cada import (retrato do momento).
- **5.6 — Alocação:** cada hospedado vira um objeto **reserva-like** (`hospedadoParaReserva`,
  `ehHospedado:true`, garagem por tipo). Como são **confirmados** com **check-in no passado**, a
  ordenação por entrada os coloca **primeiro** na `alocarVagas` (ocupantes já presentes); as reservas
  ocupam o espaço restante. Borda cortada (v1.1.0) preservada.
- **5.7 — Render próprio:** classe `.cell-span.hospedado` (cor teal `--hosped`, "check-in feito"),
  rótulo "🏠 Hospedado · Ap X", entrada na **legenda**, tooltip/detalhe com nome/apto/período/canal/
  tipo de veículo.
- **5.8 — Anti-duplicação** (`dedupeReservasHospedados`, pura): mesmo **apto** + período sobreposto
  → **vale o hospedado**; a instância de reserva correspondente **não é desenhada** (rede de
  segurança; o Doug passará a gerar o relatório de reservas sem "In Efetuado").

### PARTE D — Hospedados arrastáveis e editáveis (reuso da v1.5.0)
- **5.9 — Overrides manuais para hospedados** reusando o store **`ajustes`** (chaveado pelo `nro`
  sintético = chave estável do hospedado):
  - **Arraste** de vaga / para dentro-fora do **overbooking** — mesmo fluxo da v1.5.0.
  - **Edição = "Marcar saída / remover"** — editor próprio "🏠 Na garagem ↔ 🚗 Saiu (sem garagem)";
    "Saiu" grava `statusManual='sem_garagem'` → sai do mapa (libera a vaga) → vai para a **MESMA área
    "Sem garagem (manual)"**, **re-editável** (restaura "na garagem"). **Auditoria** gravada
    (funcionário padrão + data/hora).
  - **Persistência na reimportação:** o override sobrevive ao reimport do comandas (chave estável);
    se a comanda **ainda mostra** o hóspede com garagem, **divergência** sinalizada ("marcado como
    saiu manualmente — comanda ainda mostra garagem", com quem/quando) — reusa `pmsDivergente`.
- **5.10 —** `APP_VERSION` → **`v1.5.1`**.

---

## Decisões técnicas

- **Hospedado como objeto reserva-like** com `nro` sintético (chave estável) foi a decisão-chave:
  reaproveita **toda** a máquina existente (alocação, arraste, status manual, área "Sem garagem",
  divergência, auditoria) sem duplicar lógica. `statusDerivadoDoPDF` devolve `confirmado` para um
  hospedado (azul) → marcar "saiu" (`sem_garagem`) **automaticamente** gera a divergência e o roteia
  para a área "Sem garagem (manual)".
- **Veículo opcional → padrão:** `garagemDeTipoVeiculo(null)` = `azul_pequeno` (o padrão de
  lançamento atual quando a GARAGEM não traz o tamanho).
- **Emissão via `CreationDate`** (metadados do documento), com reforço de data impressa; comparação
  em função pura por slot. **Bloqueio de documento mais antigo** mantém o atual, sem forçar.
- **Validação por presença de informação** (parse-based), **não por formato**: gera se as infos
  foram extraídas em **qualquer** formato/PMS; recusa+avisa se não.
- **Extrator do Comandas isolado/plugável** (`parsearComandas`, `tipoVeiculoDeSegmento`) — ponto de
  extração único, fácil de recalibrar.

### Nota honesta (calibração)
As heurísticas de extração do Comandas foram calibradas na **fixture do arquivo real do Desbravador**
(a única amostra disponível — **não há PDF de Comandas real no disco**, só o `LISTAGEM RESERVA.pdf`).
O desenho é **orientado à informação** para que outros PMSs com as mesmas informações funcionem;
formatos muito diferentes podem exigir **ajuste com amostras reais** (a fazer quando houver documentos
de outro PMS). O extrator do Desbravador está **sólido** e o ponto de extração **isolado**.

---

## Testes — 256/256 ✓ (sem `skip` mascarando)

- **ENGINE (unitários): 173/173** (141 da v1.5.0 + **32 novos**): emissão (`parsePdfDate`,
  `extrairEmissaoImpressa`, `compararEmissao`), parser do Comandas (fixture real com valor colado,
  descrição quebrada, canal ausente, multi-veículo, auto-filtro, tamanho opcional→padrão), validação
  por informação (gera com info / recusa sem info / recusa cruzada), chave estável + reserva-like,
  alocação de hospedado, anti-duplicação, hospedado editável (sem_garagem→sai + divergência).
- **INTEGRAÇÃO (jsdom + fake-indexeddb): 56/56** (47 + **9 novos**): migração v4→v5 (store criado,
  demais intactos), comandas→hospedados no mapa (vaga por tipo), anti-duplicação, hospedado editável
  (some do mapa → área Sem garagem → restaura, com auditoria), hospedado arrastável (placement na
  chave), override sobrevive ao reimport + divergência, reimport de um slot não afeta o outro +
  persistência ao reabrir, validação (comanda no slot de reservas recusada), bloqueio de emissão.
- **Playwright (Chromium real): 27/27** (24 + **3 novos**): smoke (rodapé `v1.5.1`, **dois slots**),
  subir comandas → hospedados no mapa (visual próprio, vaga por tipo, legenda), arrastar hospedado +
  "marcar saída" → área "Sem garagem (manual)", documento mais antigo recusado + arquivo sem info não
  gera + reimport de um slot não apaga o outro.

### Exercício de ponta a ponta (real, obrigatório)
Sob o servidor Playwright, o **`LISTAGEM RESERVA.pdf` real** foi subido pelo file-input do slot
Reservas: **37 reservas** parseadas e renderizadas (não-regressão) e a **emissão lida do documento
real** (`CreationDate` → 05/05/2026 18:09) exibida no slot; em seguida um Comandas sintético subiu
pelo slot Hospedados (1 hospedado alocado/renderizado com visual próprio). **Zero erros de console.**

---

## Cópia única no Desktop
`reserva-garagem-index-v1.5.1.html` (standalone regenerado). A cópia anterior
(`reserva-garagem-index-v1.5.0.html`) foi removida (regra permanente: só a versão mais recente).

## Ressalvas
- Sem amostra real de Comandas de outro PMS → recalibração ficará para quando houver (extrator
  isolado). Motos hospedadas seguem **não arrastáveis** (como as motos de reserva). Hospedados não
  aparecem na aba Contato (é ferramenta de telefonema para reservas), mas as reservas duplicadas por
  um hospedado são removidas de lá também.
