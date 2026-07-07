# RELATÓRIO — Reserva de Garagem v1.5.0

> **Status manual editável** (detalhe + Contato, com auditoria) + **filtro/área "Sem garagem
> (manual)"** + **sinalização de divergência com o PMS** + **arraste para dentro/fora do
> overbooking** (visual, não muda status). Entregue em 07/07/2026. Repo:
> `ApolloDSk/controle-garagem-hotel-gumz` (`master`). **Nenhum repositório do Garage Spot foi tocado.**

---

## Objetivo

Dar **autonomia** ao setor de reservas sem depender de um novo PDF do PMS: permitir **editar o
status** da reserva (Confirmado / Aguardando / **Sem garagem**) direto no app, com **registro de
quem/quando**, mantendo o ajuste **preservado na reimportação** e **sinalizando** quando ele diverge
do PMS. Em paralelo, estender o **arraste** para a área de **overbooking** como recurso de
**organização visual** (não altera status nem PMS). Tudo **sem backend** e **sem quebrar** nada das
versões anteriores.

---

## O que foi implementado

### Parte A — Status manual editável (5.1–5.6)

- **5.1 — Store `ajustes` estendido (não-destrutivo, DB segue v4):** cada registro passa a carregar
  `statusManual: "confirmado"|"aguardando"|"sem_garagem"|null`, `ultimaAlteracao:{funcionario,dataHora}|null`
  e a aceitar o sentinela `"OVERBOOKING"` em `vagaIdManual`. Registros antigos (só `vagaIdManual`) seguem
  válidos (campos ausentes = `null`). **Nenhum store novo; nenhuma subida de versão do IndexedDB.**
- **5.2 — `statusEfetivo(reserva, ajuste)` (pura) injetado na alocação:** override manual **prevalece**
  sobre `statusDerivadoDoPDF` (amarelo→`aguardando`; resto→`confirmado`). `"sem_garagem"` **remove a
  reserva** do mapa/alocação (roteada para `resultado.semGaragem`). `"aguardando"`/`"confirmado"` ajustam
  a categoria usada pela alocação (garagem mutada **temporariamente e restaurada** — nada persiste no
  objeto). Fallback em erro → status do PDF.
- **5.3 / 5.4 — Editor de status no detalhe (Mapa) e na aba Contato:** `<select>` reutilizável
  (`statusEditorHTML`). Ao alterar, grava `statusManual` + `ultimaAlteracao = {funcionario: <nome-texto
  do funcionário padrão>, dataHora: ISO}` (ou `"—"` se não houver padrão) e re-renderiza.
- **5.5 — Filtro + área "Sem garagem (manual)":** checkbox `#chk-semgar` (desligado por padrão) exibe a
  área com **cor distinta** (`--semgar`, `.secao-semgar`) **logo abaixo do overbooking**, listando as
  reservas `sem_garagem`, cada uma com editor para **voltar** o status → a reserva **retorna ao mapa**.
- **5.6 — Divergência com o PMS (`pmsDivergente`, pura):** override manual **≠** status do PDF → **badge**
  (detalhe/Contato) + **marcador ◆** (bloco do mapa / item da área) + tooltip com **quem/quando**. Some
  quando o PDF passa a bater. Na reimportação o app **mantém** o ajuste e apenas **sinaliza**.

### Parte D — Arraste no overbooking (5.7–5.8)

- **5.7 — `aplicarAjustes` com placement no overbooking:** `vagaIdManual="OVERBOOKING"` fixa a reserva na
  **área de overbooking** (não ocupa vaga; `placementOverbooking`/`placementValido`). As fixadas (em vaga
  ou overbooking) entram primeiro; a automática roda para as livres no espaço restante.
- **5.8 — Arraste estendido (reutiliza o fluxo v1.3.0):** os blocos da área de overbooking ficam
  **arrastáveis** e a área vira **alvo de drop** (`data-vaga="OVERBOOKING"`). Confirmações específicas para
  **dentro** ("organização visual — não altera status nem PMS") e **fora** ("do OVERBOOKING para a vaga
  X"). Conflito (`detectarConflito`) só ao cair em **vaga real**. Pan (fundo) e mover-vaga (bloco)
  inalterados. ✋ + **"Voltar ao automático"** limpa **só o placement** (mantém o status manual, se
  houver). **Motos continuam NÃO arrastáveis.** Datas **nunca** mudam (`touch-action:none`, X travado).

---

## Decisões técnicas

- **Override de status e placement de overbooking no MESMO store `ajustes`**, sem subir o DB (segue v4).
  `salvarAjuste` (placement) e `salvarStatusManual` (status) usam `_montarAjuste` e **preservam** os
  campos que não estão sendo editados.
- **`statusEfetivo` injetado** na alocação por **mutação temporária + restauração** da `garagem` do
  objeto (identidade preservada para os flags `_aloc/_over` do render); a cor do bloco/item passa a seguir
  `_statusEfetivo` (`corCls`/`itemContato`).
- **Ajuste manual NUNCA é sobrescrito pela reimportação do PDF** (mantido por `nro`, como `contatos`);
  divergência apenas **sinalizada** (`pmsDivergente`) para cobrir o caso de o usuário esquecer de
  atualizar o PMS.
- **Mover para overbooking libera a vaga e realoca os automáticos** (mesmo modelo do arraste de vaga da
  v1.3.0) — é **visual/organização, NÃO muda o status** (`statusEfetivo` intacto) nem o PMS. Fallback em
  erro → automático.
- **Versionamento 1.5.x:** incrementos pequenos (`1.5.1`, `1.5.2`, …); correção sobre patch = nível extra
  (`1.5.2.1`). **A 2.0 é reservada** e **não** sai sem ordem explícita do Douglas. Registrado no CLAUDE.md.

---

## Testes (todos verdes; sem `skip` mascarando)

- **Engine (unitários, Node puro):** **141/141** — inclui `statusDerivadoDoPDF`/`statusEfetivo` (override
  prevalece; inválido cai no PDF), alocação com override (sem_garagem sai; confirmado protegido; garagem
  restaurada), `pmsDivergente`, `placementOverbooking`/`placementValido`, `aplicarAjustes` com
  `"OVERBOOKING"` (não ocupa vaga; datas originais; livres realocam), overbooking→vaga, e coexistência
  `statusManual`+`vagaIdManual` (compat. de registro antigo).
- **Integração (jsdom + fake-indexeddb):** **47/47** — `salvarStatusManual` grava status + auditoria
  (funcionário-texto + dataHora ISO); `sem_garagem` tira do mapa e o checkbox mostra a área; voltar
  status retorna ao mapa; `statusManual` **sobrevive à reimportação**; divergência sinalizada no Contato;
  placement `"OVERBOOKING"` move ao overbooking, sobrevive à reimportação e "voltar" limpa só o placement.
- **Playwright (Chromium real):** **24/24** — smoke rodapé `v1.5.0`; status no Contato/detalhe reflete no
  mapa (Sem garagem remove; checkbox liga a área; voltar retorna); divergência sinalizada; arrastar
  vaga→overbooking fixa lá e overbooking→vaga reposiciona; Cancelar não muda nada; pan e mover-vaga
  seguem funcionando.

**Total: 212/212.** Nenhuma impossibilidade headless — todos os cenários rodaram determinísticos
(overbooking testado com viewport alto para o alvo de drop ficar visível).

---

## Regra de cópia única no Desktop

Ao gerar a cópia standalone, as cópias de versões anteriores são **removidas**, mantendo só a mais
recente. Resultado: o Desktop fica com **apenas** `reserva-garagem-index-v1.5.0.html`.

---

## Ressalvas

- **"Sem garagem (manual)" ≠ "SEM GARAGEM" do PDF:** o PDF com "SEM GARAGEM" continua **ignorado** no
  parser (nunca vira reserva). O status manual `sem_garagem` atua sobre reservas **que existem** no mapa,
  removendo-as visualmente e roteando-as para a área própria.
- **Confirmar um amarelo** (Aguardando→Confirmado) sem tamanho conhecido assume **vaga pequena** por
  padrão na alocação (a `garagem` original é restaurada; nada disso persiste).
- **Arraste no overbooking é visual** — não confirma vaga nem atualiza o PMS. A confirmação real de
  entrega/vaga continua fora do escopo (exige backend). Ver `PLANEJAMENTO.md`.
