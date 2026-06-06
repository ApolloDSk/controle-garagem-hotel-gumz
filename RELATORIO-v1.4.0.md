# RELATÓRIO — Reserva de Garagem v1.4.0

> Contato (seleção por toda a reserva, status **enviado** + histórico) + detalhe da reserva
> (copiar nº PMS/OTA, prancheta de envios) + **pan vertical** no mapa + **`[nome]` em formato de
> nome próprio**. Entregue em 06/06/2026. Repo: `ApolloDSk/controle-garagem-hotel-gumz` (`master`).
> Nenhum repositório do Garage Spot foi tocado.

---

## Objetivo

Refinar o fluxo de contato e o detalhe da reserva, registrar o histórico de envios por hospedagem,
melhorar a navegação do mapa e padronizar a saída do nome do hóspede nas mensagens — tudo **sem
backend** e **sem quebrar** nada das versões anteriores (alocação automática, arraste de mover vaga,
Gestão/Modelos, Backup, selo de gravação).

---

## O que foi implementado

### 5.1 — `[nome]` em formato de nome próprio
- Função **pura `formatarNomeProprio(nome)`** (no bloco `ENGINE`): baixa para minúsculas e
  capitaliza a 1ª letra de cada palavra, mantendo **minúsculos os conectores** `de/da/do/dos/das/e`
  (exceto quando são a 1ª palavra). Trata **acentos** (`JOÃO`→`João`) e **hífen** (`ANA-MARIA`→`Ana-Maria`).
- Aplicada **na substituição da chave `[nome]`** dentro de `substituirChaves`. **Não altera o
  armazenamento** — `nomeCompleto` segue como veio do PDF (mapa/tooltip/detalhe inalterados); só a
  saída de `[nome]` nas mensagens muda. Ex.: `MARIA DOS SANTOS` → `Maria dos Santos`.

### 5.2 — Contato: selecionar clicando em qualquer parte da reserva
- O **item inteiro** (`.ct-item`) passou a selecionar a reserva (antes só o nome/`.ct-top`).
- Controles internos (copiar nº PMS/OTA, campo de telefone, botões Confirmar/Editar/Enviar) usam
  `stopPropagation` para **executar a própria ação** sem efeito colateral na seleção.

### 5.3 — Status "resolvido" → "enviado" (derivado, só após o envio)
- O status verde foi **renomeado para "enviado"** e agora é **derivado do histórico** (função pura
  `statusEnvioReserva`): a reserva fica "enviado" quando há **≥1 registro de envio**; antes disso fica
  no estado neutro ("pendente").
- **Digitar/confirmar o telefone NÃO marca mais "enviado".** O registro (e o status) acontece **no
  momento em que o `wa.me` é disparado** pelo app — no modal de envio (verificando/overbooking) e no
  link simples de reservas confirmadas (categoria `confirmado`).
- **Limitação registrada:** "enviado" = **envio disparado pelo app** (link `wa.me` aberto). O app
  **não tem como confirmar entrega/leitura** — isso exige **WhatsApp Business API (backend)**. Adiado.
- O estado de interface **Confirmar↔Editar** do telefone foi preservado (lógica `estadoTelefoneInicial`
  inalterada; `telefoneStatus:'resolvido'` é só o marcador interno de telefone confirmado).

### 5.4 — Histórico / prancheta de envios por hospedagem
- Novo store **`envios`** (IndexedDB **v3→v4**, `keyPath:'id'` autoincrement, índice por `nro`),
  criado por `onupgradeneeded` **sem tocar** nos demais stores. Registro:
  `{ id, nro, dataHora (ISO), funcionario (nome-texto), categoria, modelo }`.
- **Só a ação de envio escreve** (`registrarEnvio`); a **reimportação do PDF nunca apaga** `envios`
  (sobrevive como `contatos`/`ajustes`). O nome do funcionário é gravado como **texto** (estável
  mesmo que o padrão mude depois).
- **Prancheta** (canto inferior direito) com data, hora e funcionário, **mais recente em cima**,
  estado vazio amigável ("Nenhum envio registrado"):
  - **No Contato:** painel flutuante que reflete a **reserva selecionada**.
  - **No Mapa:** dentro do **detalhe da reserva** (modal que abre no clique abaixo do limiar).

### 5.5 — Detalhe da reserva: copiar nº PMS e OTA ao clicar
- No modal de detalhe, **nº PMS** e **localizador OTA** ficaram clicáveis para copiar (mesma
  `copiarTexto`/feedback "Copiado!" e fallback `file://` já usados no Contato), com cursor `pointer`.

### 5.6 — Mapa: pan vertical (sem conflitar com mover vaga)
- O arraste do **fundo do mapa** (área sem reserva) agora faz **pan horizontal e vertical**
  (horizontal no `#mapa-wrapper`; vertical na página via `scrollingElement`).
- **Regra anti-conflito:** `pointerdown` sobre um **bloco de reserva** (`.cell-span`) segue o fluxo de
  **mover vaga (v1.3.0)**, inalterado; só o **fundo** dispara o pan. Decisão pela origem do `pointerdown`.

---

## Decisões técnicas

- **`[nome]` em formato de nome próprio** com conectores minúsculos, acentos e hífen — apenas na
  **saída** da chave, preservando o dado original.
- **Status derivado do histórico** (não de flag de telefone) — fonte única de verdade = store `envios`.
- **"enviado" = envio disparado, não entrega confirmada** — entrega real exige backend (WhatsApp
  Business API). Anotado para a fase de infraestrutura.
- **Pan vertical separado do arraste de mover vaga** pela **origem do `pointerdown`** (fundo vs. bloco).
- **Migração não-destrutiva v3→v4:** `envios` criado por `onupgradeneeded`; `reservas`/`contatos`/
  `gestao`/`ajustes` intactos. Backup passou a exportar/importar `envios` (append-only; mesclar não
  duplica por assinatura `nro|dataHora|funcionario`).

---

## Testes — 188/188 (todos verdes)

- **Engine (unitários):** **128/128** — inclui `formatarNomeProprio` (acentos, hífen, conectores,
  1ª palavra), `[nome]` formatado via `substituirChaves`, `statusEnvioReserva`, `montarRegistroEnvio`,
  `enviosOrdenados`.
- **Integração (jsdom + fake-indexeddb):** **40/40** — status enviado derivado (telefone não marca),
  `registrarEnvio` grava o registro, prancheta (Contato e detalhe) + estado vazio, copiar nº no
  detalhe, persistência/reimport de `envios`, migração v3→v4 (5 stores), seleção por toda a reserva.
- **Playwright (Chromium real):** **20/20** — smoke `v1.4.0`; Contato (clicar fora do nome seleciona;
  copiar nº não derruba seleção); enviar marca "enviado" + prancheta; detalhe (copiar PMS/OTA +
  prancheta no canto inferior direito); **pan nas duas direções no fundo** + bloco ainda move de vaga.
- **Sem `test.skip` mascarando.** Nenhuma impossibilidade headless encontrada — todos os fluxos
  (incluindo pan vertical e horizontal) foram exercitados de verdade.

### Correção de causa raiz — flakiness pré-existente do harness de integração
- Os testes de integração eram **flaky sob carga** (falhas de timing diferentes a cada execução do
  `npm test`): `novoApp()` só esperava o **chip do DB** (setado **no meio** do `init()`), então os
  testes corriam contra o **fim** do `init()` (`carregarGestao/Ajustes/Envios/DoBanco`), interleaving
  transações no IndexedDB.
- **Causa raiz corrigida** (sem mascarar): `init()` passou a expor `window.__appReady` (a própria
  promessa) e o harness agora **aguarda o boot COMPLETO** (`aguardarBoot`). Resultado: **5/5** execuções
  do `npm test` 100% determinísticas (128/128 + 40/40).

---

## Regra de cópia única no Desktop

Ao gerar a cópia standalone, as cópias de versões anteriores são **removidas**, mantendo só a mais
recente: o Desktop fica apenas com **`reserva-garagem-index-v1.4.0.html`** (ver bloco de deploy).

---

## Preservado (não regrediu)

Alocação automática, ordenação, check-in no passado, **arraste de mover vaga (v1.3.0)**,
Gestão/Modelos/`substituirChaves`, Backup, envio `wa.me`/preview, **selo de gravação** ("salvo"/
"memória"), fallback em memória. Stores `reservas`/`contatos`/`gestao`/`ajustes` intactos; reimport
do PDF continua não-destrutivo e **não toca** em `envios`.

---

## Ressalvas / adiados

- **Confirmação real de entrega da mensagem** (entregue/lida): exige **WhatsApp Business API/backend**.
- Integração **Reserva → Garage Spot**; **envio em massa**; mapeamento do **nome do canal** (`[canal]`);
  **múltiplas empresas**; modelo para **reservas confirmadas/azuis**; **motos/overbooking arrastáveis**.

---

## Declaração

- Repositório usado: `controle-garagem-hotel-gumz` (`master`). **Nenhum repo do Garage Spot foi tocado.**
- Tags: `pre-v1.4.0` e `v1.4.0` (enviadas ao remote).
- `APP_VERSION` = **v1.4.0** no rodapé. Migração não-destrutiva confirmada (`envios` via upgrade v3→v4).
- **Status "enviado" reflete o envio disparado pelo app** (não confirma entrega — anotado para o backend).
- Arraste de mover vaga (v1.3.0) e selo de gravação **seguem intactos**.
- Testes: **188/188** (128 engine + 40 integração + 20 Playwright; sem `skip`).
- Desktop contém **apenas** `reserva-garagem-index-v1.4.0.html`.
</content>
</invoke>
