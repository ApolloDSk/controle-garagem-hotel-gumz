# RELATÓRIO — Reserva de Garagem v1.5.3 (Patch 2: ferramentas)

**Data:** 10/07/2026 · **Repo:** `ApolloDSk/controle-garagem-hotel-gumz` (branch `master`).
**Nenhum repositório do Garage Spot foi tocado.** Migração não-destrutiva **DB v5→v6** (só `reservasManuais`).

---

## Implementado (5.1–5.5)

### PARTE A — Motos (2 = 1 vaga de carro; arrastáveis)
- `processarMotos` reescrito: **cada 2 motos ocupam 1 vaga de CARRO pequena** (pareáveis mesmo de
  **reservas diferentes**); **moto ímpar** ocupa uma vaga de carro **sozinha**, renderizada com
  "🏍 vaga p/ +1 moto". **Não há mais seção "Moto" separada** — motos vivem nas vagas de carro P
  (`vagaMoto` volta vazio).
- **Motos arrastáveis/editáveis** (removida a exclusão): o slot de moto é arrastável para uma vaga de
  carro (P/G), overbooking ou vaga extra, reusando o fluxo de arraste (Pointer Events, limiar, ghost,
  "Voltar ao automático"). **Duas motos fixadas na MESMA vaga pareiam ali** ("juntar com outra moto")
  — `aplicarAjustes` agrupa motos manualmente posicionadas por vaga e forma slots de até 2. Datas
  nunca mudam. `salvarAjuste` grava o placement por `nro` de cada moto.

### PARTE B — Busca com destaque
- Campo de busca (`matchBusca`, pura): casa por **nº da reserva, nome, apto ou modelo do veículo**
  (parcial, case-insensitive) em **reservas E hospedados**. **Destaque:** escurece o resto do mapa
  (`.busca-ativa`), **contorna** o resultado atual (`.busca-atual`) e faz **auto-scroll** até ele.
  **Múltiplos resultados:** contagem "N de M" + navegação **‹ ›** (Enter/Shift+Enter). **Limpar** (✕
  ou Esc) remove o destaque.

### PARTE C — Vagas extras (até 3, emergência)
- Seção **"Vagas extras"** com até 3 vagas, que **só aparece quando ≥1 está em uso** (some quando
  vazia). Sentinelas **`EXTRA1`/`EXTRA2`/`EXTRA3`** em `ajustes.vagaIdManual` (`placementExtra`,
  `placementValido` estendido). `aplicarAjustes` roteia a reserva/hospedado/moto para a vaga extra
  (`resultado.extras`) — **não conta nas vagas normais**. Arrastável para a seção quando visível.
- **Overbooking → vaga extra:** ao adicionar um manual que cai em overbooking, o app oferece a próxima
  `EXTRAn` livre (via diálogo).

### PARTE D — Adicionar reserva manual (botão ＋)
- Formulário: **nome (obrigatório)**, **entrada/saída (obrigatório)**, **modelo — Pequeno/Grande/Moto
  (obrigatório)**, nº da reserva e apto (opcionais). `validarReservaManual` valida; `montarReservaManual`
  grava em **`reservasManuais`** (DB v5→v6) com `origem:"manual"` + **auditoria** (funcionário padrão +
  data/hora). Entra na **alocação como as demais** (pelo tipo), fazendo o encaixe.
- **Não coube:** se cair em overbooking, pergunta "Deseja incluí-la em uma **vaga extra**?" — se sim e
  houver `EXTRAn` livre, fixa lá; se as 3 estiverem ocupadas, avisa que não há vaga extra.
- **Persistência + dedup "manter uma só"** (`dedupManuaisComPDF`/`manualJaNoPDF`): a manual **permanece**
  ao reimportar PDF; se a mesma reserva vier no PDF (mesmo **nº**, ou sem nº: mesmo **apto+período+nome**),
  **não duplica** — a do PDF passa a valer e o registro manual é **reconciliado** (removido do store).
  **Removível** (🗑 no detalhe). Marcada visualmente com **✍️**.

### PARTE E — Registro de edições manuais
- Painel **"✍️ Edições"** (`montarEdicoesManuais`, pura): lista **reservas adicionadas na mão** +
  **edições de status** (Confirmado/Aguardando/Sem garagem, incl. hospedados que saíram), cada item com
  **funcionário, data e hora** (reusa `ultimaAlteracao`/auditoria + `reservasManuais`). Mais recente
  primeiro.

### 5.6 — `APP_VERSION` → `v1.5.3`.

---

## Decisões técnicas
- **Motos como slots de vaga de carro:** `motoSlotPar`/`motoSlotSolo`; `alocarVagas` trata slots (pares
  e solos) uniformemente (`_motoSlot`). `aplicarAjustes` seedeia motos fixadas por vaga, pareando-as.
- **Sentinelas de placement** unificam vaga real (P/G), `OVERBOOKING` e `EXTRAn` no mesmo store
  `ajustes` (sem novo campo). `resultado.extras` carrega os ocupantes das 3 vagas extras.
- **Reserva manual isolada** em `reservasManuais` (nunca tocada pelo PDF) + dedup persistente na
  reimportação — garante "manter uma só" sem duplicar nem perder o manual.
- **Busca não-destrutiva:** marca os blocos no render (`marcarBusca`) e aplica dim/contorno/scroll
  (`aplicarDestaqueBusca`), reforçado a cada re-render do mapa.

### Nota honesta (amostras)
As heurísticas de extração (parser de reservas/comandas) seguem calibradas no **Desbravador**. A pasta
**`amostras/`** continua o ponto de validação com PDFs reais (`.pdf` gitignored). Estas ferramentas
(v1.5.3) não dependem de PDF real — foram exercitadas com o `LISTAGEM RESERVA.pdf` disponível.

---

## Testes — 325/325 ✓ (+ 2 hooks `[real]` pulados por falta de amostra; sem `skip` mascarando)
- **ENGINE: 217/217** (+19): motos (2=1 vaga cross-reserva; ímpar sozinha; par manual na mesma vaga);
  `matchBusca`; `placementExtra`/extras em `aplicarAjustes`/`extrasEmUso`/`proximaExtraLivre`;
  reserva manual (validação/montagem/alocação/dedup com nº e sem nº); `montarEdicoesManuais`.
- **INTEGRAÇÃO (jsdom): 73/73** (+10): migração v5→v6; 2 motos → 1 slot em P (sem seção Moto); moto
  arrastável (P5); busca (destaque/contagem/limpar/por modelo); vaga extra (surge só ocupada); adicionar
  manual pelo formulário (✍️ no mapa, persistência, auditoria, remoção); dedup "manter uma só"; manual
  sobrevive ao reimport; painel de edições.
- **Playwright (Chromium): 35 passam** (+5): moto arrastável para vaga de carro; busca destaca/conta/
  limpa; adicionar manual pelo formulário; manual que não cabe → diálogo de vaga extra → aparece na
  seção extra; painel de edições.
- **Exercício real:** `LISTAGEM RESERVA.pdf` → 36 reservas (janela), 0 "Hóspede"; **reserva manual (moto)
  adicionada pelo formulário** renderizada; **busca** destacou o resultado. Zero erros de console.

## Cópia única no Desktop
`reserva-garagem-index-v1.5.3.html` (standalone regenerado). Cópia anterior removida.

## Validação com PDF real — pendente das amostras
`amostras/` segue sem os PDFs. Caminho para largá-los:
**`C:\Users\RBMarketing\Documents\GitHub\controle-garagem-hotel-gumz\amostras\`**
(`comanda` / `reserva`|`listagem`; `.pdf` gitignored). Rodar `npx playwright test -g "[real]"`.
