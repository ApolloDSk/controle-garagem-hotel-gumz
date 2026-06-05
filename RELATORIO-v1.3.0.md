# RELATÓRIO — v1.3.0 (Reserva de Garagem do Hotel Gumz)

**Data:** 05/06/2026 · **Base:** `v1.2.0` · **Arquivo canônico:** `garagem-app/index.html` ·
**Standalone (Chrome):** `garagem-app/controle-garagem-standalone.html` · **Sem APK, sem backend.**

Edição manual no **Mapa de Reservas** por **arraste — somente para trocar de VAGA**. A data
**nunca** muda pelo app (é verdade do PMS, chega só pelo PDF). Alocação automática **inalterada**.

---

## 1. Objetivo

Permitir ao operador reposicionar uma reserva de carro em outra vaga, com segurança
(limiar anti-acidente, confirmação obrigatória, aviso de conflito não-destrutivo), marcador
visual e opção de voltar ao automático. Persistência não-destrutiva por `nro`.

---

## 2. O que foi implementado (5.1 – 5.5)

### 5.1 — Store `ajustes` (IndexedDB v2→v3, não-destrutivo)
- `onupgradeneeded` cria **`ajustes`** (`keyPath:"nro"`) **só se não existir**, sem tocar em
  `reservas`/`contatos`/`gestao`. Registro **sem nenhum campo de data**:
  `{ nro, vagaIdManual, criadoEm, atualizadoEm }`. **Só a edição manual escreve**; a reimportação
  do PDF nunca lê/apaga — o ajuste sobrevive à reimportação (mesma garantia dos `contatos`).

### 5.2 — `aplicarAjustes(reservas, ajustes)` (pura)
- Fixa as reservas de **carro** com ajuste válido na `vagaIdManual` **mantendo as datas originais**;
  roda a alocação automática **v1.0.0 inalterada** para as livres no **espaço restante** (via um
  parâmetro opcional `seed` adicionado a `alocarVagas`, retrocompatível — sem `seed` o
  comportamento é idêntico ao da v1.0.0). Sem duplicar vaga (1 ajuste por `nro`, 1º bloco de carro).
  Marca `ajusteManual:true`. **Fallback total ao automático** em erro (app nunca quebra). Ajuste de
  `nro` inexistente é ignorado na renderização, mas **não** é apagado.

### 5.3 — `detectarConflito(reservaOrig, vagaAlvo, ocupantes)` (pura)
- Com as **datas originais**, verifica sobreposição de período com os ocupantes atuais da vaga
  alvo (exceto a própria). Retorna `{conflito, comQuem}`. **Não desloca nada** (não-destrutivo);
  só alimenta o aviso e o marcador.

### 5.4 — Arraste (Pointer Events) só de vaga, com ghost + limiar + confirmação
- Apenas reservas de **carro (P/G)**; `touch-action:none`. Início real só após mover **>5px**
  (**limiar anti-arraste-acidental**); abaixo disso é **clique → abre o detalhe**.
- **Ghost** semitransparente seguindo o cursor **só na vertical** (X travado — a coluna/data é
  ignorada no drop); original esmaecido; **linha (vaga) alvo destacada**.
- **Vaga alvo resolvida pelo identificador da linha** (`data-vaga`), não por índice → funciona com
  a **ordenação em qualquer direção** (cima↔baixo).
- Soltar na mesma vaga (ou fora de vaga) cancela em silêncio. Senão, **modal de confirmação
  obrigatória**: "Mover {hospede} da vaga {orig} para {alvo}? As datas ({entrada}–{saida}) não
  mudam." + aviso de conflito quando houver. **Cancelar/ESC/clicar fora reverte** sem persistir.
  **Confirmar** grava em `ajustes` e re-renderiza via `aplicarAjustes`.

### 5.5 — Marcador "✋" + "Voltar ao automático"
- Reservas ajustadas mostram **✋** + `title` "Posição ajustada manualmente" e contorno verde.
  Item na legenda. **"Voltar ao automático"** (no detalhe) apaga o registro de `ajustes` daquele
  `nro` e re-renderiza.

### 5.6 — `APP_VERSION = 'v1.3.0'` (rodapé).

---

## 3. Decisões técnicas

- **DATA PROIBIDA NO APP:** o arraste altera **apenas a vaga**; nenhuma interface muda datas
  (X do ghost travado; nenhum campo de data no store `ajustes`).
- **Pointer Events + limiar 5px** (não a HTML5 DnD API) → robusto em PC e tablet; clique abaixo do
  limiar abre o detalhe.
- **Vaga alvo por `data-vaga`** (identificador da linha) → correto mesmo com ordenação invertida.
- **`ajustes` por `nro`** → sobrevive à reimportação do PDF (não-destrutivo, como `contatos`).
- **Conflito não-destrutivo:** nunca desloca ninguém; manual prevalece e o conflito é só sinalizado.
- **Escopo:** apenas **carros (P/G)**. **Motos e overbooking ficam fora** (mantêm automático) —
  registrado como adiado.
- **`alocarVagas` ganhou `seed` opcional** (linhas pré-ocupadas) sem alterar o comportamento sem
  `seed` — garantido por teste ("sem ajustes = idêntico ao automático").
- O scroll horizontal do mapa passou a ignorar `.cell-span` (para não competir com o arraste).

---

## 4. Resultado dos testes — **162/162 ✓**

`npm install` → `npm test` (engine + integração) e `npx playwright test` (e2e).

- **Unitários (Node, `tests/engine.test.js`): 113/113 ✓** — não-regressão v1.0–1.2 + novas puras:
  `vagaValida`, `ehReservaCarro`, `aplicarAjustes` (fixa com datas originais; livres no espaço
  restante; sem duplicar; vaga inválida/nro inexistente/moto ignorados; sem ajustes = automático),
  `detectarConflito` (sobrepõe/não/ignora a própria).
- **Integração (jsdom + fake-indexeddb, `tests/integration.test.js`): 33/33 ✓** — migração v2→v3
  cria `ajustes` sem perder os demais; salvar ajuste fixa na vaga (✋); **persiste ao reabrir**;
  **reimport não apaga** ajustes; **voltar ao automático** remove; `data-vaga` em carros e ausente
  em moto.
- **E2E (Playwright + Chromium real, `tests/e2e.spec.js`): 16/16 ✓** — smoke v1.3.0; arrastar abre
  modal e **Confirmar** reposiciona (✋); **Cancelar** não muda nada; **abaixo do limiar → detalhe**;
  arraste com **ordenação invertida** (vaga por identificador); **voltar ao automático**; +
  testes v1.1/1.2. Screenshots: `Desktop/v1.3.0-mapa.png`, `-contato.png`, `-gestao.png`.

**Sem `test.skip` mascarando falhas.** Nenhuma impossibilidade headless ocorreu (e2e em Chromium
real; o arraste foi exercido via Pointer/Mouse events do Playwright).

---

## 5. Deploy

- Commit + push em **`ApolloDSk/controle-garagem-hotel-gumz` (master)**.
- **Tags:** `pre-v1.3.0` (segurança) e `v1.3.0`, enviadas ao remote.
- Standalone regenerado. **Cópia única no Desktop:** apenas `reserva-garagem-index-v1.3.0.html`.

---

## 6. Preservado (não regrediu)

Alocação automática v1.0.0 (com `seed` opcional retrocompatível); tudo da v1.1.0 (ordenação,
check-in no passado) e v1.2.0 (Gestão, Modelos, envio, Backup); stores `reservas`/`contatos`/
`gestao` intactos; reimport do PDF não toca em `ajustes`; fallback ao automático se a camada de
ajustes falhar.

---

## 7. Ressalvas / pendências (adiados)

- **Motos e overbooking não são arrastáveis** nesta versão (mantêm automático).
- Reserva **multi-carro** (mesmo `nro`, vários blocos): o ajuste fixa o 1º bloco de carro daquele
  `nro`; os demais seguem automáticos (edge raro).
- Roadmap **local (sem backend) concluído**. O que resta exige infraestrutura: **envio em massa**
  (backend + WhatsApp Business API) e **integração Reserva → Garage Spot**. Adiados: motos/
  overbooking arrastáveis; mapeamento de `[canal]`; múltiplas empresas; modelo p/ confirmadas/azuis.
