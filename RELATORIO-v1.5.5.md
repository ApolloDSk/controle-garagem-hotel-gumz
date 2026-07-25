# RELATÓRIO — v1.5.5

**Reserva de Garagem do Hotel Gumz** — patch único com quatro temas:
amarelo = cor da bolinha · **arraste move só a reserva arrastada** · seletor de status inteiro no
detalhe · **Contato como fila de trabalho (Aguardando)**. Sem mudança de schema (DB segue **v6**),
sem backend, sem dependência nova, sem arquivo novo. Migração não-destrutiva.

---

## Fase 0 — Backup

- `master` limpo, sincronizado com `origin`.
- Tag **`pre-v1.5.5`** criada e enviada ao remote (antes de qualquer edição).

---

## Fase 1 — Auditoria (o que o código fazia)

1. **Cor do amarelo.** A bolinha/legenda "Aguardando" usa a cor **sólida** `--amarelo`
   (`#eab308` escuro / `#ca8a04` claro). O bloco do mapa usava `--amarelo-bg` = a **mesma cor com
   alpha baixo** (`rgba(234,179,8,.30)`), aplicado em `.cell-span.amarelo`. **Não havia derivação de
   hue** — o "mostarda" vinha do **preenchimento translúcido a 30%** sobre o fundo escuro, que apaga
   a cor e a afasta da bolinha sólida e viva.

2. **Filtro do Contato — a suspeita do Doug se CONFIRMOU.** `reservasContato()` **não filtrava por
   status**; `renderContato()` aplicava `contatoFiltro`, cujo padrão era **`'todos'`** → **Confirmadas
   apareciam**. Além disso o filtro "Verificando" usava `grupoTipo(g)`, que retornava `'over'` **antes**
   de `'amarelo'`: uma reserva **Aguardando em overbooking era filtrada pela FLAG** e sumia de
   "Verificando" (só aparecia em "Overbooking"). Ou seja: filtrava por flag/posição, não por status.

3. **Reatividade.** Já reativa — `onStatusChange`→`salvarStatusManual`→`rerenderMapaEContato()`;
   `reservasContato()` roda `aplicarAjustes` fresco lendo `ajustesMap`.

4. **Telefone.** Store `contatos` (keyPath `nro`), separado das reservas; digitado por
   `confirmarTelefone`. **Já sobrevivia à reimportação** (import de PDF não toca `contatos`).

5. **Envios.** Store `envios` (keyPath `id` autoincrement + índice `nro`), `enviosPorNro`,
   `statusEnvioReserva`, prancheta — intactos.

6. **Modelos.** `categoriaReserva(g)`: over→'overbooking', amarelo→'verificando', senão `null`
   (azul fora do sistema). **Regra preservada.**

7. **Parser de reservas.** **Não lia telefone/e-mail** — nenhum campo de contato extraído ou
   descartado.

8. **Modal do detalhe (seletor cortado).** `.modal-card` tinha `overflow:hidden` **sem `max-height`**;
   `.modal-body` **sem scroll**. Em janela baixa o card crescia além da viewport, o `align-items:center`
   empurrava topo/base para fora e o `overflow:hidden` **cortava** o fim do corpo — onde fica o seletor.

9. **Arraste — CAUSA RAIZ.** `confirmarMover`→`salvarAjuste` gravava só o `vagaIdManual` **da reserva
   arrastada**; `aplicarAjustes` fixava como *seed* **apenas** as reservas com placement manual e
   chamava **`alocarVagas(livres, seed)` sobre TODAS as demais**. `alocarVagas` roda best-fit **do
   zero**: como o seed mudou, as "livres" (sem ajuste manual) eram **reacomodadas em posições
   diferentes** → reservas não tocadas se moviam sozinhas. Não há rotina nomeada de "compactar", mas o
   efeito é **realocação global disparada pelo drop**.

**Achado extra:** `normalizePhone` **injetava `55`** (`'55'+d` no default e p/ 10/11 dígitos) —
exatamente o DDI proibido para hóspedes estrangeiros.

**Decisão do Doug (consultado):** remover os 4 chips do Contato → **fila única de Aguardando**.

---

## Implementação

### 6.1 — Amarelo = a cor da bolinha (fim do mostarda)
- `.cell-span.amarelo` passou a usar **`background:var(--amarelo)` sólido** (a própria cor da bolinha,
  **fonte única**), removendo o fill translúcido `--amarelo-bg`.
- Texto do bloco escurecido com nova variável **`--sobre-amarelo` (#1a1205)** (nome + info), mesma
  matiz, só para contraste. Azul/vermelho/roxo/verde intactos; **nenhum laranja reintroduzido**.

### 6.2 — Arraste move só a reserva arrastada (o mais importante)
- **Congelamento de layout:** `congelarLayout(aloc)` (puro) "fotografa" o arranjo atual em
  `nro→vagaId`. `aplicarAjustes(reservas, ajustes, layoutSeed)` ganhou um **3º parâmetro opcional**: o
  layout congelado atua como **soft-pin invisível** que segura CADA reserva no lugar. O ajuste
  **manual** (store `ajustes`) tem prioridade e é o **único** que marca `ajusteManual`/✋; o
  congelamento é transparente (não polui a área "Editadas manualmente", não gera divergência).
- `renderMapa` recalcula uma **assinatura** (`janela + conjunto de nros`). Enquanto ela não muda
  (arraste, mudança de status, checkbox), usa o layout congelado → **nada reflowa**. **Import e
  mudança de filtro trocam a assinatura** → `layoutSeed=null` → **a alocação automática roda fresca**
  (comportamento da importação **intacto**).
- **Destino livre:** só a arrastada recebe placement manual; todas as outras permanecem **byte a
  byte** na mesma vaga.
- **Destino ocupado (conflito real):** `confirmarMover` remove **apenas a(s) reserva(s) diretamente
  conflitante(s)** do congelamento (via `nrosConflitantes`, período sobreposto), que então reacomodam
  no espaço livre. O resto do mapa fica intacto. **Nenhuma realocação global.**
- **"Voltar ao automático"** (`removerAjuste`) tira **só a própria** do congelamento → re-aloca
  apenas ela.
- Vale para carros, motos (pareamento), overbooking e vagas extras; limiar anti-acidente e pan
  preservados.

### 6.3 — Modal do detalhe rola sem cortar
- `.modal-card` virou **flex-column com `max-height:92vh`**; `.modal-head` fixo (`flex-shrink:0`);
  `.modal-body` com **`overflow-y:auto`**. O seletor de status aparece inteiro e utilizável mesmo em
  **janela baixa e viewport mobile** (rola por dentro, sem cortar). Comportamento do seletor
  inalterado — só a apresentação.

### 6.4 / 6.8–6.10 — Contato como fila de trabalho
- **Fila exclusivamente "Aguardando"** (`filaAguardando()` filtra por `_statusEfetivo==='aguardando'`),
  **por STATUS, nunca por flag**: overbooking e vaga extra **não excluem** ninguém e aparecem só como
  **marca visual** (`.ct-flag`). Chips removidos (decisão do Doug).
- **Reativa:** mudou para Confirmado/Sem garagem → sai; voltou a Aguardando → entra.
- **Ordenada por chegada** mais próxima, com **desempate estável** por nº.
- **Já contatado:** badge "✓ contatado · data/hora" derivado de `envios` (sem store novo); **reenvio
  não é bloqueado**.
- **Botão "Abrir WhatsApp"** por linha, **desabilitado com dica** enquanto não houver telefone.
- Copiar nº, campo de telefone, mensagem montada pela **Gestão**, preview/troca/edição de modelo e a
  janelinha de **registro de envios** — **mantidos**.

### 6.5 / 6.6 — Telefone: capturar do documento, persistir, prioridade do usuário
- `telefoneDoDocumento(texto)` (puro) captura **por presença**: rótulo com separador
  (`Tel:`/`Fone:`/`Cel:`/`Celular:`/`WhatsApp:`/`Contato:`) **ou** número internacional explícito
  (`+DDI`). Exige `:`/`-` ou `+` de propósito, para **nunca** confundir com nº de reserva, apto,
  valores nem o canal "TELEFONE". **Ausência = `''` (caminho normal do Desbravador): silencioso, sem
  erro, sem aviso.** Wired no `parsear` (`telefoneDoc` por reserva).
- `semearTelefonesDoDocumento` grava no `contatos` **sem sobrescrever o telefone CONFIRMADO pelo
  usuário** (status `'resolvido'` é sagrado). Persiste (sobrevive à reimportação) e continua
  **editável** (status `'documento'`).
- **E-mail: NÃO implementado** — parqueado no `PLANEJAMENTO.md`.

### 6.7 — Normalização do telefone SEM assumir país
- `normalizePhone` agora **só limpa formatação** (`replace(/\D/g,'')`) — **nunca injeta `+55`** nem
  qualquer DDI. O número vem completo (do usuário/documento) e é usado como veio.
- `telefoneCurto(tel)` (puro) sinaliza número com **< 10 dígitos** → **aviso leve** na linha
  ("confira se o número inclui o código do país"). **Avisa, nunca bloqueia, nunca corrige.**
- Exibição preserva o número como digitado; a limpeza é só para o link `wa.me`.

### 6.11 — `APP_VERSION` = `v1.5.5`.

---

## Preservação (não regrediu)
Alocação automática **na importação** (a correção do arraste não a desligou), overbooking que nunca
derruba confirmado, Carro 01/02 no bloco, destaque persistente, vaga extra pelo status, checkbox
"editadas manualmente", arraste/pan/busca, hospedados, parser do comandas, vagas extras, +Reserva
manual, log de edições, status manual + auditoria, ajustes persistindo na reimportação, histórico de
envios, modelos da Gestão (regra de categoria), selo de gravação. Nomes/caminhos/stores inalterados.

---

## Testes — TODOS verdes (sem `skip` mascarando)

- **ENGINE (Node):** 245/245 ✓ (+7: congelamento de layout, `normalizePhone` sem DDI, `telefoneCurto`,
  `telefoneDoDocumento`).
- **INTEGRAÇÃO (jsdom + fake-indexeddb):** 83/83 ✓ (+10: fila só Aguardando + flags não excluem,
  reatividade, ordenação, já contatado, telefone do documento + prioridade + sem-erro, botão WA
  habilita/desabilita, **arraste vaga livre → outras idênticas** via DOM, voltar ao automático).
- **PLAYWRIGHT (Chromium):** e2e verde, incluindo os **fluxos de ponta a ponta**: arraste para vaga
  livre (snapshot antes×depois prova que só a arrastada mudou), soltar em cima (só a conflitante
  reacomoda), seletor de status inteiro em viewport mobile, e o fluxo do Contato (só Aguardando →
  colar telefone → mensagem da Gestão → `wa.me` **sem 55** → registrado → contatado).
- Os 2 hooks `[real]` de `amostras/` (Comandas → 21 hospedados; Reservas sem regressão) continuam
  rodando e verdes.

**Total: 372/372 verde** (245 engine + 83 integração + 44 Playwright), sem `skip` mascarando.

---

## Validação com PDF real (`amostras/`, emissão 10/jul)
Parser de reservas e comandas sem regressão; nenhum telefone falsamente capturado (o Desbravador não
traz telefone → captura silenciosa). Hooks `[real]` verdes.

---

## Parqueado
- **Captura de e-mail** (nenhuma função do app consome e-mail; envio é WhatsApp).
- Adiados de sempre: outros PMSs, múltiplas empresas, `[canal]`, modelo para confirmadas, envio em
  massa (exige backend + WhatsApp Business API).
</content>
</invoke>
