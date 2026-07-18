# RELATÓRIO — Reserva de Garagem v1.5.4 (apresentação / interação)

**Data:** 18/07/2026 · **Repo:** `ApolloDSk/controle-garagem-hotel-gumz` (branch `master`).
**Nenhum repositório do Garage Spot foi tocado.** **SEM mudança de schema** — segue **DB v6**; nenhum
store novo. Versão puramente de **apresentação e interação**: a **alocação e os dados da v1.5.3 são
preservados** integralmente.

> Esta versão foi **retomada** após o notebook desligar no meio da aplicação. O código das 5 partes já
> estava escrito (e com testes) no working tree, sobre a tag `pre-v1.5.4`. Ao concluir, a pasta
> `amostras/` **já continha os PDFs reais** (colocados pelo usuário) — então a validação com PDF real,
> pendente desde a v1.5.1.1, **foi finalmente executada** (ver abaixo).

---

## Implementado (5.1–5.5)

### 5.1 — Amarelo derivado da bolinha "Aguardando"
- O amarelo do **bloco** passa a ser o **mesmo matiz** da bolinha "Aguardando" (`--amarelo` `#eab308`
  claro / `#ca8a04` escuro) — apenas com **alpha maior** no fundo (`--amarelo-bg`) para ler como amarelo
  de verdade, **sem virar "mostarda"**. Não se inventou um hue novo: a cor do bloco e a do contador/
  legenda "Aguardando" agora são **a mesma família**.

### 5.2 — Fim do laranja + "Carro 0N" dentro do bloco
- **Laranja de grupo REMOVIDO por completo** da apresentação: **cor de bloco, bolinha/indicador,
  ícone 👥 e legenda** de "Grupo / Múltiplos aptos" **não existem mais**. A **cor e a bolinha do bloco
  seguem o STATUS REAL** da própria reserva (azul confirmado / amarelo aguardando / etc.). Reservas da
  mesma pessoa com **status diferentes → cores diferentes**.
- **Preservação da alocação:** internamente a categoria `laranja_*` continua sendo usada **apenas como
  chave de alocação** (confirmada, comportamento inalterado). O status visível é lido de `garagemOrig`
  (status real preservado antes da mutação) — a **cor nunca mais** reflete "laranja".
- **"Carro 0N" DENTRO do bloco:** quando **a mesma reserva** tem **mais de um carro**, cada bloco
  mostra "Carro 01", "Carro 02"… **junto de nome / `#nº · Ap`** (nunca etiqueta externa). **1 carro →
  sem esse rótulo.** `mapaCarrosPorReserva` numera só blocos de CARRO (exclui motos e hospedados). O
  tooltip também traz "Carro 0N".

### 5.3 — Checkbox "Mostrar reservas editadas manualmente" + área ampliada
- O checkbox abaixo do overbooking foi **renomeado** para **"Mostrar reservas editadas manualmente"** e
  passa a exibir uma **área ampliada** (`montarEditadasManuais`, pura) que lista, agrupado por reserva:
  **status alterado manualmente** (Confirmado/Aguardando/Sem garagem, incl. hospedados que saíram),
  **reservas incluídas manualmente** (✍️ — **continuam no mapa**, com garagem, e re-editáveis) e
  **posição ajustada / vaga extra**. Os overrides **persistem**; o checkbox só mostra/oculta a área.

### 5.4 — "Vaga extra" no menu de status **só em overbooking** (via de acesso)
- No editor de status de uma reserva **em overbooking**, o `<select>` ganha a opção **"➕ Vaga extra
  (EXTRAn)"**. **Via de acesso garantida:** aparece a partir de onde o usuário está (o menu de status),
  **mesmo sem nenhuma extra em uso** — não depende de já ter usado uma extra. Se as **3 extras** já
  estiverem ocupadas **no período**, a opção aparece **DESABILITADA com a razão** ("sem vaga extra livre
  no período"), em vez de sumir.
- **Escolher NÃO altera o status:** grava só o **placement `EXTRAn`** (+ auditoria), preservando o
  `statusManual` (`colocarEmVagaExtra`). **Confirmado mantém a mesma extra** (`extraSlotLivreParaSelf`
  ignora o próprio `nro`); **"Sem garagem" libera** a extra. `extraLivreNoPeriodo` acha a 1ª extra livre
  **no período** (não apenas a vazia).

### 5.5 — Destaque persistente ao clicar
- Clicar numa reserva aplica um **destaque persistente** (`definirDestaque`/`aplicarDestaqueClique`):
  contorno vivo **sem escurecer o mapa** (ao contrário da busca). **Permanece após fechar o detalhe.**
  Clicar em **outra** reserva **move** o destaque (sempre só uma). **Clique no vazio** (abaixo do limiar,
  sem pan) **limpa**; **pan do fundo NÃO limpa** (`moveu=true`). Reforçado a cada re-render
  (`aplicarDestaqueClique`).

### 5.6 — `APP_VERSION` → `v1.5.4` (rodapé).

---

## Decisões técnicas
- **Zero mudança de schema:** nenhuma parte precisou de store novo nem de subir o DB (segue **v6**). Tudo
  reusa `ajustes` (sentinelas `OVERBOOKING`/`EXTRAn`), `reservasManuais` e a auditoria já existentes.
- **Cor ≠ alocação:** a separação `garagem` (alocação, pode ser `laranja_*`) × `garagemOrig` (status
  real, dita a cor/bolinha) é o que permite remover o laranja **visual** sem tocar na alocação.
- **Via de acesso da vaga extra** foi tratada explicitamente: a opção nasce no menu de status (onde o
  usuário está), com estado **desabilitado + razão** quando não há extra livre — nunca um beco sem saída.
- **Destaque de clique** é estado de módulo (`destaqueNro`), reaplicado no render; independente da busca.

---

## Testes — 348/348 ✓ (sem `test.skip` mascarando)
- **ENGINE: 235/235** (+18): `mapaCarrosPorReserva` (Carro 0N por reserva; 1 carro sem rótulo);
  `extraLivreNoPeriodo` (1ª livre no período; 3 ocupadas → `null`); `extraSlotLivreParaSelf`;
  `montarEditadasManuais` (status + placement + incluída, com `noMapa` correto); `STATUS_EXTRA_SENTINEL`;
  amarelo derivado / fim do laranja.
- **INTEGRAÇÃO (jsdom): 73/73**: ajustes de render para as mudanças de apresentação (rodapé `v1.5.4`,
  checkbox renomeado, cor pelo status).
- **Playwright (Chromium): 40/40** — inclui os **2 hooks `[real]` agora RODANDO e verdes** (não mais
  pulados, pois há amostras): 5.2 (fim do laranja: "Carro 01/02" no bloco, cores pelo status, sem 👥);
  5.3 (checkbox renomeado; área lista incluída manual que segue no mapa + status); 5.4 (**via de acesso:
  "Vaga extra" no menu de status em overbooking, sem extra em uso**); 5.5 (destaque persiste após fechar
  o detalhe; pan NÃO limpa; clique no vazio limpa).

### Correção de harness (não mascara bug)
O hook `[real]` do **Comandas** usava `waitForFunction(async () => …>0)`: o predicado `async` retorna uma
Promise (sempre *truthy*), então o wait resolvia **de imediato** e a asserção lia o store **ainda vazio**
(o import é assíncrono e **reconstrói** o store — limpa → repopula), falhando com `0`. Trocado por
`expect.poll` (aguarda o callback async e repete até estabilizar). **O parser estava correto** — a prova
está na validação real abaixo.

---

## Validação com PDF real — **EXECUTADA** (amostras presentes)
A pasta `amostras/` **já contém os PDFs reais** (colocados pelo usuário em 18/07). Os dois hooks `[real]`
rodaram e **passaram**:
- **Comandas em aberto (real):** **21 hospedados** extraídos, dados limpos — aptos válidos (123, 127,
  243, 271, 276, 354, 356, 466…), nomes reais (EMERSON ZONZIN, VINICIUS ANDRE BORTOLUCCI, CELSO LUIZ
  BERTELLI MAEJI…), **períodos com ano de 4 dígitos** (entrada→saída), tipos **P/G/moto** e canais
  (BOOKING.COM, MOTOR OMNIBEES). **Encerra a pendência de validação do parser de Comandas** aberta desde
  a v1.5.1.1.
- **Listagem de reservas (real):** importa e renderiza sem regressão.

Como as amostras estão presentes, **o caminho de `amostras/` não é mais impresso** como pendência.

## Cópia única no Desktop
`reserva-garagem-index-v1.5.4.html` (standalone regenerado, 1.90 MB). Cópia anterior (`v1.5.3`) removida.
