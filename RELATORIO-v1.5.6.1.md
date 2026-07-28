# RELATÓRIO — v1.5.6.1

**Reserva de Garagem do Hotel Gumz** · repo `ApolloDSk/controle-garagem-hotel-gumz` (branch `master`)
**Data:** 27/07/2026 · **Base:** `v1.5.6` (commit `4bac75f`) · **Tags:** `pre-v1.5.6.1` → `v1.5.6.1`

> **Tema único:** corrigir a aparência do bloco **"Aguardando" (amarelo)** no mapa.
> **Correção puramente de CSS.** Nenhuma mudança de lógica, dados, schema (segue **DB v6**), store,
> layout, ordenação, comportamento, caminho de arquivo ou selo de gravação.

---

## 1. O problema

Desde a **v1.5.5**, `.cell-span.amarelo` era pintado com **`background:var(--amarelo)`** — a cor
**sólida e opaca** da bolinha "Aguardando". Consequências:

- o bloco lia como **laranja/tijolo**, não como amarelo;
- era o **único status fora do sistema de cores do app** (todos os outros são "vidro": fundo
  translúcido + borda sólida);
- exigiu um token só dele (`--sobre-amarelo`, quase preto) para o texto sobreviver ao fundo cheio,
  e um override extra em `.cell-info`;
- **a própria legenda discordava do mapa**: a caixinha "Aguardando" da legenda sempre usou
  `background:var(--amarelo-bg);border:1px solid var(--amarelo)` — ou seja, já era translúcida.

---

## 2. Fase 1 — auditoria (as três receitas, lado a lado)

Lido `garagem-app/index.html` **antes** de qualquer edição.

| | **AZUL** (confirmado) | **VERDE/teal** (hospedado) | **AMARELO** (aguardando) — **antes** |
|---|---|---|---|
| Regra | `.cell-span.azul` | `.cell-span.hospedado` | `.cell-span.amarelo` |
| **Fundo** | `var(--azul-bg)` → **translúcido**<br>`rgba(59,130,246,`**`.18`**`)` escuro<br>`rgba(37,99,235,`**`.12`**`)` claro | `var(--hosped-bg)` → **translúcido**<br>`rgba(20,184,166,`**`.18`**`)` escuro<br>`rgba(13,148,136,`**`.13`**`)` claro | **`var(--amarelo)` — SÓLIDO/opaco**<br>`#eab308` escuro · `#ca8a04` claro<br>⬅ **a propriedade divergente** |
| **Borda** | `1.5px solid var(--azul)` | `1.5px solid var(--hosped)` | `1.5px solid var(--amarelo)` ✔ (já igual) |
| **Texto (nome)** | `var(--nome-azul)`<br>`#93c5fd` escuro · `#1d4ed8` claro | `var(--nome-hosped)`<br>`#5eead4` escuro · `#0f766e` claro | `var(--sobre-amarelo)` = `#1a1205`<br>(token criado só para o fill sólido) |
| **`.cell-info`** | sem override → `var(--muted)` | sem override → `var(--muted)` | override `--sobre-amarelo` + `opacity:.8` ⬅ divergente |
| **Textura / gradiente** | nenhuma | nenhuma | nenhuma |
| **Estado destacado** | `busca-ativa`/`dup-isolando`: `opacity`+`grayscale` **genéricos**, sem exceção por cor | idem | idem — mas o fill opaco reagia de forma diferente ao `grayscale` |

**Cor da bolinha "Aguardando"** (contador/legenda): `--amarelo` = `#eab308` (tema escuro) /
`#ca8a04` (tema claro). Passa a ser **cor de borda/acento**, não fundo cheio.

**Onde o amarelo incide:** hook **único** — `.cell-span.amarelo`, atribuído por `corCls()`
(`res._statusEfetivo==='aguardando'` ou `garagemOrig==='amarelo'`). Cobre bloco normal, bloco
pequeno, bloco com "Carro 01/02" e `cortado-esq` (check-in no passado). Fora do mapa existe
`.ct-item.amarelo` (aba Contato), que é só `border-left-color` — **não** foi tocado.

### 2.1 Contradição encontrada no enunciado, e como foi resolvida

O prompt pedia **"texto escuro"**. Mas a auditoria mostra que, **no tema escuro**, azul e verde
**não** usam texto escuro: usam um **tint claro da própria matiz** (`#93c5fd`, `#5eead4`) sobre o
vidro escuro. Texto escuro ali seria ilegível e **reprovaria no item de contraste do próprio
checklist**.

O critério real do app é: **"um tom da própria matiz — claro no tema escuro, escuro no tema claro"**.
O token amarelo equivalente **já existia** e estava órfão desde a v1.5.5: **`--nome-amarelo`** =
`#fde047` (escuro) / `#854d0e` (claro — âmbar escuro/marrom-amarelado, exatamente o descrito no
prompt). Foi ele que passou a ser usado. Assim o amarelo espelha azul/verde **e** passa no contraste
nos dois temas.

---

## 3. O que mudou (implementação)

Arquivo: `garagem-app/index.html` (CSS + `APP_VERSION`).

| Antes | Depois |
|---|---|
| `--amarelo-bg:rgba(234,179,8,.30)` | `--amarelo-bg:rgba(234,179,8,`**`.18`**`)` — alpha do `--azul-bg`/`--hosped-bg` |
| `--amarelo-bg:rgba(202,138,4,.22)` (claro) | `--amarelo-bg:rgba(202,138,4,`**`.12`**`)` — alpha do `--azul-bg` claro |
| `--sobre-amarelo:#1a1205` (2 temas) | **removido** (não é mais definido nem usado) |
| `.cell-span.amarelo{background:var(--amarelo);…}` | `.cell-span.amarelo{background:`**`var(--amarelo-bg)`**`;border:1.5px solid var(--amarelo)}` |
| `.cell-span.amarelo .cell-nome{color:var(--sobre-amarelo)}` | `…{color:`**`var(--nome-amarelo)`**`}` |
| `.cell-span.amarelo .cell-info{color:var(--sobre-amarelo);opacity:.8}` | **regra removida** (herda `--muted`, como azul/hospedado) |
| `APP_VERSION='v1.5.6'` | `APP_VERSION='v1.5.6.1'` |

**Resultado:** o amarelo é agora **"vidro amarelo claro, com borda amarela e texto na matiz"** —
a mesma engrenagem do "vidro azul" e do "vidro verde", parametrizada para amarelo. Os **mesmos
tokens de design** (`--X` / `--X-bg` / `--nome-X`), para não divergir de novo.

**Não mudou:** matiz (continua a da bolinha, regra da v1.5.4); nenhuma reintrodução de laranja
(`--laranja` segue nos mesmos 4 usos de **alerta**: grande-em-vaga-pequena, `.tt-warn`,
`.ct-fone-aviso` e a legenda do tracejado); nenhuma exceção por cor no destaque da busca/isolamento
de duplicata; azul, verde/teal, vermelho e roxo **byte a byte iguais**.

---

## 4. Testes — **406/406 verdes, sem `skip` mascarando**

| Suíte | Antes (v1.5.6) | Agora | Novos |
|---|---|---|---|
| `npm run test:engine` | 253 | **264** | +11 |
| `npm run test:integration` (jsdom) | 88 | **91** | +3 |
| `npx playwright test` (Chromium real) | 46 | **51** | +5 |
| **Total** | 387 | **406** | **+19** |

**Engine (CSS-fonte):** fundo é `--amarelo-bg` e nunca `var(--amarelo)`; borda idêntica à do azul e
do hospedado a menos da matiz; **alpha de `--amarelo-bg` = alpha de `--azul-bg`/`--hosped-bg`** nos
dois temas e sempre `< 1`; nome em `--nome-amarelo`; `--sobre-amarelo` não definido nem usado; sem
override de `.cell-info`; contraste do texto ≥ 4.5:1 nos dois temas; **matiz é amarela (38°–70°) e
distante do `--laranja` (~25°)**; azul/hospedado/vermelho/moto com as regras intactas; nenhum bloco
com fundo laranja; legenda e bloco com a mesma receita; destaque genérico sem exceção por cor.

**jsdom (CSSOM + DOM):** as três regras chegam ao CSSOM com a mesma estrutura; blocos aguardando e
confirmado renderizados **sem nenhum estilo inline** (cor vem só da classe); busca escurece o
amarelo pela regra genérica.

**Playwright (propriedades COMPUTADAS em Chromium real):**
1. bloco Aguardando × Confirmado — **alpha do fundo igual e < 1**, mesma espessura/estilo/raio de
   borda, borda com alpha 1, **só a matiz difere** (e é amarela, não laranja), `.cell-info` idêntico;
2. **contraste do nome ≥ 4.5:1 nos dois temas**, medido sobre o fundo **realmente percebido**
   (composição alpha do fundo do bloco sobre o fundo da célula);
3. azul/hospedado/moto intactos: todos translúcidos, borda sólida, nenhuma matiz laranja;
4. no destaque da busca o amarelo recebe **a mesma `opacity` e o mesmo `filter`** do azul e
   **continua translúcido** (não vira bloco opaco);
5. **"Carro 01"/"Carro 02"** e blocos pequenos aguardando: todas as variações com **exatamente a
   mesma receita computada** (1 valor distinto no conjunto).

**Ajustes de versão nos testes existentes:** asserções de `APP_VERSION`/rodapé atualizadas de
`v1.5.6` para `v1.5.6.1` (engine, jsdom e e2e).

### Validação com PDF real (`amostras/`, emissão **10/jul**)

`npx playwright test -g "\[real\]"` → **2/2 verdes**:
- **Comandas real → 21 hospedados** extraídos (mesmo número da v1.5.4/v1.5.6);
- **Reservas real → sem regressão**.

Nenhuma regressão funcional: como esperado de uma mudança só de CSS, parser, alocação, arraste,
congelamento de layout, duplicatas e Contato seguem idênticos.

---

## 5. Deploy

1. Suíte inteira verde (406/406, sem `skip`) + hooks `[real]` verdes.
2. `node build-standalone.js` → **`garagem-app/controle-garagem-standalone.html` regenerado** (1,92 MB),
   já com a nova regra e `APP_VERSION='v1.5.6.1'`.
3. Commit `v1.5.6.1: amarelo claro e translucido no mesmo estilo do azul/verde (fim do bloco solido alaranjado)`.
4. Tags `pre-v1.5.6.1` e `v1.5.6.1` no remote.
5. **Cópia única no Desktop:** `reserva-garagem-index-v1.5.6.1.html` (versões anteriores removidas).

---

## 6. Documentação

- **CLAUDE.md** — nova seção "Comportamentos da v1.5.6.1 a preservar" com a **receita única de bloco
  de status** (fundo `--X-bg` translúcido + borda `1.5px solid var(--X)` + nome `--nome-X`), a regra
  do **alpha padrão** `.18`/`.12`, o **critério real do texto** (tint no escuro / tom escuro no claro —
  registrado para não se perder) e a proibição de voltar ao fill sólido. A seção 6.1 da v1.5.5 foi
  marcada como **revertida**.
- **PLANEJAMENTO.md** — v1.5.6.1 entregue; item do amarelo sólido da v1.5.5 marcado como revertido;
  backlog seguinte **inalterado** (executável desktop; adiados de sempre).
- **HANDOFF.md** — estado atual → **v1.5.6.1**; lista de tags completada.

---

## 7. Declaração

Repo certo (`controle-garagem-hotel-gumz`), **nenhum repositório do Garage Spot tocado**; tags
`pre-v1.5.6.1` e `v1.5.6.1` no remote; `APP_VERSION` = `v1.5.6.1`; auditoria da Fase 1 reportada com
as três receitas lado a lado; o amarelo passou a ser **claro e translúcido no mesmo estilo do
azul/verde** (fundo na mesma opacidade + borda sólida amarela + texto na matiz, legível nos dois
temas), **sem laranja e sem bloco sólido**; azul, verde, vermelho e roxo **intactos**; sem mudança de
schema, lógica ou layout; selo de gravação e caminhos intactos; suíte **406/406 verde sem `skip`
mascarando**; validação com PDF real de 10/jul executada e verde; Desktop só com a v1.5.6.1; docs
atualizadas.
