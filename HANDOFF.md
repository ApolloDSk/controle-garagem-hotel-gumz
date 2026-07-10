# HANDOFF — Reserva de Garagem do Hotel Gumz

> Documento de contexto para o próximo chat começar correto. Ler junto com `CLAUDE.md`,
> `PLANEJAMENTO.md` e o `RELATORIO-*` mais recente. A memória vive **nos arquivos**, não na conversa.

## Estado atual
- **Versão entregue: v1.5.3** (10/07/2026) — **Patch 2 (ferramentas):** motos editáveis (**2 = 1 vaga
  de carro**, cross-reserva; ímpar sozinha; **arrastáveis**; par manual na mesma vaga; sem seção Moto
  separada), **busca com destaque** (nº/nome/apto/modelo; dim+contorno+auto-scroll+contagem),
  **vagas extras** (até 3, `EXTRAn`; surgem só quando usadas; overbooking→extra), **adicionar reserva
  manual** (`reservasManuais`, DB **v5→v6**; encaixe + oferta de vaga extra + **dedup "manter uma só"**
  + removível + auditoria + ✍️), **painel de edições manuais**. Migração não-destrutiva. Testes
  **325/325** (+2 hooks `[real]`). Regra `amostras/` mantida (validação com PDF real pendente).
- **Versão anterior: v1.5.2** (10/07/2026) — **Patch 1 (correções visíveis):** nomes de reservas
  (menos "Hóspede"; `extrairNomes` exato→tolerante→heurística, zero-regressão), **obs de
  indisponibilidade → "sem garagem"** (`obsIndicaSemGaragem`; explícito sai do mapa, ambíguo lança +
  **notifica** no painel `#avisos`), **amarelo × laranja distintos** + **ícone 👥** no grupo, **aviso de
  overbooking com período** (`overbookingPeriodos`). Sem mudança de schema. Testes **291/291**.
  ⚠ **Regra permanente `amostras/`:** enquanto vazia, imprimir o caminho absoluto p/ o usuário largar
  os PDFs reais (`C:\Users\RBMarketing\Documents\GitHub\controle-garagem-hotel-gumz\amostras\`); validar
  quando presentes. **Validação com o PDF que reproduz "Hóspede" e com o Comandas real: PENDENTE.**
  **Próximo: v1.5.3 (ferramentas)** — ver `PLANEJAMENTO.md`.
- **v1.5.1.1** (09/07/2026) — correção do parser do Comandas para a **ordem de leitura real do PDF.js**
  (parser **por regiões/estado** + **regra do período**). Testes 265/265.
- **Versão anterior: v1.5.1** (08/07/2026). Repo único: `ApolloDSk/controle-garagem-hotel-gumz`
  (branch `master`). ⚠ **Nunca** tocar nos repos do **Garage Spot** (`garagespot-*`) — outro projeto.
- App canônico: `garagem-app/index.html`; standalone (Chrome): `garagem-app/controle-garagem-standalone.html`
  (regenerar com `node build-standalone.js` em `garagem-app/` sempre que mexer no `index.html`).
- Stack: HTML/JS/CSS puro + PDF.js + IndexedDB (DB `garagemGumz` **v5**: stores `reservas`,
  `contatos`, `gestao`, `ajustes`, `envios`, **`hospedados`**). Sem backend, sem APK.
- **⚠ Versionamento 1.5.x:** incrementos pequenos (`1.5.2`, …); correção sobre patch = `1.5.2.1`.
  **A 2.0 NÃO sai sem ordem explícita do Douglas** (reservada p/ a versão mais redonda).
- **Roadmap local (sem backend) CONCLUÍDO** (v1.0.0 → v1.5.1). O que falta exige infraestrutura ou
  amostras de outros PMSs (para calibrar a extração do Comandas).

## O que a v1.5.1 entregou (2º documento — Comandas / Hospedados)
1. **Dois slots** (Reservas / Hospedados) com **emissão** do documento sempre visível; parse pelo
   conteúdo. Núcleos testáveis `aplicarUploadReservas`/`aplicarUploadHospedados`.
2. **Validação por informação** (`validarDocumentoReservas`/`validarDocumentoComandas`): gera se
   extraiu a info (qualquer formato/PMS), **recusa + avisa** se não. **Bloqueio de documento mais
   antigo** (`compararEmissao`; emissão via `CreationDate`/`getMetadata` + reforço impresso).
3. **Parser `parsearComandas`** (pura): apto/nome/período/canal(opcional); veículo pelo PDV GARAGEM
   (CARRO→P, CAMIONETE→G, MOTO→moto); **tamanho opcional → padrão**; auto-filtro; multi-veículo.
   Extrator **isolado/plugável**, calibrado no Desbravador (única amostra).
4. **Hospedados** (store `hospedados`, DB **v4→v5**) como **ocupantes de prioridade máxima**, **render
   próprio** (🏠, `.cell-span.hospedado`), **arrastáveis e editáveis** (editor "Na garagem ↔ Saiu";
   remoção → área "Sem garagem (manual)" com auditoria/persistência/divergência) reusando `ajustes`
   pela **chave estável** = `${apto}__${entradaISO}__${tipoVeiculo||'x'}`.
5. **Anti-duplicação** (`dedupeReservasHospedados`): mesmo apto + período sobreposto → hospedado
   prevalece; a reserva não é desenhada. Migração não-destrutiva; reimport de um slot não afeta o
   outro. Testes **256/256** + exercício de ponta a ponta com o PDF real.

## O que a v1.5.0 entregou
1. **Status manual editável** (Confirmado/Aguardando/**Sem garagem**) no **detalhe** (Mapa) e na aba
   **Contato**, com **auditoria** `ultimaAlteracao:{funcionario(nome-texto do padrão), dataHora(ISO)}`.
   Funções puras `statusDerivadoDoPDF`/`statusEfetivo`/`pmsDivergente`. **"Sem garagem" tira do mapa.**
2. **Filtro + área "Sem garagem (manual)"** (checkbox `#chk-semgar`, cor `--semgar`, abaixo do
   overbooking) com status **re-editável** → a reserva **volta ao mapa**.
3. **Divergência com o PMS** sinalizada (badge + marcador ◆ + tooltip com quem/quando). Ajuste manual
   **preservado na reimportação**; some quando o PDF passa a bater.
4. **Arraste para dentro/fora do overbooking** (sentinela `"OVERBOOKING"` em `vagaIdManual`): **visual/
   organização — NÃO muda status nem PMS**; mover para overbooking **libera a vaga** e realoca os
   automáticos. Motos seguem **não arrastáveis**. ✋ + "Voltar ao automático" limpa **só o placement**.
5. Store **`ajustes` estendido** (DB **segue v4**; registros antigos válidos; `salvarAjuste`/
   `salvarStatusManual` preservam os campos não editados via `_montarAjuste`).

## O que a v1.4.0 entregou
1. **`[nome]` em formato de nome próprio** (`formatarNomeProprio`: conectores minúsculos, acentos,
   hífen) — só na **saída** da chave `[nome]`; não altera o dado armazenado.
2. **Contato:** clicar em **qualquer parte da reserva** seleciona (controles internos com `stopPropagation`).
3. **Status "enviado"** (renomeado de "resolvido"), **derivado do histórico** (`statusEnvioReserva`);
   **digitar telefone não marca**; registro nasce no **disparo do `wa.me`** (`registrarEnvio`).
   ⚠ **"enviado" = envio disparado, NÃO entrega confirmada** (entrega real exige WhatsApp Business API).
4. **Store `envios`** (DB **v4**, `id` autoincrement + índice `nro`): histórico por hospedagem; só o
   envio escreve; **reimport do PDF não apaga**. **Prancheta** (canto inferior direito) no **Contato**
   (reserva selecionada) e no **detalhe** do Mapa, com data/hora/funcionário (nome-texto) + estado vazio.
5. **Detalhe:** copiar **nº PMS e OTA** ao clicar (fallback `file://`).
6. **Mapa:** **pan vertical + horizontal** no fundo; arraste de **bloco** = mover vaga (v1.3.0) inalterado
   (decisão pela origem do `pointerdown`).

## O que a v1.3.0 entregou
1. **Edição manual por arraste — só trocar de VAGA** (carros P/G). Pointer Events + ghost +
   **limiar 5px** (clique abaixo do limiar abre o **detalhe**). Vaga alvo por **`data-vaga`**
   (funciona com ordenação cima↔baixo).
2. ⚠ **DATA PROIBIDA NO APP:** o arraste muda só a vaga; datas vêm do PMS (PDF) e nunca mudam.
3. **Confirmação obrigatória** ("mover de X para Y; datas não mudam") + aviso de **conflito
   não-destrutivo**; Cancelar/ESC/fora reverte sem persistir.
4. Marcador **✋** + "Voltar ao automático" (apaga o ajuste do `nro`).
5. Store **`ajustes`** (DB v3, chave `nro`, sem campo de data): só a edição manual escreve;
   **sobrevive à reimportação do PDF**.
6. **Escopo (na v1.3.0):** carros (P/G). **Motos e overbooking não eram arrastáveis** — a v1.5.0
   passou a permitir arrastar **overbooking** (motos seguem fora).

## v1.1.0 / v1.2.0 (mantidos)
Abas Mapa/Contato/Gestão com ícones; copiar PMS/OTA; telefone Confirmar↔Editar; ordenação das
vagas; info de upload; check-in no passado (borda cortada). Gestão (Empresa/Funcionários/Modelos/
Backup); Modelos com chaves `[nome][data][canal][empresa][funcionario]` (substituição real);
envio com preview/troca/editar; Backup export/import (Mesclar/Substituir).

## Testes (versionados em `tests/`) — 212/212
- `npm install` (jsdom, fake-indexeddb, @playwright/test) + `npx playwright install chromium`.
- `npm run test:engine` (141) · `npm run test:integration` (47) · `npx playwright test` (24).
- **Regra:** tudo verde antes de commitar; **sem `test.skip`** mascarando; corrigir causa raiz.
- Funções puras testáveis ficam **dentro** dos marcadores `// ===ENGINE START/END===`.
- ⚠ Estado (`gestaoConfig`, `contatoGrupos`, `db`, `ajustesMap`, `ultimaAlocacao`, **`enviosPorNro`**,
  `todasReservas`) é **escopo de módulo** (não em `window`). Para testar use handlers/accessors globais
  (`salvarAjuste`, `removerAjuste`, `aplicarAjustes`, `registrarEnvio`, `getGestaoConfig()`,
  `dbGetAll(store)`, `ativasNoPeriodo()` etc.).
- **Boot determinístico:** `init()` expõe `window.__appReady`; o harness aguarda o boot COMPLETO
  (`aguardarBoot`) — corrige a flakiness pré-existente de timing **na raiz** (sem mascarar).

## Avisos que NÃO podem se perder
- **DATA PROIBIDA NO APP** (só troca de vaga). **`alocarVagas(rP, seed)`**: `seed` é opcional e
  retrocompatível — sem `seed`, comportamento idêntico ao automático v1.0.0.
- **Migração não-destrutiva:** novo store via `onupgradeneeded`; nunca apagar dados do usuário.
  Reimport do PDF **não toca** em `contatos`/`gestao`/`ajustes`.
- **Conflito é não-destrutivo** (nunca desloca ninguém; só sinaliza).
- ⚠ **Limitação `wa.me` (v1.4.0):** "enviado" = o app **disparou** o `wa.me`; **não** confirma
  entrega/leitura (exige WhatsApp Business API/backend). Status é **derivado** do store `envios`
  (`statusEnvioReserva`), nunca do telefone. Reimport do PDF **não toca** em `envios`.
- **`[nome]` formatado** (`formatarNomeProprio`) é **só na saída** da chave; `nomeCompleto` segue cru.
- **v1.5.0 — ajuste manual NUNCA sobrescrito pela reimportação** (status **e** placement, por `nro`);
  divergência com o PMS só é **sinalizada** (`pmsDivergente`). **Mover para overbooking é visual** — não
  altera `statusEfetivo` nem o PMS. **`statusEfetivo`** = override manual (`ajustes.statusManual`) sobre
  `statusDerivadoDoPDF`. Store `ajustes` foi **estendido** (segue DB v4; registros antigos válidos).
- Substituição de chaves nunca deixa literal (v1.2.0); limitação de caminho do navegador (v1.1.0);
  check-in no passado só aparece se constar no PDF.
- Alocação automática (amarelos/azuis/score/best-fit/overbooking) é **intocável**.

## Próximos passos (exigem infraestrutura)
- **Confirmação real de entrega da mensagem** (entregue/lida): exige WhatsApp Business API/backend.
- **Envio em massa via WhatsApp:** backend Node.js + WhatsApp Business API (Meta), templates
  aprovados; a lógica de mensagem (`substituirChaves`/modelos) já é reutilizável.
- **Integração Reserva → Garage Spot:** camada compartilhada; passo leve via export/import
  (Backup da v1.2.0 é base; chave = `nro`).
- **Adiados:** **motos** arrastáveis; (opção) arraste "posicional" sem realocar os automáticos;
  mapeamento de `[canal]`; múltiplas empresas; modelo p/ confirmadas/azuis.

## Tags
- `pre-v1.0.0`, `v1.0.0`, `pre-v1.1.0`, `v1.1.0`, `pre-v1.2.0`, `v1.2.0`, `pre-v1.3.0`, `v1.3.0`,
  `pre-v1.4.0`, `v1.4.0`, `pre-v1.5.0`, `v1.5.0`.
