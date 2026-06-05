# RELATÓRIO — v1.1.0 (Reserva de Garagem do Hotel Gumz)

**Data:** 05/06/2026 · **Base:** `v1.0.0` (commit `a1caeb5`) · **Arquivo canônico:**
`garagem-app/index.html` · **Standalone (Chrome):** `garagem-app/controle-garagem-standalone.html`
· **Sem APK, sem backend.**

Versão de **UX + uma correção de núcleo no mapa**. Não toca na lógica de alocação da v1.0.0
(amarelos/azuis/score/best-fit/overbooking) — apenas a complementa visualmente e melhora o uso.

---

## 1. Objetivo

Ajustes iniciais de experiência nas duas telas existentes (Mapa e Contato) e a inclusão visual
de hóspedes que já fizeram check-in (continuação de hospedagem), sem regredir nada do núcleo.

---

## 2. O que foi implementado (5.1 – 5.6)

### 5.1 — Rótulos e ícones das abas
- Aba **"Mapa" → "Mapa de Reservas"** com **ícone de calendário** (SVG inline).
- Aba **"Contato"** com **ícone do WhatsApp** (SVG inline, verde `#25d366`).
- Acessibilidade: `title` + `aria-label` em ambas; ícones `aria-hidden`. Sem dependências novas.

### 5.2 — Copiar nº ao clicar (PMS e OTA)
- **Aba Contato:** os badges **PMS #...** e **OTA ...** são clicáveis e copiam o respectivo valor.
- **Mapa:** o **#nº PMS** exibido na célula é clicável para copiar (`stopPropagation` para não
  acionar o arraste horizontal).
- Feedback **"Copiado!"** (toast). Cursor `pointer` + tooltip "Clique para copiar".
- **Função de núcleo testável** `copiarTextoCore(texto, env)`: usa `navigator.clipboard.writeText`
  quando disponível e **cai no fallback** (`<textarea>` temporário + `document.execCommand('copy')`)
  — essencial porque o app também roda como arquivo local `file://`. **Nunca lança.**

### 5.3 — Telefone: Confirmar ↔ Editar (bloqueio)
- Ao **Confirmar**, o campo fica **bloqueado** (`readonly`) e o botão vira **Editar**.
- **Editar** desbloqueia o campo e o botão volta a **Confirmar**.
- O estado é derivado de "já existe telefone resolvido para este `nro`?"
  (`estadoTelefoneInicial`). O valor continua persistido no store `contatos` (chave `nro`),
  **inalterado**.

### 5.4 — Filtro de ordenação do mapa (cima ↔ baixo)
- Botão **"⇅ Vagas: cima→baixo / baixo→cima"** alterna a ordem de exibição das linhas das vagas.
- Função pura `aplicarOrdemLinhas(linhas, ordem)` — **apenas inverte a exibição**, sem mutar a
  entrada e **sem alterar a alocação** (o rótulo P1…P18 acompanha a sua vaga).
- Preferência **persistida** em `localStorage` (`garagem_ordem_vagas`) e relida ao reabrir.

### 5.5 — Informativo de data/hora do upload
- Ao lado do botão de upload, exibe **🕑 data e hora do último PDF**.
- Ao **clicar**, mostra o **nome do arquivo** (e o caminho — ver limitação abaixo).
- Persistido em `localStorage` (`garagem_upload_info` = `{nomeArquivo, dataHoraUpload, caminho}`)
  e reexibido ao reabrir. Funções puras `montarUploadInfo(file, agoraMs)` e `fmtDataHora(ms)`.

### 5.6 — Reservas com check-in no passado ainda hospedadas (correção de núcleo)
- Hóspedes cuja **entrada é anterior à janela** mas que **continuam hospedados** (saída > início)
  aparecem normalmente — o filtro `ativasNoPeriodo()` (`entrada<=fim && saida>início`) já os
  incluía; faltava o **tratamento visual**.
- **Renderização "cortada":** quando a entrada real < início da janela, a célula começa no início
  visível e perde a **borda esquerda** (fade suave via `mask-image`), indicando **continuação**
  (`_ ]`). Reservas que entram dentro da janela seguem com retângulo fechado (`[ _ ]`).
- **Função pura testável** `recorteEsquerdo(reserva, janelaInicio)` → `true` se
  `entrada < janelaInicio`, `false` caso contrário (e quando faltam dados, sem quebrar).
- Reserva **encerrada** (saída ≤ início) não aparece; reserva **futura** renderiza normal.

### 5.7 — `APP_VERSION = 'v1.1.0'` (rodapé).

---

## 3. Decisões técnicas

- **Cópia com fallback para `file://`:** `navigator.clipboard` pode não existir/recusar em
  `file://`; o fallback `execCommand('copy')` garante o funcionamento. Erros são silenciados
  (toast informa sucesso/falha), nunca quebram.
- **⚠ Limitação de caminho do navegador (não contornável):** por segurança, o navegador **não
  expõe o caminho real** do arquivo (devolve `C:\fakepath\...`). Portanto exibimos **nome +
  data/hora** (confiáveis) e, quanto ao caminho, **só** mostramos um valor **se o ambiente
  fornecer um caminho real** (ex.: Electron, via `file.path`); caso contrário, a nota curta
  *"caminho indisponível pelo navegador"*. **Nenhum caminho é inventado.**
- **Recorte de borda esquerda** para check-in no passado feito por classe CSS `cortado-esq`
  (remove a borda + fade), mantendo a alocação intacta.
- **Ordenação só de exibição:** a inversão acontece no render (`aplicarOrdemLinhas`), nunca em
  `alocarVagas` — garantido por teste.

### Pré-requisito de dado (operacional)
A exibição de quem **já fez check-in** só ocorre **se a reserva constar no PDF**. Se o relatório
do Desbravador não trouxer hóspedes já hospedados, é preciso **exportá-lo começando alguns dias
antes de hoje**. Decisão operacional do Douglas; o app renderiza corretamente quando o dado existe.

---

## 4. Resultado dos testes — **98/98 ✓**

Recriado e versionado um **harness de testes** (na v1.0.0 ele era efêmero, não commitado).
Rodar: `npm install` → `npm test` (unitários + integração) e `npx playwright test` (e2e).

- **Unitários (Node puro, `tests/engine.test.js`): 74/74 ✓** — extrai o **mesmo** bloco ENGINE do
  `index.html`. Cobre não-regressão da v1.0.0 (datas, nomes/OTA, classificação, prioridade,
  sobreposição/encaixe, alocação A1/A5, parser, mensagens/`wa.me`/telefone, mesclagem B2) **e** as
  novas funções puras: `copiarTextoCore` (clipboard/fallback/erro), `estadoTelefoneInicial`,
  `aplicarOrdemLinhas` (inverte sem mutar e não altera alocação), `montarUploadInfo`/`fmtDataHora`
  (fakepath não vira caminho; ausência não quebra), `recorteEsquerdo` (todos os casos).
- **Integração (jsdom + fake-indexeddb, `tests/integration.test.js`): 16/16 ✓** — boot + IndexedDB,
  rodapé v1.1.0, abas com ícones, import + render, **cortado-esq** no check-in passado, badges
  PMS/OTA copiáveis + toast, **telefone Confirmar↔Editar** (bloqueia/desbloqueia, valor inalterado),
  **ordenação** inverte a exibição + persiste/relê, **info de upload** persiste/relê + nota de
  caminho, **persistência** ao reabrir (reservas + telefone), **reimportação** preserva telefone.
- **E2E (Playwright + Chromium real, `tests/e2e.spec.js`): 8/8 ✓** — smoke (rodapé + abas/ícones),
  render do mapa, **cortado-esq**, clique no **PMS** e no **OTA** com toast "Copiado!", **ordenação**
  inverte a ordem visível, **telefone Confirmar↔Editar**, screenshots
  (`Desktop/v1.1.0-mapa.png`, `Desktop/v1.1.0-contato.png`).

**Sem `test.skip` mascarando falhas.** Nenhuma impossibilidade headless precisou ser contornada
(o e2e rodou em Chromium real via servidor HTTP local `tests/serve.js`).

---

## 5. Deploy

- Commit + push em **`ApolloDSk/controle-garagem-hotel-gumz` (master)**.
- Arquivos: `garagem-app/index.html` (canônico), `garagem-app/controle-garagem-standalone.html`
  (regenerado), `tests/*` + `package.json` + `playwright.config.js` (harness versionado),
  `.gitignore`, `CLAUDE.md`, `PLANEJAMENTO.md`, `RELATORIO-v1.1.0.md`, `HANDOFF.md`.
- **Tags:** `pre-v1.1.0` (segurança) e `v1.1.0`, enviadas ao remote.
- **Cópia única no Desktop:** removidas as cópias anteriores; mantida apenas
  `C:\Users\RBMarketing\Desktop\reserva-garagem-index-v1.1.0.html` (é o standalone).

---

## 6. Preservado (não regrediu)

Lógica de alocação automática da v1.0.0 **inalterada**; stores `reservas`/`contatos` intactos;
persistência mantida (reabrir não perde dados); aba Contato, `wa.me` e os **2 modelos** atuais
inalterados (serão redesenhados na v1.2.0 — Gestão); fallback em tudo.

---

## 7. Ressalvas / pendências conhecidas

- **Caminho do arquivo** indisponível no navegador (limitação documentada acima).
- Hóspedes já hospedados dependem do **PDF conter** essas reservas (pré-requisito operacional).
- Demais ressalvas herdadas da v1.0.0 (apto sem extração em ~16/191 blocos; telefone de OTA não
  vem no PDF) permanecem.
