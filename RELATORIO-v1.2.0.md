# RELATÓRIO — v1.2.0 (Reserva de Garagem do Hotel Gumz)

**Data:** 05/06/2026 · **Base:** `v1.1.0` · **Arquivo canônico:** `garagem-app/index.html` ·
**Standalone (Chrome):** `garagem-app/controle-garagem-standalone.html` · **Sem APK, sem backend.**

Maior entrega do plano: nova aba **Gestão** (Empresa, Funcionários, Modelos de Mensagens e
Backup/Restauração) + sistema de **Modelos com chaves substituíveis** e **fluxo de envio** com
preview/troca/edição no Contato. Mapa e lógica de alocação **inalterados**.

---

## 1. Objetivo

Dar à empresa controle sobre as mensagens enviadas aos hóspedes (modelos por status, com chaves
reais), configuração de empresa/funcionários e um mecanismo de **backup** dos dados.

---

## 2. O que foi implementado (5.1 – 5.7)

### 5.1 — Aba Gestão + store `gestao`
- 3ª aba **Gestão** (ícone engrenagem) com seções **Empresa**, **Funcionários**, **Modelos de
  Mensagens** e **Backup / Restauração**.
- IndexedDB **v1→v2**: `onupgradeneeded` cria o store **`gestao`** (singleton `id:"config"`)
  **apenas se não existir**, sem tocar em `reservas`/`contatos`.
- A config é **semeada** na primeira carga (`carregarGestao` grava `gestaoDefault()` só se não
  houver registro) — **nunca sobrescreve** config existente.

### 5.2 — Empresa
- Campo **nome da empresa** persistido em `gestao.empresa.nome` → alimenta a chave `[empresa]`.

### 5.3 — Funcionários (lista dinâmica + padrão único)
- Adicionar/remover linhas; **um** padrão (radio). Padrão inicial = **1º** cadastrado; alterável a
  qualquer momento; remover o padrão **cai para o 1º**. Funções puras `adicionarFuncionario`,
  `removerFuncionario`, `definirFuncionarioPadrao`, `funcionarioPadrao`. Alimenta `[funcionario]`.

### 5.4 — Modelos de Mensagens (editor + chaves + autocomplete + legenda/ajuda + padrão)
- Duas categorias (**Verificando**, **Overbooking**), **até 3 modelos** cada (slots 1/2/3),
  com **padrão por categoria** (inicial 1, alterável). Textos-exemplo semeados no slot 1.
- **Autocomplete** ao digitar (`[n`→`[nome]`, aceita com **Tab/Enter** ou clique) +
  **chips** clicáveis das 5 chaves (essencial no mobile). Funções puras `autocompleteChaves`,
  `aplicarSugestao`.
- **Legenda clean** das 5 chaves + **botão "?"** com modal explicando cada uma.

### 5.5 — Substituição das chaves (pura) — `substituirChaves(texto, reserva, gestao)`
- `[nome]` → hóspede · `[data]` → entrada **e** saída (`fmtData` existente, `DD/MM/AAAA a DD/MM/AAAA`)
  · `[canal]` → origem da reserva · `[empresa]` → nome da empresa · `[funcionario]` → funcionário
  padrão. Fonte vazia → **string vazia**; **nunca** deixa chave literal; substitui **todas** as
  ocorrências; texto fora das chaves intacto.

### 5.6 — Fluxo de envio no Contato (preview + troca + editar só o envio)
- Categoria pelo status: **amarelo → verificando**, **vermelho → overbooking**; **azul/confirmada
  fica fora** do sistema templado (mostra link simples "WhatsApp", sem quebrar).
- Botão de mensagem abre **modal de conferência** com o texto já **substituído**. Se houver 2–3
  modelos preenchidos, botões **Modelo 1/2/3** para trocar (re-substitui). **Editar** torna o
  preview editável **só para aquele envio** (não altera o modelo salvo). **Enviar** abre o `wa.me`
  com o texto final (`linkWhatsAppTexto`).

### 5.7 — Backup / Restauração
- **Exportar:** dump genérico de **todos os object stores** → `{schema:"reserva-garagem-backup/1",
  appVersion, exportadoEm, stores:{...}}`, baixado como `reserva-garagem-backup-YYYYMMDD-HHMM.json`.
- **Importar:** valida `schema` (incompatível → avisa, não quebra). **Mesclar (padrão,
  não-destrutivo):** adiciona só `contatos` ausentes (não sobrescreve); importa `gestao` só se não
  houver config local relevante; **não** toca em `reservas`. **Substituir (com confirmação):** repõe
  `contatos`/`gestao` (e `reservas` se houver). Funções puras `montarBackup`, `backupValido`,
  `mesclarContatos`, `decidirGestaoImport`. Mensagem de resultado clara.

### 5.8 — `APP_VERSION = 'v1.2.0'` (rodapé).

---

## 3. Decisões técnicas

- **Mapeamento status→categoria:** amarelo=verificando, vermelho=overbooking; **azul fora** do
  sistema de modelos nesta versão (decisão do escopo).
- **`[canal]`** usa a origem crua do PDF (WhatsApp/Booking/Expedia/…); **mapeamento de nome de
  canal fica adiado**.
- **Substituição nunca deixa chave literal** (valor real ou vazio) — garantido por teste.
- **Backup genérico por dump de stores** (futuro-compatível: novos stores entram automaticamente).
- **Migração não-destrutiva**: store `gestao` criado por `onupgradeneeded`; semeadura idempotente
  em `carregarGestao` (só cria o registro `config` se ausente).
- **Substituição do sistema antigo:** os 2 modelos fixos (localStorage `garagem_tpl1/2`) foram
  removidos; agora vivem em Gestão › Modelos (verificando/overbooking).

---

## 4. Resultado dos testes — **140/140 ✓**

`npm install` → `npm test` (engine + integração) e `npx playwright test` (e2e).

- **Unitários (Node, `tests/engine.test.js`): 102/102 ✓** — não-regressão v1.0/1.1 + novas puras
  v1.2: `substituirChaves` (5 chaves, `[data]` entrada+saída, vazio→vazio, múltiplas ocorrências,
  texto intacto), `categoriaReserva`, `modeloPadraoIdx`/`modelosPreenchidos`, funcionários
  (add/remove/padrão único/fallback), `gestaoDefault`/`gestaoNormalizar`, `autocompleteChaves`/
  `aplicarSugestao`, backup (`montarBackup`/`backupValido`/`mesclarContatos`/`decidirGestaoImport`).
- **Integração (jsdom + fake-indexeddb, `tests/integration.test.js`): 27/27 ✓** — aba Gestão e
  seções; migração cria `gestao` e semeia sem tocar reservas/contatos; **persistência** de empresa
  e funcionário ao reabrir; **envio** (preview substituído sem chave literal, troca de modelo,
  Editar não altera o modelo salvo, azul fora do fluxo); **chip** insere chave; **backup** Mesclar
  (não sobrescreve gestao local relevante; adiciona contatos ausentes), Substituir repõe, inválido
  não quebra.
- **E2E (Playwright + Chromium real, `tests/e2e.spec.js`): 11/11 ✓** — smoke (rodapé v1.2.0 + aba
  Gestão); seções + legenda + "?"; **autocomplete** `[n`→`[nome]` (aceita com Tab) + **chip**;
  **envio** (preview substituído, troca Modelo 2, Editar não altera o modelo salvo); + os testes da
  v1.1.0. Screenshots: `Desktop/v1.2.0-mapa.png`, `-contato.png`, `-gestao.png`.

**Sem `test.skip` mascarando falhas.** Nenhuma impossibilidade headless ocorreu (e2e em Chromium
real via servidor HTTP local).

---

## 5. Deploy

- Commit + push em **`ApolloDSk/controle-garagem-hotel-gumz` (master)**.
- **Tags:** `pre-v1.2.0` (segurança) e `v1.2.0`, enviadas ao remote.
- Standalone regenerado. **Cópia única no Desktop:** apenas `reserva-garagem-index-v1.2.0.html`.

---

## 6. Preservado (não regrediu)

Mapa de Reservas e alocação (incl. v1.1.0: ordenação, check-in no passado), stores
`reservas`/`contatos`, persistência, `wa.me`. O novo fluxo apenas **envolve** o envio com
preview/troca/edição. Fallback em tudo (config falhando → defaults em memória).

---

## 7. Ressalvas / pendências

- **`[canal]`** sem mapeamento de nome amigável (adiado).
- **Múltiplas empresas** (adiado).
- **Modelo para reservas confirmadas/azuis** não incluído (adiado; hoje azul usa link simples).
- Importar **Substituir** depende de confirmação do usuário (em testes, `confirm` é stubado; no
  navegador real, Playwright auto-dismissa diálogos — por isso o e2e cobre só o Mesclar).
- Ressalvas herdadas da v1.0/1.1 permanecem.
