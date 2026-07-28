# RELATÓRIO — v1.5.7

**Reserva de Garagem do Hotel Gumz** · repo `ApolloDSk/controle-garagem-hotel-gumz` (branch `master`)
**Data:** 28/07/2026 · **Base:** `v1.5.6.1` (commit `68309be`) · **Tags:** `pre-v1.5.7` → `v1.5.7`

> **Cinco itens num patch só:** (A) fim da explosão de carros, (B) arraste por carro individual,
> (C) "Carro X de N" recomputa na baixa, (D) botão "Limpar informações", (E) realce de fim de semana
> e feriado calculado. **Sem mudança de schema (segue DB v6), sem store novo, sem dependência nova,
> sem arquivo novo.** O tom do amarelo "Aguardando" **não foi tocado**.

---

## 1. Fase 1 — auditoria (o que foi encontrado antes de editar)

### 1.1 Bug A — a explosão de carros: **causa raiz na GERAÇÃO, não no parsing**

Em `garagem-app/index.html`, o bloco que decidia a quantidade de carros vivia **dentro do
`blocos.forEach` do parser** — isto é, **rodava uma vez por APARTAMENTO**:

```js
blocos.forEach((bloco, idx) => {          // ← 1 iteração POR APARTAMENTO
  const obsUp = (obs + ' ' + blocoFlat).toUpperCase();
  let totalCarros = 1;
  ...  const mTotal = obsUp.match(/TOTAL[\s:]+0*(\d+)\s+CARROS/);
       if (mTotal && !mAptosCarros) totalCarros = parseInt(mTotal[1]);
  if (totalCarros > 1) for (let v = 0; v < totalCarros; v++) reservas.push({...});
});
```

A reserva **#26389** (família Henrichsen, Booking) tem **5 apartamentos** (352, 354, 355, 387, 390) e
o PDF repete a mesma observação em **todos** os blocos. Resultado: `5 blocos × 4 carros = 20` — exatamente
o "Carro 17 de 20" relatado.

**O regex lia o `04` corretamente.** Confirmado isolando a função: `carrosDeclaradosNoBloco` sobre
`"GARAGEM TOTAL 04 CARROS (03 PEQUENOS E 01 GRANDE)"` devolve `4`. Portanto **a causa raiz está na
geração**, e a trava do bloco [5.1] do prompt **não se aplica**: foi resolvido com **fixture sintético**,
sem precisar do relatório real mais novo.

**A distinção semântica que resolve** (o próprio PMS já a faz no texto, e o código não a explorava):

| Texto na obs | Significado | Comportamento |
|---|---|---|
| `GARAGEM 0N CARRO(S)` | declaração **por apartamento** | **soma** entre os blocos |
| `TOTAL 0N CARROS` | **total da reserva** | **nunca** multiplica pelo nº de aptos |
| `TOTAL X APARTAMENTOS E Y CARROS` | ambíguo | **ignorado** (regra da v1.0.0, intacta) |

É isso que faz o **#26161 (Henrides)** continuar correto — apto 129 = 1 + apto 130 = 2 = **3 vagas**,
porque ali a declaração é `GARAGEM 0N CARROS`, **por apartamento**.

### 1.2 Bug B — identidade do carro no arraste

O store `ajustes` tem `keyPath:'nro'` e **tudo** era chaveado pelo **nº da reserva**:
`salvarAjuste(res.nro, vaga)`, `ajustes[r.nro]` em `aplicarAjustes`, `congelarLayout` por `nro`,
`assinaturaLayout` por `nro`, e o comentário explícito no código: *"carros: 1 placement por nro (1º bloco)"*.
Ou seja, os N carros de uma reserva **dividiam um único registro** — mexer em um afetava o "carro 1".

### 1.3 Item C — "Carro X de N"

`mapaCarrosPorReserva(reservas)` agrupava por `nro` e contava **todos** os blocos de carro, **sem olhar
status**. Além disso era chamada em `renderMapa` **antes** de `aplicarAjustes`, quando `_statusEfetivo`
ainda nem existia.

### 1.4 Item D — stores

| Store | Conteúdo | No "Limpar" |
|---|---|---|
| `reservas` | importadas do relatório | **apaga** |
| `hospedados` | comandas em aberto | **apaga** |
| `ajustes` | posição + status manual | **apaga** |
| `reservasManuais` | adicionadas na mão | **apaga** |
| `contatos` | telefones | **apaga** (decisão do Doug) |
| `envios` | histórico de contato | **apaga** (decisão do Doug) |
| `gestao` | empresa, funcionários, modelos | **PRESERVA** |

### 1.5 Item E — colunas de dia

`mkDatesRow(datas, hoje)` já calculava `dt.getDay()` e marcava `.fds` (só `opacity:.55` no cabeçalho).
`mkRow` criava as `.cell` com `datas.forEach(() => ...)` — **sem saber a data da coluna**. Os blocos são
`.cell-span` com `position:absolute; z-index:5`, **por cima** das `.cell` — então pintar o fundo da `.cell`
já entrega o realce **atrás** de tudo, sem tocar nos blocos.

---

## 2. Implementação

### 2.1 (7.1) Carros = total da RESERVA

O laço do parser passou a apenas **registrar** o que cada apartamento declarou; a expansão em carros
acontece **uma vez por reserva**, depois do laço. Funções puras novas (todas no bloco ENGINE):

- `carrosDeclaradosNoBloco(obsUp)` → `{porApto, totalReserva}`;
- `distribuirCarrosPorApto(nBlocos, total)` → round-robin: **5 aptos / total 04 → `[1,1,1,1,0]`**;
- `repartirTiposCarro(obsUp, total)` → lê `"(03 PEQUENOS E 01 GRANDE)"`; **só vale se a soma bater com o
  total**, senão `null` e todos os carros usam o tipo já classificado (fallback seguro);
- `expandirCarrosDaReserva(blocos)` → junta tudo e devolve os carros da reserva.

**Resultado no caso de referência:** 4 carros (3 pequenos + 1 grande), 4 apartamentos com carro e
**1 apartamento sem** — o app **não decide qual**, isso é do check-in. `ehMultiplo`/`garagemOrig`/
`laranja_*` seguem exatamente como na v1.5.4 (alocação inalterada, cor pelo status real).

### 2.2 (7.2) Arraste por carro individual

**A chave do ajuste passou a ser o carro.** Confirmado com o Doug antes de editar: **o store `ajustes`, o
keyPath (`nro`) e a versão do DB (v6) NÃO mudam** — muda o **valor** gravado nesse campo, que passa a ser
`nro__apto__vagaIdx`. É a mesma engenharia que o **hospedado** já usa desde a v1.5.1 (chave sintética
gravada em `ajustes.nro`), então hospedados caem aqui sem nenhuma adaptação.

- `chaveCarro(res)` — id do carro (para hospedado, `id === nro`, cai igual);
- `resolverAjuste(res, ajustes)` — registro do carro, com **fallback LEGADO**: ajustes gravados por nº de
  reserva (≤ v1.5.6.1) continuam valendo para o 1º carro. **Nada é apagado, sem migração**; o próximo
  arraste converte o registro;
- `mapaChaveNro(reservas)` — chave de carro → nº da reserva, para os painéis continuarem **agrupando por
  reserva** ("Editadas manualmente" e o log "Edições");
- `congelarLayout` e `assinaturaLayout` passaram a operar por chave de carro; `fixadasCarroPorNro` virou
  `fixadasCarroPorChave`; `nrosConflitantes` virou `chavesConflitantes`;
- `carrosDaChave(k)` resolve os dois usos: **chave de carro** (detalhe do mapa) → aquele carro;
  **nº da reserva** (Contato, área "Editadas") → todos os carros — preservando o comportamento anterior de
  "mudei o status da reserva inteira";
- `span.dataset.chave` expõe a identidade do carro no DOM (o `data-nro` repete entre carros da mesma reserva).

**A regra da v1.5.5 continua valendo**, agora com a granularidade certa: destino livre não reacomoda
ninguém; destino ocupado reacomoda só o diretamente conflitante. Vale para vaga, overbooking, vaga extra
e motos (`chaveCarro(res.res1/res2)`).

### 2.3 (7.3) "Carro X de N" recomputa na baixa

`mapaCarrosPorReserva(reservas, ajustes)` ganhou o 2º parâmetro opcional: com ele, **N conta só os carros
que ainda têm garagem** (exclui `statusEfetivo === 'sem_garagem'`). De 5 carros, marcando 2 como sem
garagem, os 3 restantes viram **"Carro 01", "Carro 02", "Carro 03"** na hora. A ordem de desempate é a
mesma de sempre (`vagaIdx` → `apto` → `id`), então a numeração **não dança**.

### 2.4 (7.4) Botão "Limpar informações"

Na aba **Gestão**, num card próprio de **Manutenção** (`.gcard-perigo`, borda vermelha, no fim da página —
longe de cliques acidentais). Abre um modal de confirmação que diz, com todas as letras, que a ação é
**IRREVERSÍVEL** e que **telefones cadastrados e histórico de envios também serão apagados**, e que a
**Gestão é preservada**. Só `confirmarLimparInformacoes()` executa.

`limparInformacoes()` limpa os 6 stores de reserva, zera o estado em memória
(`todasReservas`, `todosHospedados`, `reservasManuais`, `contatosMap`, `ajustesMap`, `enviosPorNro`,
congelamento, alocação, destaque, busca e a info de upload dos dois slots) e re-renderiza. Cada passo em
`try/catch`: **o app nunca quebra**, e funciona também no modo sem IndexedDB.

⚠ Isto **não é migração**: é ação deliberada do usuário. A regra de migração não-destrutiva
(`onupgradeneeded` nunca apaga) segue intacta e não foi tocada.

### 2.5 (7.5) Feriados nacionais **calculados**

`pascoa(ano)` (Meeus/Butcher) + `feriadosNacionais(ano)` = **9 fixos** (01/01, 21/04, 01/05, 07/09, 12/10,
02/11, 15/11, 20/11, 25/12) + **4 móveis** derivados da Páscoa (Carnaval −48/−47, Sexta-feira Santa −2,
Corpus Christi +60). `ehFeriado(data)` devolve o nome ou `null`, recalculando por ano sob demanda com cache
em memória. **Não há cadastro, não há tela, funciona offline e nunca envelhece.** Municipais de Balneário
Camboriú ficam **fora** desta versão (parqueado).

Conferido: Páscoa **2026 = 05/04** e **2027 = 28/03**; Sexta-feira Santa 03/04/2026 e 26/03/2027;
Corpus Christi 04/06/2026 e 27/05/2027; Carnaval 16–17/02/2026.

### 2.6 (7.6) Realce de fim de semana e feriado

`realceDoDia(data)` → `'feriado'` | `'fds'` | `''` — **feriado PREVALECE** sobre fim de semana. `mkRow` e
`mkDatesRow` aplicam a classe **pela DATA da coluna** (não pela posição), e o feriado leva o nome no `title`.

**Como se garantiu que não confunde com os status** — o realce é **fundo de coluna, subordinado aos blocos**:

| | fim de semana | feriado | bloco de status |
|---|---|---|---|
| alpha (tema escuro) | **.06** | **.07** | **.18** (3× mais forte) |
| alpha (tema claro) | **.07** | **.07** | **.12** |
| borda | nenhuma | nenhuma | **1.5px sólida da matiz** |
| onde vive | `.cell` (atrás) | `.cell` (atrás) | `.cell-span` (`z-index:5`, na frente) |

O tom é **composto sobre `--cell-livre`** (`linear-gradient` de uma cor só sobre o fundo da célula), para o
realce valer também **atrás das células ocupadas**. O amarelo do "Aguardando" (alpha .18 + borda sólida)
fica 3× mais saturado que a faixa de fim de semana, e o verde do hospedado (teal `--hosped`) é uma matiz
distinta do verde do feriado, além de muito mais forte. **Nenhuma cor de bloco foi alterada** — o tom do
amarelo continua exatamente o da v1.5.6.1.

---

## 3. Testes — **449/449 verdes, sem `skip` mascarando**

| Suíte | v1.5.6.1 | v1.5.7 | Novos |
|---|---|---|---|
| `npm run test:engine` | 264 | **293** | +29 |
| `npm run test:integration` (jsdom) | 100* | **100** | +9 |
| `npx playwright test` | 51 | **56** | +5 |
| **Total** | 415 | **449** | **+43** |

<sub>* a contagem jsdom da v1.5.6.1 era 91; os 9 novos entram sobre ela.</sub>

**Engine (29):** os 4 regexes/distribuidores do item A isolados; **#26389 → 4 carros (3P+1G), apto 390 sem
carro**; **#26161 → 3 carros com os ids preservados**; 5 aptos/total 02 → 2; reserva simples → 1; multi-apto
sem declaração mantém `garagemOrig` por bloco; **multi-apto não vira duplicata**; `chaveCarro`/`resolverAjuste`
(inclusive o **fallback legado** e a não-contaminação entre carros); **fixar 1 carro não arrasta os outros**;
`congelarLayout` por carro; `mapaChaveNro`; agrupamento de volta por reserva; **"X de N" recomputando
(5 → 2 baixas → 1/2/3 de 3)** e ordem estável; Páscoa 2026/2027, fixos, móveis, recálculo por ano, dia comum,
data inválida, **só nacionais (13)**; `realceDoDia` e a **precedência feriado > fim de semana** (15/11/2026 cai
num domingo).

**jsdom (9):** multi-apto TOTAL 04 → 4 blocos no mapa **e 4 registros no banco**; sem selo de duplicata;
**mover um carro → 1 registro de ajuste gravado como `26389__354__1`, 1 único ✋ e os outros 3 carros parados**;
ajuste legado por nº ainda posiciona; "X de N" recomputa; **realce coluna a coluna batendo com `realceDoDia`
para cada data, no cabeçalho e nas células**; realce não entra no bloco; Limpar sem confirmar não apaga nada;
**Limpar zera os 6 stores, preserva a Gestão byte a byte, zera o mapa e importar depois volta a funcionar**.

**Playwright (5, navegador real):** multi-apto TOTAL 04 → 4 blocos, "Carro 04" presente e "Carro 05"
ausente, 4 aptos, sem selo de duplicata; **arraste real (pointer events) de um carro → só ele muda de vaga,
snapshot por `data-chave` antes×depois**; baixa recomputa a numeração; **botão Limpar com o texto de aviso
conferido, Cancelar não apaga, Confirmar zera tudo e mantém a Gestão**; janela de setembro com o realce
conferido dia a dia (07/09 = feriado com `title` "Independência") e o **bloco amarelo por cima mantendo
alpha .18 e borda sólida**.

### Validação com o PDF real (`amostras/`, emissão 10/jul)

1. Hooks `[real]`: **2/2 verdes** — Comandas → **21 hospedados**; Reservas sem regressão, 0 duplicata falsa.
2. **Comparação direta parser antigo × novo sobre o mesmo PDF real**, rodada à parte:
   **101 carros no antigo, 101 no novo, conjuntos idênticos** (`nro|apto|vagaIdx|garagem`), zero registro
   só de um lado. **Regressão zero comprovada em dado real.**
3. Diagnóstico das reservas multi-carro do relatório real: `#26389` aparece com **5 aptos e 5 carros** —
   naquele relatório a obs é `"DPL STD"`, **sem** o texto de total. O relatório que reproduz o bug é mais
   novo; o comportamento nele está coberto pelo fixture que reproduz a obs exata.

---

## 4. Deploy

1. Suíte inteira verde (449/449, sem `skip`) + fluxos exercitados de ponta a ponta.
2. Validação com os PDFs reais de `amostras/` (acima).
3. `node build-standalone.js` → **standalone regenerado** (1,93 MB) com `APP_VERSION='v1.5.7'`.
4. Commit `v1.5.7: total de carros correto (fim da explosao) + arraste por carro + numeracao X de N + botao limpar + realce fds/feriado calculado`.
5. Tags `pre-v1.5.7` e `v1.5.7` no remote.
6. **Cópia única no Desktop:** `reserva-garagem-index-v1.5.7.html` (anteriores removidas).

---

## 5. Declaração

Repo certo (`controle-garagem-hotel-gumz`), **nenhum repositório do Garage Spot tocado**; tags `pre-v1.5.7`
e `v1.5.7` no remote; `APP_VERSION` = `v1.5.7`; auditoria da Fase 1 reportada **com a causa raiz da explosão
de carros** (aplicação do total por bloco em vez de por reserva — geração, não parsing); carros = total da
reserva (**04, não 20**), sem multiplicar por apartamento, **multi-apto continua legítimo** e não vira
duplicata; **arraste move só o carro tocado**, com a regra da v1.5.5 preservada e valendo para overbooking,
vaga extra e motos; **"Carro X de N" recomputa na baixa** com ordem estável; **botão Limpar** zera
reservas/hospedados/ajustes/manuais/contatos/envios **preservando a Gestão**, atrás de confirmação explícita
que avisa sobre telefones e envios; **feriados nacionais calculados pelo app** (fixos + móveis via Páscoa),
sem cadastro, recalculando por ano; **realce de fim de semana (quente suave) e feriado (verde suave)** como
fundo de coluna que **não altera nem confunde** os blocos (feriado prevalece sobre fim de semana);
**amarelo "Aguardando" não foi mexido**; nada da v1.5.6.1 quebrado; **sem mudança de schema (DB v6), store,
nome, caminho ou selo**; suíte **449/449 verde sem `skip` mascarando** e fluxos exercitados antes da entrega;
validação com PDF real de 10/jul feita, inclusive comparação parser antigo × novo; Desktop só com a v1.5.7;
docs atualizadas.
