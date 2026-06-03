# RELATÓRIO — v1.0.0 (Reserva de Garagem do Hotel Gumz)

**Data:** 02/06/2026 · **Base:** versão estável anterior (`index.html`, "v21") · **Arquivo
canônico:** `garagem-app/index.html` · **Standalone (Chrome):**
`garagem-app/controle-garagem-standalone.html` · **Sem APK, sem backend.**

Esta é a **primeira versão formalmente numerada**. Fundação do produto em 3 frentes: lógica de
vagas correta, persistência com mesclagem não-destrutiva e ferramenta de contato base.

---

## 1. O que mudou — por Bloco/Parte

### BLOCO A — Lógica de vagas correta
- **A1 — Bug central corrigido.** Antes, `rPeq` incluía `'amarelo'`, prendendo todos os
  a-verificar nas vagas pequenas. Agora os amarelos são alocados de forma inteligente entre
  **pequeno E grande**. Removida a montagem antiga de `rPeq`/`rGra`; criada a função
  `alocarVagas(rP)` que distribui tudo.
- **A2 — Encaixe inteligente.** A alocação deixou de ser bottom-up simples. Agora usa
  **best-fit** (`melhorLinha` + `custoEncaixe`): cada amarelo é colocado na linha onde o
  "buraco" adjacente é menor, preenchendo intervalos livres entre reservas longas; linhas
  vazias são penalizadas (usadas por último) para concentrar a ocupação.
- **A3 — Score de prioridade.** `scorePrioridade(res)` decide quem fica e quem vai ao
  overbooking. **Fórmula adotada:**
  ```
  score = nDiarias × 10
        + bônusCanal           (Direta/WhatsApp/Telefone/Site = 50 · Expedia = 30 · Omnibees = 20 · Booking = 0)
        + (confirmado ? 10000 : 0)
        − nroReserva × 0.00001   (desempate: reserva mais recente = nro maior = leve desvantagem)
  ```
  Período é o peso principal; canal pesa em seguida (Booking por último); confirmado sempre
  acima de qualquer amarelo (via +10000).
- **A4 — Grande em vaga pequena sinalizado.** Quando um **grande confirmado** não cabe na seção
  grande e ocupa uma vaga pequena, recebe `_grandeEmPequena` → borda **tracejada laranja** + ⚠
  no nome + linha no tooltip "Carro grande em vaga pequena". Há legenda para isso.
- **A5 — Overbooking protege confirmados.** `alocarVagas` coloca **primeiro todos os
  confirmados** (azul/laranja/motos) nas suas seções (com spill sinalizado para grandes), e só
  então os **amarelos por prioridade decrescente**. Os amarelos de menor prioridade que não
  encontram vaga vão para a seção **Overbooking — sem vaga garantida** (vermelho + tooltip de
  "priorizar contato"). **Confirmado nunca é empurrado para o overbooking** por um amarelo.

### BLOCO B — Persistência (IndexedDB) + mesclagem
- **B1 — Banco local.** IndexedDB `garagemGumz` (v1), dois stores:
  - **`reservas`** — keyPath **`id`** (`id = nro__apto__vagaIdx`, único). Guarda todos os campos
    do PDF (nro, **nroOTA**, nomeCompleto, hospedeDetalhe, entrada, saída, apto, garagem, origem,
    obs, flags de múltiplo/moto) + `ativo` + `ultimoPDF`. Escrito **só** pela importação de PDF.
  - **`contatos`** — keyPath **`nro`**. Guarda `{telefone, telefoneStatus, atualizadoEm}`.
    Escrito **só** pela ferramenta de contato.
  - Essa separação é o que torna a mesclagem **não-destrutiva por construção**: importar PDF
    nunca toca em telefones.
- **B2 — Mesclagem não-destrutiva.** `mesclarRegistros(existentesMap, novas)`:
  - **Existente** (mesmo `id`): atualiza os campos do PDF, mantém `ativo:true`.
  - **Nova**: insere com `ativo:true`.
  - **Sumida do PDF**: marca `ativo:false` (**arquivada**, não exibida no mapa por padrão) —
    **não apaga**, preserva histórico.
  - O telefone vive no store `contatos` (chave `nro`) e **nunca** é tocado na reimportação.
- **B3 — Consulta de qualquer período.** Ao abrir, o app carrega do banco todas as reservas
  ativas para a memória; os filtros de data (Hoje/Semana/Mês/Ano/custom) consultam essa base —
  qualquer período já importado é visível sem reimportar o PDF.

### BLOCO C — Ferramenta de contato (base)
- **C1** — Nova **aba "Contato"** (alternável com "Mapa" na barra de abas); o mapa segue como
  tela principal.
- **C2** — Filtros **Todos / Confirmados / Verificando / Overbooking**, reaproveitando o
  seletor de período. Em **Confirmados**, separação por subtítulo **carro pequeno / carro
  grande / moto**.
- **C3** — Lista enxuta, agrupada por **nº PMS** (`nro`): exibe **nº PMS + nº OTA (localizador
  Booking/Expedia) + nome + entrada + saída + aptos + origem**. O nº OTA é extraído do PDF
  (`extrairNroOTA`, formato `\d{4,}ID\d{3,}`, ex.: `413101ID20542561`).
- **C4** — Campo para **colar telefone**; clicar destaca o item (`active`); ao **Confirmar**, o
  item ganha status **"resolvido"** (✓ verde + fundo diferente). Telefone **editável** depois e
  **persistido** no store `contatos`.
- **C5** — **Envio individual `wa.me`.** Botões de WhatsApp quando há telefone, com **2 modelos**
  (1 — verificar interesse; 2 — sem disponibilidade), **editáveis** (textareas, salvos em
  localStorage). `gerarMensagem(dados, template)` substitui `{nome}`/`{entrada}`/`{saida}`/
  `{apto}`; `normalizePhone` formata para `55`+DDD+número; `linkWhatsApp` monta o `wa.me`. A
  geração de mensagem é uma **função reutilizável** — pronta para o envio em massa futuro.

### BLOCO D — Documentação e versão
- `APP_VERSION = 'v1.0.0'` exibida no **rodapé**.
- Criados `CLAUDE.md`, `PLANEJAMENTO.md` (roadmap em 3 níveis) e este relatório.

---

## 2. Estrutura do IndexedDB (resumo)

| Store      | Chave (keyPath) | Escrito por        | Campos                                                                 |
|------------|-----------------|--------------------|-----------------------------------------------------------------------|
| `reservas` | `id`            | Importação de PDF  | nro, nroOTA, nomeCompleto, hospedeDetalhe, entrada, saida, apto, garagem, origem, obs, ehMultiplo, vagaIdx, **ativo**, ultimoPDF |
| `contatos` | `nro`           | Ferramenta contato | telefone, telefoneStatus (`pendente`/`resolvido`), atualizadoEm        |

`id = nro__apto__vagaIdx` (um `nro` do PMS pode ter vários aptos/carros; o telefone é por `nro`).

---

## 3. Como o fallback funciona

`abrirDB()` resolve `false` se o IndexedDB não existir ou falhar (modo privado, navegador
antigo, `onerror`/`onblocked`). Nesse caso `dbOk=false`, o chip no topo mostra **"memória"**, e
a importação de PDF popula `todasReservas` **em memória**. Os telefones colados ficam em
`contatosMap` (memória) e são preservados **durante a sessão** mesmo reimportando o PDF — só não
sobrevivem ao fechar o app. O app **nunca trava**.

---

## 4. Resultado do roteiro de validação

Testes automatizados (Node), extraindo o **mesmo código** que é embarcado (bloco ENGINE do
`index.html`) e rodando contra o PDF real `LISTAGEM RESERVA.pdf` (191 reservas com garagem, 41
páginas):

- **Harness de lógica (engine):** **38/38 ✓** — parsing/não-regressão (nomes HENRIDES/RONAN/
  ELISANGELA/BETINA; apto 175/191; #26161 Henrides = 3 vagas), localizador OTA, ids únicos,
  classificação, prioridade (período + Booking por último + confirmado>amarelo), **A1** amarelos
  ocupam GRANDE, **A2** encaixe, **A4** grande em vaga pequena sinalizado, **A5** overbooking
  empurra amarelo e nunca confirmado, **B2** mesclagem (existente/nova/arquivada), **C5**
  mensagens/`wa.me`/normalização de telefone.
- **Integração (jsdom + fake-indexeddb):** **19/19 ✓** — IndexedDB inicializa; importação;
  render do mapa (seções + amarelos); aba Contato lista; colar telefone → status resolvido →
  `wa.me` normalizado; **persistência** (reabrir traz reservas e telefone do banco); **mesclagem**
  (reimportar preserva telefone; reserva sumida vira `ativo:false`); **fallback** (sem IndexedDB
  o app funciona em memória e renderiza).

- **End-to-end no navegador real (Playwright + Chromium, servido por HTTP):** **17/17 ✓** —
  importação do PDF real; **amarelos renderizados na seção GRANDE** (bug corrigido, confirmado
  visualmente); contadores e tooltip; aba Contato lista 95 reservas com **nº PMS + nº OTA**;
  filtro Confirmados com subtítulos; colar telefone → **resolvido** → **`wa.me/5547998765432`**
  com mensagem; **persistência real** (recarregar a página mantém reservas e telefone via
  IndexedDB); **zero erros de console**. Screenshots: `Desktop/v1.0.0-mapa.png` e
  `Desktop/v1.0.0-contato.png`.

**Total: 74/74 testes automatizados passando** (38 engine + 19 jsdom + 17 navegador real).
Versão `v1.0.0` confirmada visível no rodapé.

---

## 5. Deploy

- Commit + push em **`ApolloDSk/controle-garagem-hotel-gumz` (master)**.
- Arquivos: `garagem-app/index.html` (canônico), `garagem-app/controle-garagem-standalone.html`
  (regenerado), `garagem-app/build-standalone.js` (novo builder), `CLAUDE.md`, `PLANEJAMENTO.md`,
  `RELATORIO-v1.0.0.md`.
- Backup: `garagem-app/index.html.bak-pre-v1.0.0` (não versionado/ignorado conforme o caso).
- **Cópia no Desktop:** `C:\Users\RBMarketing\Desktop\reserva-garagem-index-v1.0.0.html`
  (é o standalone — abre direto no Chrome).
- **Tag de segurança:** `pre-v1.0.0` criada e enviada (`git push origin pre-v1.0.0`).

---

## 6. Plano de rollback

Se algo der errado:
```
git checkout pre-v1.0.0 -- garagem-app/index.html
node build-standalone.js   # regenera o standalone a partir do index restaurado
git commit -am "rollback para pre-v1.0.0"
git push
```
Ou restaurar a partir de `garagem-app/index.html.bak-pre-v1.0.0`.

---

## 7. Ressalvas / pendências conhecidas

- **Apto sem extração em ~16/191 blocos** (layout do PDF varia). Não impacta a classificação nem
  a contagem de vagas; o registro ainda aparece. Melhorar a regex de apto numa próxima versão.
- **Telefone só de OTA não vem no PDF** (Booking/Expedia) — por isso o campo manual. O nº OTA é
  exibido para o Douglas localizar o hóspede na plataforma e copiar o telefone.
- **Conferência visual no navegador:** FEITA (Playwright/Chromium, 17/17 ✓ + screenshots no
  Desktop). Recomenda-se ainda ao Douglas um olhar rápido no fluxo real do dia a dia.
- **Edição manual (arrastar)** não entra na v1.0.0 — planejada para **v1.1.0**.
- **Envio em massa** continua fora (premium, exige backend — ver `PLANEJAMENTO.md`).
