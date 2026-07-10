# RELATÓRIO — Reserva de Garagem v1.5.2 (Patch 1: correções visíveis)

**Data:** 10/07/2026 · **Repo:** `ApolloDSk/controle-garagem-hotel-gumz` (branch `master`).
**Nenhum repositório do Garage Spot foi tocado.** Sem mudança de schema (IndexedDB segue **v5**).

---

## Objetivo
Corrigir 4 coisas visivelmente erradas: (5.1) nomes de reservas caindo em "Hóspede"; (5.2) obs de
indisponibilidade tratada como "sem garagem"; (5.3) amarelo × laranja pouco distintos + ícone no
grupo; (5.4) aviso de overbooking sem informar as datas.

## Implementado

### 5.1 — Nomes das reservas (menos "Hóspede")
- **Causa:** `extrairNomes` dependia de um `indexOf('Hóspedes :')` **exato**; quando o texto do PDF
  traz o cabeçalho com grafia/spacing diferente (ou a seção só tem nome de empresa), caía no fallback
  "Hóspede".
- **Correção (zero-regressão):** 1) tenta o **formato exato** original (blocos que já funcionavam
  ficam **idênticos**); 2) senão, cabeçalho tolerante exigindo **plural + ":"** (`/H[óÓoO]spedes\s*:/i`
  — não casa o singular "Hóspede" de cabeçalhos de coluna); 3) senão, **heurística** `nomeHeuristico`
  varre o bloco pela 1ª linha que pareça nome próprio (2+ palavras, maiúscula inicial, pulando
  empresas/cabeçalhos/datas/valores/termos de tarifa). Um 4º passo aplica a heurística mesmo quando a
  extração primária termina em "Hóspede".
- **Hospedados (verdes) não regridem** (extração de nome deles é independente).
- **Validação com PDF real:** o `LISTAGEM RESERVA.pdf` disponível **não** reproduz o "Hóspede" (0
  casos hoje). Os casos relatados estão num PDF **mais recente** que **não está no disco** →
  **validação com esse PDF fica PENDENTE das amostras** (ver caminho no fim). A correção é orientada à
  estrutura + testada com fixtures que reproduzem as falhas (cabeçalho sem espaço / sem cabeçalho).

### 5.2 — Obs de indisponibilidade → "sem garagem" (com rede de segurança)
- **Causa:** `classificar` via a substring "GARAGEM" dentro de "SEM DISPONIBILIDADE DE GARAGEM" e
  marcava a reserva como **confirmada** (errado).
- **Correção:** `obsIndicaSemGaragem(obs)` (pura) detecta, **só na OBS**: frases explícitas
  ("SEM DISPONIBILIDADE DE GARAGEM/VAGA", "INFORMAD[OA] QUE NÃO TEM/HÁ VAGA/GARAGEM", "CIENTE QUE NÃO
  …", "SEM VAGA DE GARAGEM") → **sem garagem**; **nunca** marca quando a obs afirma que TEM/COM garagem
  (ou "GARAGEM CONFIRMADA"). A reserva ganha `semGaragemPDF` → `statusDerivadoDoPDF` vira `sem_garagem`
  → **sai do mapa** e vai para a **relação "Sem garagem"** (mesma da v1.5.0, agora incluindo as
  derivadas do PDF; editável, com divergência se o usuário reverter).
- **Rede de segurança:** obs **ambígua** (indisponibilidade perto de garagem/vaga, sem bater no
  explícito) → **lança normal** (com garagem) e **NOTIFICA** num painel de **avisos**: "Reserva #X
  (apto Y): a observação sugere possível 'sem garagem' — confira no PMS…". Também há um aviso quando há
  reservas movidas para "Sem garagem" pela obs e o filtro está desligado (discoverabilidade).

### 5.3 — Amarelo × laranja distintos + ícone de grupo
- **Cores** (variáveis CSS) agora com **hue nitidamente diferente**: **Aguardando = ouro/amarelo**
  (`--amarelo` dark `#eab308` / light `#ca8a04`, nome `#fde047`/`#854d0e`); **Grupo = laranja forte**
  (`--laranja` dark `#f97316` / light `#ea580c`, nome `#fdba74`/`#9a3412`), com preenchimento .20/.22.
- **Ícone 👥** discreto no bloco de **Grupo/Múltiplos aptos** (`.grupo-ico`) + **legenda** atualizada
  (ajuda leitura rápida e daltônicos).

### 5.4 — Aviso de overbooking com período
- `overbookingPeriodos(overflow, ini, fim)` (pura): dias com ≥1 overbooking na janela, agrupados em
  faixas consecutivas → rótulo legível (ex.: **"12/07 e 15/07–16/07"**). O badge `#alert-over` passa a
  mostrar **"⚠ Overbooking em {datas}"** (some quando não há overbooking).

### 5.5 — `APP_VERSION` → `v1.5.2`.

---

## Preservação
Tudo de v1.1–v1.5.1.1 intacto (dois documentos/slots, parser do comandas, hospedados
nomes/visual/arraste/edição, alocação, status manual + "Sem garagem" + divergência, anti-duplicação,
emissão/bloqueio de documento antigo, arraste de vaga/overbooking, Gestão/Modelos, Backup, histórico,
pan). Selo de gravação intacto; reabrir não perde dados; sem mudança de schema.

## Testes — 291/291 ✓ (+ 2 hooks `[real]` pulados por falta de amostra; sem `skip` mascarando)
- **ENGINE: 198/198** (+17): cabeçalho tolerante/heurística de nome; `obsIndicaSemGaragem`
  (explícito/ambíguo/tem-garagem); parser marca `semGaragemPDF` e derivado vira `sem_garagem`;
  `overbookingPeriodos` (dia único, faixa, "e", vazio).
- **INTEGRAÇÃO (jsdom): 63/63** (+6): nome com "Hóspedes:" sem espaço aparece; obs indisponibilidade →
  fora do mapa + aviso + área "Sem garagem"; obs ambígua → permanece + aviso; obs com garagem não
  vira sem garagem; ícone de grupo no bloco laranja; aviso de overbooking com a data.
- **Playwright (Chromium): 30 passam** (+3): amarelo × laranja com `borderColor` distinto + ícone de
  grupo; aviso de overbooking com período; obs "SEM DISPONIBILIDADE" fora do mapa + aviso + nomes
  aparecem. (2 hooks `[real]` seguem pulados — pendentes das amostras.)
- **Exercício real:** `LISTAGEM RESERVA.pdf` reimportado — **0 "Hóspede"**, **0** falso
  sem-garagem/ambíguo, nomes íntegros, zero erros de console (blocos com "Hóspedes :" exato usam o
  caminho **idêntico** ao original).

## Validação com PDFs reais — PENDENTE (coloque os PDFs em `amostras/`)
Não há PDF de Comandas real nem o PDF de Reservas que reproduz o "Hóspede". Coloque-os em:

**`C:\Users\RBMarketing\Documents\GitHub\controle-garagem-hotel-gumz\amostras\`**

(nomes com `comanda` e `reserva`/`listagem`; os `.pdf` são gitignored por conterem dados de hóspedes)
e rode `npx playwright test -g "[real]"`. Assim que os PDFs estiverem lá, a validação roda de verdade
e este caminho deixa de ser impresso.

## Cópia única no Desktop
`reserva-garagem-index-v1.5.2.html` (standalone regenerado). Cópia anterior removida.
