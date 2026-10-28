# RELATÓRIO — v1.5.8

**Reserva de Garagem do Hotel Gumz** · repo `ApolloDSk/controle-garagem-hotel-gumz` (branch `master`)
**Data:** 27/10/2026 · **Base:** `v1.5.7` (commit `a161016`) · **Tags:** `pre-v1.5.8` → `v1.5.8`

> **Oito itens num patch só, todos no motor do mapa:** (A) arraste nunca sobrepõe, (B) encaixe estável
> em filtro/reimportação/reabertura, (C) conflito PMS × edição manual decidido pelo usuário, (D) reverter
> "sem garagem", (E) vaga extra para Confirmada, (F) motos com quantidade real e pareamento visível,
> (G) aviso de mais de 1 carro por apartamento, (H) central de pendências.
> **DB segue v6, nenhum store novo, nenhuma dependência nova, nenhum arquivo novo.** Campos novos são
> **opcionais** dentro do store `ajustes` (e do `hospedados`). Amarelo "Aguardando" e selo de gravação
> **intocados**. Nenhum repositório do GarageSpot foi aberto.

---

## 1. Fase 1 — auditoria (o que foi encontrado ANTES de editar)

### 1.1 (A) Sobreposição — causa raiz
`aplicarAjustes` colocava **toda** posição fixada (manual do store `ajustes` **ou** congelada do layout)
direto na linha da vaga, **sem conferir se já havia alguém no período**:

```js
else{ ... (sec==='P'?seedP:seedG)[idx].push(r); }   // sem checagem de sobreposição
```

Reproduzido: 2 carros + 1 moto gravados em `P5` no mesmo período → os **3** desenhados em `P5`.
As portas de entrada eram:
- o modal "⚠ … já tem X em datas sobrepostas. **Mover mesmo assim?**" aceitava soltar sobre ocupado;
- `confirmarMover` só tirava o conflitante do **congelamento** — se ele tivesse ajuste **manual**, o
  manual prevalecia e ele continuava fixado na mesma vaga → sobreposição;
- **vaga extra** e **moto** não passavam por checagem nenhuma (`vagaValida(EXTRAn)` é falso; `ehMoto` pulava).

**Não é regressão da chave por carro da v1.5.7** — o defeito já existia na v1.5.5; a v1.5.7 só manteve.

### 1.2 (B) Realocação no filtro e na reimportação — causa raiz
1. A alocação rodava **só sobre a janela visível** (`conjuntoAtivo()` filtrava por `dataInicio/dataFim`).
   Mudar o período mudava o **conjunto** alocado.
2. O congelamento (v1.5.5) era ativado por **assinatura `janela + conjunto de carros`**. Qualquer troca de
   filtro ou relatório novo (mesmo com 1 reserva a mais) mudava a assinatura → `layoutSeed=null` →
   **alocação automática fresca de tudo** → o encaixe manual "invisível" (quem foi reacomodado pelo
   arraste sem ser o arrastado) se perdia.
3. O congelamento vivia **só em memória**: reabrir o app perdia tudo o que não era ajuste manual gravado.

### 1.3 (C/D) Edição manual e "sem garagem" travado
- `ajustes` guardava por carro só `statusManual`, `vagaIdManual` e `ultimaAlteracao`. **Nada do PMS** era
  guardado no momento da edição → impossível saber depois se o PMS mudou.
- (D) Reproduzido no navegador. O "sem garagem" **só** podia voltar pela área "Editadas manualmente", que:
  (1) fica escondida atrás do checkbox; (2) **só listava o que caía no período visível** — fora da janela,
  a reserva sumia do mapa **e** da edição; (3) não aparece no Contato (que lista só "Aguardando");
  (4) quando o PMS passava a dizer "tem garagem", o override manual prevalecia **sem aviso visível**
  (o ◆ só aparece na área escondida). Efeito colateral: reverter pela área agia pelo **nº da reserva** e
  gravava "Confirmado" em **todos** os carros dela, inclusive os que nunca estiveram sem garagem.

### 1.4 (E) Vaga extra
A opção só existia com `emOver=!!res._over` (em `abrirDetalheReserva` → `ctx.overbooking`).

### 1.5 (F) Motos — causa na LEITURA da quantidade (com amostra real que reproduz)
A amostra `Comandas em aberto - 10jul26.pdf` tem o apto **279** com
`GARAGEM   2   ESTACIONAMENTO MOTO` (coluna **Qtde = 2**). `parsearComandas` ignorava a Qtde e fazia "um
veículo **por tipo**" → **1 moto**; e a chave `apto__entrada__tipo` colapsaria as duas de qualquer forma.
O mesmo vale para "3 motos" (Qtde 3 → 1). **Não foi preciso pedir PDF novo**: a amostra reproduz o formato.
O relatório de **Reservas** da amostra **não tem nenhuma moto** — por isso **nenhuma heurística nova foi
criada** para quantidade de motos na obs de reservas (seria chute). Se aparecer "GARAGEM 03 MOTOS" num
relatório de reservas, mandar o PDF.
Além disso, o pareamento (`processarMotos`) era guloso por data, sem priorizar a mesma reserva, e o mapa
não dizia de quem era cada moto.

### 1.6 (G) Carros por apartamento
`expandirCarrosDaReserva`/`distribuirCarrosPorApto` atribuem o apto de cada carro (v1.5.7). Multi-apto
com total N distribui round-robin (5 aptos / 04 → [1,1,1,1,0]). **Nenhuma** checagem de >1 carro por apto.

### 1.7 (H) Duplicatas
`tagDuplicatas` (v1.5.6) marca `_dupCluster`, selo ⧉ com ✕ (dispensa em memória, limpa a cada importação).
**Regra intacta** — só passou a ser contada na central.

---

## 2. O que foi implementado

### 2.1 (A) Arraste nunca sobrepõe e nunca é recusado
- **`planejarDrop(aloc, unidade, origem, destino, ordemVisual)`** (puro, ENGINE). Destino livre → só a
  arrastada muda. Destino ocupado → cada ocupante sobreposto é deslocado na **1ª opção que couber**
  (compatibilidade P/G + período):
  1. **Troca** — vai para a vaga de origem da arrastada (se a origem for vaga real/extra);
  2. **Vaga de baixo** — a imediatamente abaixo do destino **na ordem da tela** (respeita cima↔baixo);
  3. **Livre compatível mais próxima** (empate → a de baixo);
  4. **Overbooking** (posição, **não** status).
  Grande só vai para vaga G; moto solo sobre moto solo **divide a vaga** (não desloca).
- O modal de confirmação mostra **antes** quem vai para onde e por quê ("troca de lugar", "vaga de baixo",
  "vaga livre mais próxima", "não há vaga livre"). Ao confirmar: **aviso curto** ("FULANO foi para a vaga
  P9" / "FULANO foi para o overbooking"), gravação **em lote** (um render só), deslocado passa a ter
  **posição manual**, e **evento no log** de edições (funcionário + data/hora).
- **Invariante no motor:** `aplicarAjustes` agora encaixa fixações com `_cabeNaLinha` /
  `_encaixarMotoNaLinha`. Fixação manual que colidiria (dado antigo, PMS mudou datas) é **rebaixada para o
  encaixe automático** (a mais antiga fica), marcada `_colisaoManual` e **avisada** no painel de avisos.
  `verificarSobreposicoes(aloc)` é a varredura do invariante (rede de segurança: se um dia achar algo,
  mostra aviso — não esconde).

### 2.2 (B) Encaixe estável
- **A alocação roda SEMPRE sobre o conjunto completo** (`conjuntoCompleto()`); o filtro de período só
  recorta o que é desenhado. A assinatura `janela+conjunto` foi **removida**.
- **Layout persistido** (`congelarLayoutComImpressao`): chave do carro → `{v: vaga, f: impressão}`, onde a
  impressão = datas + tamanho. Guardado no **localStorage** (`garagem_layout`) — é estado derivado (como a
  ordem das vagas), **não** é store novo; se faltar, o automático recompõe de forma determinística.
- **Reimportação:** quem não mudou fica **exatamente** onde estava; reserva **alterada** (impressão
  diferente) perde a semente e é re-encaixada; **nova** é encaixada ao redor. Primeira importação (app
  vazio) = alocação automática completa, como antes.
- **Overbooking automático nunca derruba confirmado** (preservado): se um confirmado novo não couber, ele
  toma a vaga de aguardando(s) **semeado(s) não manual(is)** — só esses são re-encaixados
  (`_promoverConfirmados`). Logo após importar, quem estava no overbooking **automático** volta a disputar
  vaga (`soltarOver`, 1 render); entre renders comuns, ninguém pula sozinho para uma vaga liberada.
- O **Contato** passou a ler as flags da **mesma alocação do mapa** (antes recalculava uma alocação só da
  janela, que podia discordar do mapa).

### 2.3 (C) Conflito PMS × edição manual
- Toda edição manual (status, posição, sem garagem, vaga extra, deslocamento) grava junto um **retrato do
  PMS** do carro: indicação de garagem, check-in, check-out, tipo de veículo, qtd de carros
  (`retratoPMS`). Edições antigas (≤ v1.5.7, sem retrato) recebem o retrato **ao abrir** e **antes de cada
  importação** (o PMS ainda é o anterior) — dali em diante passam a ser comparadas.
- Reimportar: PMS **igual** ao retrato → nada. **Diferente** → pendência "Conflito PMS" (`conflitoPMS`).
- Painel **lado a lado** "Sua edição (PMS quando você editou)" × "PMS agora", campos divergentes
  destacados, com a sua edição e quem/quando:
  - **Manter minha edição** → retrato = PMS atual (só volta a avisar se o PMS mudar de novo);
  - **Usar o PMS** → status manual sai se a indicação de garagem mudou; a posição manual **fica se ainda
    couber** (tipo + período), senão o carro é re-encaixado.
- Até decidir, **vale a edição manual**. Editar de novo **não** apaga um conflito pendente (o retrato antigo
  é mantido). Decisões vão para o log.

### 2.4 (D) Reverter "sem garagem"
- A área "Editadas manualmente" lista **tudo** (não depende mais do período). O seletor de uma reserva
  "Sem garagem" chama `reverterSemGaragem`: muda **só os carros que estão sem garagem** (os demais carros
  da reserva mantêm o status que tinham), para Confirmado ou Aguardando, com a mesma auditoria + evento.
- Marcar "Sem garagem" agora **libera a posição** (o carro sai do mapa); ao voltar, ele é encaixado pelas
  regras normais **sem mexer em quem já está encaixado**.

### 2.5 (E) Vaga extra para Confirmada
- O detalhe oferece "➕ Vaga extra (EXTRAn)" também para reserva **Confirmada** (além de overbooking a
  chegar e hospedado em overbooking, da v1.5.6). Mover muda **só a posição**.
- Quem está numa extra ganha "↩ Vaga normal livre (P#)" (`vagaNormalLivre`: 1ª vaga normal livre e
  compatível no período). Arrastar da extra para uma vaga continua valendo.

### 2.6 (F) Motos
- **Leitura:** Qtde da linha `GARAGEM` (dois layouts: `GARAGEM 2 ESTACIONAMENTO…` real e
  `GARAGEM 06/07/26 2 ESTACIONAMENTO…`), **o maior Qtde do tipo, nunca a soma das diárias**. N veículos do
  mesmo tipo = N registros; o 1º mantém a chave antiga (`apto__entrada__tipo`, compatível com ajustes já
  gravados), os demais ganham `__2`, `__3`; todos com o mesmo `nro` (grupo).
- **Alocação:** (1) motos da **mesma reserva** pareiam primeiro entre si; (2) ímpar com ímpar de **outra**
  reserva no mesmo período; (3) uma ímpar que chega pareia com uma moto **já encaixada sozinha** antes de
  ocupar vaga nova. N motos entram = N motos no mapa.
- **Visual (roxo continua sendo a cor de moto, sem cor nova):** cada moto mostra **nome + #nº (ou 🏠 Ap) +
  "Moto X de N"** e a **letra do grupo** (Ⓐ, Ⓑ…) quando a reserva tem >1 moto; vaga com reservas
  diferentes fica **tracejada** com o selo "⇄ compartilhada" e o tooltip mostra as duas reservas. Clicar
  numa moto abre **aquela** moto e destaca **todas** as motos da reserva (inclusive a que divide vaga).

### 2.7 (G) 1 carro por apartamento
- `excessoCarrosPorApto`: >1 carro **com garagem** no mesmo apto (reserva + apto; hospedado: apto +
  entrada) → pendência "Mais de 1 carro no apartamento". Motos e reservas manuais não contam.
- **Confirmar exceção** → registro `EXC:<grupo>` no store `ajustes` com a qtd do PMS (+ funcionário/data/
  hora no log); **só volta a avisar se o PMS mudar a quantidade**.
- **Corrigir** → abre o detalhe do carro excedente para marcá-lo "Sem garagem" (fluxo existente); a
  pendência some sozinha quando sobra 1 carro com garagem.
- Multi-apto com total ≤ nº de aptos **não** gera pendência (5 aptos / TOTAL 04 → 0).

### 2.8 (H) Central de pendências
- Botão **"Pendências: N"** na barra do mapa: neutro em zero; com pendências, borda vermelha discreta e
  contador em pílula. Soma **conflito (C) + excesso (G) + duplicata (v1.5.6)**.
- Lista agrupada por tipo com nome / reserva / apto / o que divergiu; itens de reservas **fora do mapa**
  aparecem marcados "fora do mapa". Clicar → ajusta o período se a reserva estiver fora da janela (só
  visualização), liga a área "Editadas" se for "sem garagem", **destaca** (reusa o destaque de clique) e
  **abre a resolução** (conflito → painel lado a lado; excesso → Confirmar/Corrigir; duplicata → isola o
  par como na v1.5.6).
- **Selos próprios no bloco:** `≠` conflito PMS × edição, `×N` carros no mesmo apto; o `⧉` da duplicata
  continua igual. Clicar no selo abre a resolução. Na área "Editadas", a reserva em conflito ganha
  "≠ conflito PMS".

### 2.9 Log de edições
Cada ajuste ganhou `historico` (opcional, até 40 eventos por carro): posição, deslocamento por arraste,
decisões de conflito, exceção confirmada, volta de "sem garagem". O painel "✍️ Edições" lista tudo.
Registro só é apagado se não sobrar nada nele (status, posição, histórico, exceção).

---

## 3. Dados e migração (não-destrutiva)
- **IndexedDB segue `garagemGumz` v6.** Nenhum store novo, nenhum store renomeado, nenhum caminho mudado.
- `ajustes` (keyPath `nro`): campos **opcionais** novos `retratoPMS`, `historico`, `excecao`; nova família de
  chave `EXC:<grupo>` (não colide com chave de carro nem com nº legado). Registros antigos seguem válidos.
- `hospedados`: campos opcionais `idxVeiculo`, `qtdVeiculos`; id do 2º+ veículo com sufixo `__N`.
- `localStorage`: chave nova `garagem_layout` (estado derivado; o botão Limpar apaga junto).
- Backup/restauração genéricos já levam os campos novos (dump por store).

---

## 4. Validação comparativa v1.5.7 × v1.5.8 nas amostras reais
Texto extraído pelo próprio PDF.js do app; ENGINE da tag `pre-v1.5.8` × ENGINE atual:

| | v1.5.7 | v1.5.8 | |
|---|---|---|---|
| Reservas (carros) | 101 | 101 | **conjuntos idênticos** (id, nº, apto, carro, totais, classe, datas, nome) |
| Comandas (veículos) | 21 | 22 | **única divergência = a correção F:** apto 279 (ADIL) 1 → **2 motos** (Qtde 2 no PDF) |
| Sobreposições na alocação do relatório real | — | **0** | |
| Pendências de >1 carro/apto no relatório real | — | 0 | |
| Duplicatas (regra v1.5.6) | 1 | 1 | **#27316** (ver abaixo) |

**Observação para o Doug — #27316:** é uma reserva de **2 quartos (APF e TST) ainda sem apto atribuído**
("-"). A regra da v1.5.6 (mesmo nº + mesmo apto + mesmo carro) a sinaliza como "possível duplicata". A v1.5.7
sinaliza igual quando o período inclui 18/07 (o teste antigo só não via esse dia). A regra **não foi
alterada** (ordem do prompt); agora ela aparece na central como 1 pendência, dispensável pelo ✕. Se quiser
que "apto não atribuído com tipos de quarto diferentes" não alerte, é decisão sua para uma próxima versão.

---

## 5. Testes — **495/495 verdes, sem `skip`**
- **Engine 325/325** (era 293): Qtde da comanda (2 e 3 motos, dois layouts), chave do hospedado,
  pareamento (mesma reserva primeiro, compartilhada, ímpar que chega), "Moto X de N" + grupo, invariante
  (manual × manual, moto em vaga de carro, extra, 3 motos na mesma vaga), semente com impressão (mantém /
  re-encaixa), overbooking automático segura × solta após importar, reimport +1 nova, confirmado nunca
  derrubado, plano do arraste (livre, troca, de baixo, mais próxima, overbooking, grande só em G, moto
  divide vaga), **fuzz de 60 arrastes aleatórios** (carros, motos, extra, overbooking) = 0 sobreposição e
  nenhum carro perdido, retrato/diff/conflito, excesso por apto (exceção, PMS muda a qtd, corrigido,
  multi-apto ≤ e >), soma da central, volta da extra, log.
- **Integração 103/103** (era 100): retrato gravado na edição + reimport igual/diferente + Manter;
  retrato preenchido em edição antiga antes do reimport; Qtde 2 de moto → 2 hospedados, chave antiga no 1º.
- **Playwright 67/67** (era 56): troca (snapshot), garagem lotada → overbooking com aviso, filtro
  Hoje/Semana/Mês/Ano/período sem mover nada, reimport igual/+1 nova/**reabrir** idênticos, conflito pelos
  dois botões + log, "sem garagem" em conflito fora do mapa, reverter "sem garagem" sem mover ninguém,
  vaga extra p/ Confirmada e volta, 3 motos + 1 de outra reserva (compartilhada, "Moto X de 3", grupo,
  destaque), >1 carro no apto (Confirmar exceção / Corrigir), central somando os 3 tipos.
- **Hooks `[real]`** rodaram com as amostras: Comandas → 22 hospedados; Reservas → mapa desenhado, 0
  sobreposição, só o caso conhecido #27316 sinalizado.
- **Bomba de calendário corrigida no teste `[real]` de Reservas:** ele dependia da data de hoje (janela
  hoje+30) e a amostra é de julho — **a v1.5.7 falhava igual** em out/2026 (verificado). Agora o teste
  enquadra o período nas datas da própria amostra.

---

## 6. Entrega
- `APP_VERSION` = **v1.5.8**; standalone regenerado (`node build-standalone.js`).
- Tags `pre-v1.5.8` (antes de mexer) e `v1.5.8` no remote.
- Desktop: **somente** `reserva-garagem-index-v1.5.8.html` (as anteriores `reserva-garagem-index-v*.html`
  removidas).

## 7. Fora de escopo (v1.5.9 em diante)
nº OTA por `Origem (…):`, chaves `[ota]`/`[canal]`, botão copiar mensagem + ícone "contatado", busca no
Contato, Limpar preservando modelos, executável, legenda/índices, tom do amarelo.
