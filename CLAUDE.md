# CLAUDE.md — Reserva de Garagem do Hotel Gumz

> Instruções permanentes para qualquer assistente (Claude) em chats futuros deste projeto.
> **Leia este arquivo inteiro antes de qualquer alteração.** A memória do projeto vive aqui e
> em `PLANEJAMENTO.md` / `RELATORIO-*.md`, **não** na conversa (os chats expiram).

---

## Identidade do projeto

**Reserva de Garagem do Hotel Gumz** — aplicativo que lê o **PDF de listagem de reservas**
exportado do PMS (Desbravador) e monta automaticamente o **mapa de ocupação da garagem** no
tempo, destacando em amarelo quem ainda não confirmou a vaga.

Faz parte do **"Projeto Apollo"** do Douglas (setor de reservas do Hotel Gumz, Balneário
Camboriú/SC). Substitui o controle manual em Excel, que não reflete cancelamentos/no-shows.

**Por que PDF (decisão arquitetural):** PMSs de hotelaria (Desbravador, CM, etc.) raramente
têm API acessível. O relatório PDF é o **caminho universal** — qualquer PMS exporta algum
relatório. Mantenha essa estratégia; ela desamarra o produto de qualquer fornecedor.

---

## Repositório ÚNICO

- **`ApolloDSk/controle-garagem-hotel-gumz` (branch `master`).**
- O app vive em `garagem-app/index.html` (arquivo canônico). Versão para abrir direto no
  Chrome (PDF.js embutido): `garagem-app/controle-garagem-standalone.html`.
- ⚠️ **NUNCA** tocar nos repositórios do **Garage Spot** (`garagespot-app`, `garagespot-dev`,
  `garagespot-hotelgumz`) — é **outro projeto**. Não confundir.

---

## Stack atual

- **HTML / JS / CSS puro** + **PDF.js** (v3.11.174) + **IndexedDB**.
- **Sem backend, sem APK** (por enquanto). Tudo roda no navegador.
- Empacotamento opcional em **Electron** (`main.js`, `package.json`) para gerar `.exe` Windows
  — mas o uso principal hoje é abrir o `index.html`/standalone no Chrome.

### Arquitetura do código (`garagem-app/index.html`)
- Bloco **`// ===ENGINE START===` … `// ===ENGINE END===`**: **lógica pura, sem DOM**
  (parser, classificação, alocação, prioridade, mesclagem, mensagens). É testada em Node
  extraindo esse bloco — **mantenha as funções puras dentro desses marcadores**.
- Fora do bloco: DOM, IndexedDB, render do mapa e da aba Contato.
- **IndexedDB** (`garagemGumz`, **v6**): stores **`reservas`** (keyPath `id`, escrito **só** pela
  importação do PDF de Reservas), **`contatos`** (keyPath `nro`, só a ferramenta de contato),
  **`gestao`** (singleton `id:"config"`, v1.2.0), **`ajustes`** (keyPath `nro`, edição manual/status +
  sentinelas `OVERBOOKING`/`EXTRAn`, v1.3.0/v1.5.0/v1.5.3), **`envios`** (keyPath `id` autoincrement +
  índice `nro`, histórico de envios, v1.4.0), **`hospedados`** (keyPath `id`, 2º documento — Comandas
  em aberto, v1.5.1 — só o comandas escreve, reconstruído a cada import) e **`reservasManuais`**
  (keyPath `id`, reservas adicionadas na mão, v1.5.3 — nunca tocado pelo PDF; dedup reconcilia). Essa
  separação torna a mesclagem **não-destrutiva** trivial: importar um documento nunca toca em
  telefones/ajustes/envios/manuais nem no outro slot.
- **Chave estável do hospedado** = `${apto}__${entradaISO}__${tipoVeiculo||'x'}`, usada como `id` do
  store `hospedados` **e** como `nro` sintético do objeto reserva-like — é isso que permite reusar
  `ajustes` (arraste/status), a área "Sem garagem (manual)" e a divergência para hospedados.
- **Chave da reserva no PMS = `nro`** (estável mesmo se nome/apto mudarem). Como um `nro` pode
  ter vários aptos/carros, a chave primária do store `reservas` é `id = nro__apto__vagaIdx`.

### Como rodar os testes / regenerar o standalone
- `node setup.js` (em `garagem-app/`) → baixa o PDF.js para `pdfjs/` (gitignored).
- `node build-standalone.js` (em `garagem-app/`) → regenera `controle-garagem-standalone.html`
  a partir do `index.html` (embute o PDF.js inline). **Rode sempre que mexer no `index.html`.**
- **Harness de testes versionado em `tests/`** (raiz). Setup: `npm install` (instala
  `jsdom`, `fake-indexeddb`, `@playwright/test`; `npx playwright install chromium` p/ o e2e).
  - `npm run test:engine` → unitários em Node puro (extrai o bloco ENGINE do `index.html`).
  - `npm run test:integration` → integração `jsdom` + `fake-indexeddb`.
  - `npx playwright test` → e2e em Chromium real (servidor `tests/serve.js`).
  - **Regra:** todos verdes antes de commitar; **sem `test.skip` mascarando** falhas; corrigir a
    causa raiz. As funções puras testáveis vivem **dentro** dos marcadores ENGINE.

---

## Regras de trabalho (padrão do Douglas — herdadas e inegociáveis)

1. **Versionamento formal:** `vX.Y.Z` **visível na tela** (constante `APP_VERSION`, no rodapé).
   **Regra 1.5.x (v1.5.0+):** incrementos **pequenos** (`1.5.1`, `1.5.2`, …); uma **correção em cima
   de um patch** ganha um nível extra (`1.5.2.1`, `1.5.2.2`). **NÃO lançar a 2.0 sem ordem explícita
   do Douglas** — a **2.0 é reservada** para a versão mais completa/redonda.
2. **O app nunca quebra:** fallback em tudo. Se o IndexedDB falhar (modo privado, navegador
   antigo), continua funcionando **em memória**, sem travar.
3. **Migração de dados NÃO destrutiva:** nunca apagar o que o usuário salvou; evoluir o schema
   preservando os dados.
4. **Mesclagem é sagrada:** ao reimportar PDF, **dados manuais (telefones, ajustes) NUNCA se
   perdem**. Reserva existente → atualiza campos do PDF; nova → insere; sumida do PDF →
   arquiva (`ativo:false`), **não apaga**.
5. **Ler o código antes de editar cada parte.** Preservar o que já funciona (ver abaixo).
6. **Testar fielmente o fluxo real** com o PDF real (`LISTAGEM RESERVA.pdf`).
7. **Backup/tag antes de mexer** (`git tag pre-vX.Y.Z`) e **cópia no Desktop a cada versão**.
8. **Só enviar/implementar quando o Douglas pedir.** Prompts completos e detalhados.
9. **Toda decisão registrada** neste handoff (CLAUDE.md / PLANEJAMENTO.md / RELATORIO).
10. **Otimizar tokens** unindo patches relacionados quando fizer sentido.

### Princípio-guia
**Documentação é sagrada — nada se perde.** Dados manuais preservados entre importações.
Dados estruturados, padronizados (JSON) e exportáveis, **pensando na futura integração com o
Garage Spot** (a chave é o `nro` do PMS).

---

## NÃO REGREDIR (preservar — validado com dados reais)

- Leitura de PDF com **newlines** (`lerPDFcomNewlines`) — separa nomes corretamente.
- **Extração de nomes** (`extrairNomes`, `RE_EMPRESAS`, `RE_IGNORAR`): hóspede = penúltimo nome
  real; titular = último; empresas (Expedia/Booking) como titular → usa o nome real. Validado:
  ELISANGELA DE LIMA ALEIXO MACHADO, HENRIDES DOS SANTOS, RONAN LAMPERT, BETINA FAGUNDES…
- **Extração de apto** (regex com linhas vazias) + fallback achatado. Validado: 129, 130, 243,
  272, 351, 355, 357…
- **Motos pareadas** (`processarMotos`): 2 motos sobrepostas = 1 vaga de carro (célula roxa,
  2 nomes); moto ímpar em M1.
- **Múltiplos carros / TOTAL CARROS** (⚠ **precisado na v1.5.7 — ver 7.1**): "GARAGEM 0X CARROS" é
  **por apartamento** (soma entre os blocos) e "TOTAL X CARROS" é o **total da RESERVA** (não multiplica
  por apartamento); "TOTAL X APARTAMENTOS E Y CARROS" é **ignorado**. Validado (#26161 Henrides:
  apto 129=1 + apto 130=2 = 3 vagas; #26389: 5 aptos com total 04 → 4 carros).
- **Classificação** (`classificar`): GARAGEM confirma; SEM GARAGEM ignora; GRANDE/R$100 grande;
  PEQUENO/FREE/R$40/R$20 pequeno; R$60 = grande baixa temporada / pequeno alta; MOTO+GARAGEM.
- **Filtros de data**, **tema claro/escuro**, **tooltips**, **scroll horizontal (drag)**,
  **destaque hoje/fim de semana**.

---

## Comportamentos da v1.1.0 a preservar

- **Cópia (PMS/OTA):** clique copia o valor; `copiarTextoCore` tenta `navigator.clipboard` e
  **cai no fallback** `execCommand('copy')` (necessário em `file://`). Nunca lança.
- **⚠ Limitação de caminho do navegador (registrar sempre):** o navegador **não expõe o caminho
  real** do arquivo (devolve `C:\fakepath\...`). A info de upload mostra **nome + data/hora**
  (confiáveis); o caminho **só** aparece se o ambiente fornecer um valor real (ex.: Electron),
  senão a nota *"caminho indisponível pelo navegador"*. **Nunca inventar caminho.**
- **Check-in no passado:** quem entrou antes da janela e ainda está hospedado **aparece** no mapa
  com a **borda esquerda cortada** (continuação, `_ ]`); `recorteEsquerdo(reserva, janelaInicio)`
  decide. **Pré-requisito de dado:** só exibe se a reserva constar no PDF — se necessário, exportar
  o relatório do Desbravador começando alguns dias antes de hoje.
- **Ordenação das vagas:** `aplicarOrdemLinhas` só inverte a **exibição** (persistida em
  `localStorage`), **nunca** a alocação.
- **Telefone Confirmar↔Editar:** estado de interface; o valor salvo em `contatos` não muda.

## Comportamentos da v1.2.0 a preservar

- **Aba Gestão** (Empresa, Funcionários, Modelos de Mensagens, Backup/Restauração). Store
  **`gestao`** (singleton `id:"config"`) criado por `onupgradeneeded` (DB v2) **sem tocar** em
  `reservas`/`contatos`; semeadura idempotente em `carregarGestao` (só grava se ausente).
- **Chaves dos modelos:** `[nome] [data] [canal] [empresa] [funcionario]`. `substituirChaves`
  **nunca deixa chave literal** (valor real ou vazio). `[data]` = entrada+saída (`fmtData`).
- **Mapeamento status→categoria:** **amarelo→verificando**, **vermelho→overbooking**;
  **azul/confirmada fica fora** do sistema de modelos (link `wa.me` simples).
- **Envio (Contato):** preview substituído → troca de modelo 1/2/3 → **Editar vale só p/ aquele
  envio** (NÃO altera o modelo salvo; modelos só mudam em Gestão) → `wa.me` (`linkWhatsAppTexto`).
- **Backup:** export = dump genérico de todos os stores (`schema:"reserva-garagem-backup/1"`);
  import **Mesclar** (padrão, não-destrutivo: só contatos ausentes; gestao só se não houver local;
  não toca reservas) e **Substituir** (com confirmação). Arquivo inválido não quebra.
- Funcionário/Modelo **padrão = único**; padrão de funcionário inicial = 1º; remover o padrão cai
  para o 1º. As funções de decisão são puras (no bloco ENGINE), testadas.

## Comportamentos da v1.3.0 a preservar

- **Edição manual = só trocar de VAGA por arraste.** ⚠ **DATA É PROIBIDA NO APP** — datas são
  verdade do PMS e chegam só pelo PDF; nenhuma interface as altera (X do ghost travado; store
  `ajustes` sem campo de data).
- **Store `ajustes`** (DB v3, `keyPath:"nro"`): `{nro, vagaIdManual, criadoEm, atualizadoEm}`.
  **Só a edição manual escreve**; reimport do PDF **não toca** — o ajuste sobrevive (como `contatos`).
- **`aplicarAjustes(reservas, ajustes)`** (pura): fixa carros ajustados na vaga manual com as
  **datas originais** e roda a automática (inalterada) no espaço restante via `alocarVagas(rP, seed)`
  (parâmetro `seed` opcional, retrocompatível). Fallback total ao automático em erro.
- **`detectarConflito`** (pura): sinaliza sobreposição na vaga alvo; **não desloca ninguém**.
- **Arraste:** Pointer Events + **limiar 5px** (abaixo = clique → detalhe). Vaga alvo resolvida por
  **`data-vaga`** (funciona com ordenação cima↔baixo). Confirmação obrigatória; Cancelar/ESC/fora
  reverte sem persistir. Marcador **✋** + "Voltar ao automático" (apaga o ajuste do `nro`).
- **Escopo:** só **carros (P/G)**. **Motos e overbooking não são arrastáveis** (adiado).

## Comportamentos da v1.4.0 a preservar

- **`[nome]` em formato de nome próprio:** função pura `formatarNomeProprio` (Title Case;
  conectores `de/da/do/dos/das/e` minúsculos exceto na 1ª palavra; acentos; hífen) aplicada **só na
  saída** da chave `[nome]` em `substituirChaves`. **Não altera o armazenamento** (`nomeCompleto`
  segue cru no mapa/tooltip/detalhe).
- **Contato — seleção por toda a reserva:** clicar em qualquer parte do `.ct-item` seleciona; os
  controles internos (copiar nº, telefone, botões) usam `stopPropagation`.
- **Status "enviado" (renomeado de "resolvido"):** **derivado do histórico** (`statusEnvioReserva`:
  ≥1 registro → "enviado"). **Digitar telefone NÃO marca enviado**; o registro nasce **no disparo do
  `wa.me`** (`registrarEnvio`). ⚠ **"enviado" = envio disparado pelo app, NÃO entrega confirmada** —
  entrega real exige WhatsApp Business API (backend). O `telefoneStatus:'resolvido'` virou só o
  marcador interno de telefone confirmado (lógica Confirmar↔Editar inalterada).
- **Store `envios`** (DB **v4**, `keyPath:'id'` autoincrement, índice `nro`): `{id,nro,dataHora(ISO),
  funcionario(nome-texto),categoria,modelo}`. Só o envio escreve; **reimport do PDF não toca**. Nome do
  funcionário gravado como **texto** (estável). Backup exporta/importa `envios` (append-only; mesclar
  não duplica por assinatura `nro|dataHora|funcionario`).
- **Prancheta de envios** (canto inferior direito, mais recente em cima, estado vazio amigável): no
  **Contato** (`#prancheta-contato`, reflete a reserva selecionada) e no **detalhe** do Mapa
  (`#detalhe-prancheta`).
- **Detalhe da reserva:** nº PMS e localizador OTA **clicáveis para copiar** (mesma `copiarTexto` +
  fallback `file://`).
- **Pan do mapa:** o **fundo** (área sem reserva) faz pan **horizontal** (no `#mapa-wrapper`) **e
  vertical** (na página, via `scrollingElement`). `pointerdown` **sobre um bloco** segue o **arraste de
  mover vaga (v1.3.0)** — decisão pela origem do `pointerdown`; não conflitar.
- **Boot determinístico nos testes:** `init()` expõe `window.__appReady`; o harness aguarda o boot
  COMPLETO (corrige flakiness pré-existente de timing — sem mascarar).

## Comportamentos da v1.5.0 a preservar

- **Status manual editável (Parte A):** editor (Confirmado/Aguardando/**Sem garagem**) no **detalhe**
  (Mapa) e na aba **Contato**. Funções puras `statusDerivadoDoPDF` (amarelo→`aguardando`; resto→
  `confirmado`), `statusEfetivo(reserva, ajuste)` (override manual **prevalece** sobre o PDF) e
  `pmsDivergente`. **"Sem garagem" tira a reserva do mapa/alocação** (roteada para
  `resultado.semGaragem`). Editar grava no store **`ajustes`** com **auditoria**
  `ultimaAlteracao:{funcionario(nome-texto do padrão), dataHora(ISO)}`.
- **Filtro + área "Sem garagem (manual)":** checkbox `#chk-semgar` (desligado por padrão) exibe a
  **área com cor distinta** (`--semgar`, `.secao-semgar`) **logo abaixo do overbooking**, com editor
  para **voltar** o status (Confirmado/Aguardando) → a reserva **retorna ao mapa**.
- **Divergência com o PMS:** `pmsDivergente` = há override manual **≠** status do PDF → **badge**
  (detalhe/Contato) + **marcador ◆** (bloco do mapa / item da área) + tooltip com **quem/quando**.
  Some quando o PDF passa a bater. Reimport **mantém** o ajuste e apenas **sinaliza**.
- **Arraste no overbooking (Parte D):** blocos de overbooking **arrastáveis** e a área de overbooking
  é **alvo de drop** (`data-vaga="OVERBOOKING"`). Sentinela **`"OVERBOOKING"`** em `vagaIdManual`
  (`placementOverbooking`/`placementValido`): a reserva é **fixada na área de overbooking** (libera a
  vaga; **não ocupa vaga**; automáticos realocam no espaço). **É visual/organização — NÃO altera o
  status (`statusEfetivo`) nem o PMS. Datas nunca mudam.** Confirmações para dentro/fora; conflito só
  ao cair em vaga real. **Motos continuam NÃO arrastáveis.** ✋ + "Voltar ao automático" **limpa só o
  placement** (mantém o status manual, se houver).
- **Migração não-destrutiva SEM subir o DB (segue v4):** nenhum store novo. O store **`ajustes`** foi
  **estendido** (`statusManual`, `ultimaAlteracao`, sentinela `"OVERBOOKING"` em `vagaIdManual`);
  registros antigos (só `vagaIdManual`) seguem válidos (campos ausentes = `null`). **Ajuste manual
  (status e placement) NUNCA é sobrescrito pela reimportação do PDF** (mantido por `nro`). `salvarAjuste`
  (placement) e `salvarStatusManual` (status) **preservam** os demais campos (`_montarAjuste`).

## Comportamentos da v1.5.1 a preservar (2º documento — Comandas/Hospedados)

- **Dois slots** (Reservas / Hospedados) no cabeçalho, cada um com **info própria** (upload +
  **emissão** do documento em uso, sempre visível). Parse **sempre pelo conteúdo** (`file-input` e
  `file-input-hosp`). Fluxo de cada upload: `lerPDFcompleto` → **validar por informação** →
  **bloqueio de emissão** → aplicar. Núcleos testáveis: `aplicarUploadReservas` /
  `aplicarUploadHospedados`.
- **Validação por informação** (não por formato): `validarDocumentoReservas` /
  `validarDocumentoComandas` (puras) — gera se extraiu ≥1 registro (mesmo em outro PMS), **recusa +
  avisa** se não. **Emissão** via `CreationDate` (`getMetadata`) + reforço impresso
  (`parsePdfDate`/`extrairEmissaoImpressa`); **documento mais antigo é recusado** (`compararEmissao`),
  mantendo o atual; emissão desconhecida prossegue sinalizando.
- **Parser do Comandas** (`parsearComandas`, pura) — **v1.5.1.1: POR REGIÕES/ESTADO, independente de
  ordem** (⚠ a v1.5.1 assumia bloco em **linha única** e dava **0 hóspedes** no PDF real, pois o PDF.js
  entrega os campos em **linhas separadas / outra ordem**). Um bloco começa na linha `<apto> <NOME>` (o
  nome é o texto **antes** da 1ª data / "Extras" — casa linha única **e** ordem de leitura real); a
  região vai até o próximo bloco ou "Total Geral". Dentro da região, independente de ordem:
  **entrada/saída = 2 primeiras datas de ANO 4 DÍGITOS** (as diárias de 2 dígitos das linhas GARAGEM são
  **ignoradas**); **canal** entre "Extras"/"Taxas" (ou entre a 2ª data e "Extras" no layout de linha
  única), opcional; **veículo** nas linhas **GARAGEM/ESTACIONAMENTO** do corpo (`CARRO DE PASSEIO`→P,
  `CAMIONETE`→G, `MOTO`→moto; **tamanho opcional → padrão**; multi-veículo → um por tipo; auto-filtro).
  **Extrator isolado/plugável**; heurísticas calibradas no Desbravador — outros PMSs podem exigir
  recalibração (validação com PDF real vive em `amostras/`, gitignored; hooks Playwright `[real]`).
- **REGRA DO PERÍODO** (v1.5.1.1, `hospedadoParaReserva`): a ocupação é o **período da hospedagem
  `entrada`→`saida`** (datas de 4 dígitos), **NUNCA** a data da última comanda diária; basta **≥1
  comanda de garagem** p/ ocupar até o fim da estadia (cobre o PMS não ter lançado a comanda de hoje);
  o **dia de check-out libera a vaga**.
- **Hospedado = objeto reserva-like** (`hospedadoParaReserva`, `ehHospedado:true`), alocado como
  **ocupante já presente** (confirmado, check-in no passado → entra primeiro). **Render próprio**
  (`.cell-span.hospedado`, cor `--hosped`, "🏠 Hospedado", legenda). **Arrastável e editável**
  reusando `ajustes` pela chave estável: arraste de vaga/overbooking; editor "🏠 Na garagem ↔ 🚗 Saiu
  (sem garagem)" (`sem_garagem` → área "Sem garagem (manual)", com **auditoria**, **persistência na
  reimportação** e **divergência** "comanda ainda mostra garagem"). Motos hospedadas seguem **não
  arrastáveis**.
- **Anti-duplicação** (`dedupeReservasHospedados`): mesmo **apto + período sobreposto** nos dois
  documentos → **vale o hospedado**; a instância de reserva não é desenhada (nem no mapa nem no
  Contato). Rede de segurança (o Doug passará a gerar o relatório de reservas sem "In Efetuado").
- **Migração NÃO destrutiva (DB v4→v5):** só o store `hospedados` foi criado; `ajustes` continua o
  mesmo (agora chaveado também por `nro` sintético de hospedado); demais stores intactos; **reimport
  de um slot não afeta o outro**.

## Comportamentos da v1.5.2 a preservar (correções visíveis)

- **Nome de reserva robusto** (`extrairNomes`): tenta o `indexOf('Hóspedes :')` EXATO primeiro
  (zero-regressão); senão cabeçalho tolerante **plural + ":"** (`/H[óÓoO]spedes\s*:/i` — **nunca** o
  singular "Hóspede"); senão heurística `nomeHeuristico` (1ª linha que pareça nome próprio). Nunca
  regride os casos que já funcionavam; reduz os "Hóspede".
- **Obs de indisponibilidade → "sem garagem"** (`obsIndicaSemGaragem`, pura, aplicada **só na obs**):
  frases explícitas ("SEM DISPONIBILIDADE DE GARAGEM/VAGA", "INFORMADO/CIENTE QUE NÃO TEM/HÁ …") →
  `semGaragemPDF` → `statusDerivadoDoPDF` = `sem_garagem` → sai do mapa p/ a relação "Sem garagem".
  **Nunca** marca quem afirma TER/COM garagem. **Ambíguo** → lança normal + **notifica** (painel
  `#avisos`). Rede de segurança: na dúvida, lança e avisa — nunca confunde com quem tem vaga.
- **Cores** amarelo (ouro `--amarelo`) × laranja (`--laranja`) **nitidamente distintas** + **ícone 👥**
  no bloco de Grupo/Múltiplos aptos (`.grupo-ico`) + legenda. Não trocar os hues sem manter contraste.
- **Aviso de overbooking com período** (`overbookingPeriodos`, pura): `#alert-over` mostra
  "⚠ Overbooking em {datas}" (faixas consecutivas viram intervalos "15/07–16/07").
- **Regra da pasta `amostras/`** (permanente): enquanto **vazia**, imprimir o **caminho absoluto**
  para o usuário largar os PDFs reais; validar contra eles quando presentes e **parar de imprimir** o
  caminho. `.pdf` gitignored (dados de hóspedes); hooks Playwright `[real]`.

## Comportamentos da v1.5.3 a preservar (ferramentas)

- **Motos = slots de vaga de CARRO** (`processarMotos`/`motoSlotPar`/`motoSlotSolo`): **2 motos = 1
  vaga P** (cross-reserva); ímpar sozinha com "vaga p/ +1 moto"; **sem seção Moto separada**
  (`vagaMoto` vazio). **Motos arrastáveis** para P/G/overbooking/extra; 2 motos fixadas na mesma vaga
  **pareiam ali** (`aplicarAjustes` agrupa motos por vaga). Datas nunca mudam.
- **Busca** (`matchBusca`, pura): nº/nome/apto/modelo, reservas+hospedados, parcial/case-insensitive;
  escurece o resto (`.busca-ativa`), contorna o atual (`.busca-atual`) + auto-scroll; contagem "N de
  M" + ‹ ›; limpar remove.
- **Vagas extras** (até 3, `EXTRA1/2/3`): sentinelas em `ajustes.vagaIdManual` (`placementExtra`,
  `placementValido`); `aplicarAjustes` → `resultado.extras` (não conta nas normais); seção aparece só
  com ≥1 em uso (`extrasEmUso`/`proximaExtraLivre`). Overbooking→extra oferecido no diálogo.
- **Reserva manual** (`reservasManuais`, DB **v5→v6**): form (nome/período/modelo obrigatórios;
  nº/apto opcionais); `validarReservaManual`/`montarReservaManual` (auditoria); entra na alocação;
  **não coube → oferece vaga extra**; **persiste ao reimportar**; **dedup "manter uma só"**
  (`dedupManuaisComPDF`/`manualJaNoPDF`: mesmo nº, ou sem nº apto+período+nome → reconcilia);
  removível; marcada com ✍️.
- **Edições manuais** (`montarEdicoesManuais`, pura): painel lista adições manuais + edições de status
  (funcionário/data/hora). Store `ajustes` só estendido (sentinelas EXTRA); demais stores intactos.

## Comportamentos da v1.5.4 a preservar (apresentação / interação)

> **SEM mudança de schema (segue DB v6).** Versão puramente visual/interativa: **a alocação e todos os
> dados/stores da v1.5.3 são preservados**. Nenhum store novo.

- **5.1 Amarelo derivado da bolinha "Aguardando":** o fundo do bloco amarelo usa o **mesmo matiz** de
  `--amarelo` (a cor do contador/legenda "Aguardando"), aplicado como `--amarelo-bg` — **não inventar
  hue** ("mostarda" é regressão). *(O ALPHA foi alinhado ao padrão do app na v1.5.6.1: `.18`/`.12`, o
  mesmo do azul/verde. A matiz continua a da bolinha.)*
- **5.2 Fim do laranja de grupo + "Carro 0N" no bloco:** a categoria visual **laranja** (cor de bloco,
  **bolinha/indicador**, **ícone 👥** e **legenda** de "Grupo/Múlt. aptos") foi **removida por completo**
  — a cor e a bolinha **seguem o STATUS REAL** do bloco. ⚠ **`laranja_*` continua existindo só como chave
  de ALOCAÇÃO** (confirmada, inalterada); a cor visível vem de **`garagemOrig`** (status real preservado
  antes da mutação). **NÃO** voltar a colorir bloco/bolinha de laranja. **"Carro 0N" vai DENTRO do bloco**
  (junto de nome / `#nº · Ap`), **só quando a mesma reserva tem >1 carro** (1 carro → sem rótulo);
  `mapaCarrosPorReserva` numera só CARROS (exclui motos/hospedados); status diferentes → cores diferentes.
- **5.3 Checkbox "Mostrar reservas editadas manualmente" + área ampliada** (`montarEditadasManuais`,
  pura): a área abaixo do overbooking lista, por reserva, **status manual**, **incluídas manualmente**
  (✍️ — **seguem no mapa**, re-editáveis) e **posição ajustada / vaga extra**. O checkbox só mostra/oculta;
  os overrides **persistem**.
- **5.4 "Vaga extra" no menu de status — SÓ em overbooking (via de acesso):** `statusEditorHTML(nro, st,
  {overbooking, extraLivre})` acrescenta "➕ Vaga extra (EXTRAn)" **apenas** para reserva em overbooking.
  **Alcançável mesmo sem nenhuma extra em uso** (nasce no menu de status, onde o usuário está); se as **3
  extras** estiverem ocupadas **no período**, aparece **desabilitada com a razão** (não some).
  **Escolher NÃO altera o status** — grava só o placement `EXTRAn` (+ auditoria), via `colocarEmVagaExtra`;
  **Confirmado mantém a mesma extra** (`extraSlotLivreParaSelf`), **"Sem garagem" libera**.
  `extraLivreNoPeriodo` = 1ª extra livre **no período** (não só a vazia).
- **5.5 Destaque persistente ao clicar** (`destaqueNro`/`definirDestaque`/`aplicarDestaqueClique`):
  contorno **sem escurecer** o mapa; **permanece após fechar o detalhe**; clicar outra reserva **move**
  (sempre uma só); **clique no vazio** (sem pan) **limpa**; **pan do fundo NÃO limpa**. Reaplicado a cada
  re-render.
- **Validação com PDF real EXECUTADA:** com os PDFs em `amostras/`, os hooks `[real]` rodam e passam —
  **Comandas real → 21 hospedados limpos** (encerra a pendência do parser de Comandas aberta na
  v1.5.1.1); **Reservas real** sem regressão. Hook `[real]` do Comandas usa **`expect.poll`** (não
  `waitForFunction(async …)`, que resolveria no Promise truthy e leria o store durante o rebuild).

## Comportamentos da v1.5.5 a preservar (amarelo + arraste + modal + fila de contato)

> **SEM mudança de schema (segue DB v6).** Sem backend, sem dependência nova, sem arquivo novo.

- **6.1 Amarelo sólido — ⚠ REVERTIDO NA v1.5.6.1.** A v1.5.5 fez `.cell-span.amarelo` usar
  `background:var(--amarelo)` **sólido** (a cor cheia da bolinha). Na prática o bloco ficou **opaco e
  puxando para laranja/tijolo**, e era o **único status fora do sistema de cores** do app. Ver a seção da
  **v1.5.6.1** abaixo — vale ela, não esta. O que **permanece** da v1.5.5: a matiz é a da bolinha
  (`--amarelo`, sem inventar hue) e **nenhum laranja**.
- **6.2 Arraste manual move SÓ a reserva arrastada — realocação global por arraste é PROIBIDA (regra
  permanente):** `aplicarAjustes(reservas, ajustes, layoutSeed)` tem um **3º parâmetro** — o **layout
  congelado** (`congelarLayout(aloc)`, `nro→vagaId`) atua como **soft-pin invisível** que segura cada
  reserva no lugar. Só o ajuste **manual** (store `ajustes`) marca `ajusteManual`/✋; o congelamento é
  transparente. `renderMapa` usa uma **assinatura** (`janela + conjunto de nros`): enquanto ela não muda
  (arraste, status, checkbox) o layout fica estável; **import e mudança de filtro trocam a assinatura →
  `layoutSeed=null` → a alocação automática roda fresca (importação INTACTA).** Destino livre → só a
  arrastada muda; destino ocupado → `confirmarMover` remove **só a(s) conflitante(s)** (`nrosConflitantes`)
  do congelamento p/ reacomodar; "Voltar ao automático" (`removerAjuste`) tira só a própria. ⚠ **Nunca**
  disparar compactação/otimização/re-encaixe global por causa de um arraste.
- **6.3 Modal do detalhe rola por dentro (nunca corta):** `.modal-card` é **flex-column com
  `max-height:92vh`**, `.modal-head` fixo, `.modal-body` com `overflow-y:auto`. O seletor de status aparece
  inteiro em janela baixa/mobile. Só a apresentação mudou.
- **6.4/6.8 Contato = FILA DE TRABALHO "Aguardando" (filtra por STATUS, nunca por flag):**
  `filaAguardando()` lista **exclusivamente** `_statusEfetivo==='aguardando'`. **Overbooking e vaga extra
  NÃO são status** → não excluem ninguém (viram só marca visual `.ct-flag`). Chips removidos. **Reativa**
  (muda o status → sai/entra na hora), **ordenada por chegada** (desempate estável por nº), **já contatado**
  marcado com data/hora via `envios` (sem store novo; reenvio não bloqueado), botão **"Abrir WhatsApp"
  desabilitado sem telefone**. Copiar nº, campo de telefone, mensagem da Gestão, preview/troca/edição e a
  janelinha de registro de envios — mantidos.
- **6.5/6.6 Telefone do documento (por presença) + prioridade do usuário:** `telefoneDoDocumento(texto)`
  captura por **rótulo com separador** (`Tel:`/`Cel:`/`WhatsApp:`…) **ou** `+DDI` explícito — nunca por
  formato fixo; **ausência = `''` silencioso** (Desbravador não traz). `semearTelefonesDoDocumento` grava no
  `contatos` **sem sobrescrever o telefone CONFIRMADO pelo usuário** (`telefoneStatus:'resolvido'` é sagrado);
  persiste e continua editável (`'documento'`). E-mail **não** implementado (parqueado).
- **6.7 PROIBIÇÃO PERMANENTE de assumir DDI:** `normalizePhone` **só limpa formatação**
  (`replace(/\D/g,'')`) — **NUNCA injeta `+55`** nem completa nada. O hotel recebe estrangeiros; o número já
  vem completo. `telefoneCurto` (< 10 dígitos) só **avisa** ("confira o código do país"), nunca bloqueia/corrige.

## Comportamentos da v1.5.6 a preservar (vaga extra hospedado + numeração fixa + anti-duplicata)

> **SEM mudança de schema (segue DB v6). Sem store novo.** Migração não-destrutiva.

- **6.1 Vaga extra é POSIÇÃO, não status — vale para overbooking HOSPEDADO ou a chegar:**
  `statusEditorHospedadoHTML(nro, st, ctx)` oferece "➕ Vaga extra (EXTRAn)" quando `ctx.overbooking`
  (mantendo "Na garagem"/"Saiu"). No detalhe, `emOver=!!res._over` (⚠ **sem** `!ehH`). Mover para a extra
  usa `colocarEmVagaExtra` (por `nro`) e **NÃO altera o status** (hospedado segue "Na garagem"). **Fora de
  overbooking a opção não existe.**
- **6.2 Numeração das vagas é FIXA de cima para baixo; o filtro só reordena as reservas:** o RÓTULO segue
  a **posição visual** (`P1` sempre no topo); `aplicarOrdemLinhas` só reordena o conteúdo. O `data-vaga`
  (alvo de drop / id de alocação / congelamento) **permanece o id da vaga** — drag/persistência/freeze
  intactos. `mapaVagaLabel` (id de alocação → rótulo visível) alimenta o tooltip ✋ e o modal "mover".
  ⚠ **NÃO** voltar a amarrar o número à ordem de renderização.
- **6.3 Conferência anti-duplicata: SINALIZA, NUNCA apaga.** `detectarDuplicatas` (puro): gatilho =
  **`nro`+`apto`+`vagaIdx` repetido** (a mesma reserva/carro) **ou** **`nroOTA` sob ≥2 `nros` distintos**.
  **Multi-carro, multi-apto e homônimos NÃO alertam**; hospedados e `nro` `AUTO*` ficam de fora. Selo `⧉`
  nos **dois** blocos; clicar **isola** o par (reusa o padrão da busca: `dup-isolando`/`dup-foco`); clicar
  no fundo volta ao normal; `✕` **dispensa nos dois**. A **dispensa NÃO é permanente**
  (`duplicatasDispensadas` = Set limpo a cada importação): se o relatório reproduzir o par, o alerta
  **reaparece** — esconder de vez mascararia erro do PMS/app. **O app nunca exclui uma reserva sozinho.**
- **Princípio permanente:** na dúvida, **sinalizar e devolver a decisão ao usuário** — nunca "resolver
  sozinho" o ambíguo (vale p/ documento antigo recusado, garagem duvidosa sinalizada, PMS desconhecido
  recusado e, agora, a conferência de duplicata).

## Comportamentos da v1.5.6.1 a preservar (amarelo claro e translúcido)

> **Correção puramente VISUAL. Sem schema (segue DB v6), sem store, sem lógica, sem layout, sem
> dependência, sem arquivo novo.** Nada além de CSS mudou no app.

- **7.1 RECEITA ÚNICA DE BLOCO DE STATUS (regra permanente):** todo bloco do mapa é
  **fundo TRANSLÚCIDO da matiz (`--X-bg`) + borda `1.5px solid` da matiz (`--X`) + nome na matiz
  (`--nome-X`)**. O amarelo **não é exceção**:
  `.cell-span.amarelo{background:var(--amarelo-bg);border:1.5px solid var(--amarelo)}` — **literalmente
  a mesma estrutura** de `.cell-span.azul` e `.cell-span.hospedado`, só trocando a matiz.
  ⚠ **NUNCA** pintar um bloco de status com a cor **cheia/sólida** (`background:var(--amarelo)`): foi
  exatamente isso que fez o "Aguardando" ler como **laranja/tijolo** na v1.5.5.
- **7.2 Mesmo ALPHA de fundo em todos os status:** `--amarelo-bg` usa o alpha **padrão do app** —
  **`.18` no tema escuro** e **`.12` no claro** — idêntico a `--azul-bg`/`--hosped-bg`/`--vermelho-bg`/
  `--moto-bg`. ⚠ Alpha diferente = o amarelo volta a destoar. A matiz (RGB) continua sendo **a mesma da
  bolinha `--amarelo`** (`#eab308` escuro / `#ca8a04` claro) — regra da v1.5.4, mantida.
- **7.3 Texto do bloco = `--nome-amarelo`, o par de `--nome-azul`/`--nome-hosped`.** ⚠ **Critério real do
  app (registrar para não se perder):** azul e verde **não** usam "texto escuro" — usam **um tom da própria
  matiz**, que é **claro no tema escuro** (`#93c5fd`, `#5eead4`, `#fde047`) e **escuro no tema claro**
  (`#1d4ed8`, `#0f766e`, `#854d0e`), porque no tema escuro o vidro fica sobre fundo quase preto. Texto
  escuro no tema escuro **reprova no contraste**. `.cell-info` **não** tem override nenhum (herda
  `--muted`, como no azul/hospedado). **`--sobre-amarelo` foi REMOVIDO** — existia só para o fill sólido;
  não recriar.
- **7.4 Destaque/isolamento continua GENÉRICO:** `busca-ativa`/`dup-isolando` aplicam `opacity`+`grayscale`
  a **qualquer** `.cell-span`. Como o amarelo voltou à receita comum, ele escurece igual ao azul/verde.
  **Não criar exceção por cor.**
- **7.5 Vale para TODAS as variações** do bloco (pequeno, `cortado-esq`, "Carro 01/02"): o hook é único
  (`.cell-span.amarelo`, atribuído por `corCls`), então basta a regra base. `.ct-item.amarelo` (aba
  Contato) segue sendo só `border-left-color` — não é bloco de mapa, não muda.
- **Coerência com a legenda:** a legenda "Aguardando" **já** desenhava `--amarelo-bg` + borda `--amarelo`;
  na v1.5.5 ela discordava do bloco real. Agora legenda e mapa mostram a mesma coisa — se um dia
  divergirem de novo, é sinal de regressão.

## Comportamentos da v1.5.7 a preservar (carros, arraste, limpar, feriados)

> **SEM mudança de schema (segue DB v6), sem store novo, sem dependência nova, sem arquivo novo.**

- **7.1 CARROS DE UMA RESERVA = O TOTAL DA RESERVA — nunca multiplicado por apartamento (regra
  permanente).** O PMS escreve de duas formas e elas **significam coisas diferentes**:
  - `GARAGEM 0N CARRO(S)` = declaração **POR APARTAMENTO** → **soma** entre os blocos
    (#26161 Henrides: apto 129 = 1 + apto 130 = 2 = **3 vagas** — não pode regredir);
  - `TOTAL 0N CARROS` = **TOTAL DA RESERVA** → **NUNCA** multiplica pelo nº de apartamentos;
  - `TOTAL X APARTAMENTOS E Y CARROS` segue **ignorado** (v1.0.0).
  ⚠ O bug da v1.5.6.1 e anteriores era decidir a quantidade **dentro do laço por bloco** do parser: a
  #26389 (5 aptos, "GARAGEM TOTAL 04 CARROS") virava **5 × 4 = 20 carros**. A expansão agora acontece
  **uma vez por reserva** (`expandirCarrosDaReserva`), depois do laço. **NÃO** voltar a expandir por bloco.
  Com 5 aptos e total 04, **4 apartamentos ficam com carro e 1 fica sem** (`distribuirCarrosPorApto`,
  round-robin) — **o app NÃO decide qual apartamento fica sem**; isso é resolvido no check-in.
  `repartirTiposCarro` lê `"(03 PEQUENOS E 01 GRANDE)"` e **só vale se a soma bater com o total**;
  senão, todos os carros usam o tipo já classificado. **Reserva multi-apartamento é LEGÍTIMA** e
  continua não sendo duplicata (regra da v1.5.6).
- **7.2 A CHAVE DO AJUSTE É O CARRO, NÃO A RESERVA (regra permanente).** `ajustes` passou a ser chaveado
  por `chaveCarro(res)` = `nro__apto__vagaIdx`. ⚠ **O store `ajustes`, o keyPath (`nro`) e o DB (v6) NÃO
  mudaram** — muda só o **valor** gravado nesse campo; é a mesma engenharia da chave sintética do
  hospedado (v1.5.1), cujo `id` já é o `nro`. **`resolverAjuste(res, ajustes)` é o único jeito certo de
  ler um ajuste**: acha o registro do carro e, se não houver, cai no **legado por nº de reserva** (≤ v1.5.6.1),
  válido para o 1º carro — **nada foi apagado e não houve migração**. `congelarLayout`, `assinaturaLayout`,
  `chavesConflitantes` e o placement de `aplicarAjustes` são **todos por carro**. Arrastar/editar um carro
  **não toca nos outros carros da reserva**; a regra da v1.5.5 (destino livre não reacomoda ninguém;
  destino ocupado reacomoda só o conflitante) segue valendo, agora na granularidade certa. Vale p/ vaga,
  overbooking, vaga extra e motos. `carrosDaChave(k)` resolve os dois usos: **chave de carro** (detalhe do
  mapa) → aquele carro; **nº da reserva** (Contato, área "Editadas") → todos os carros da reserva.
  `span.dataset.chave` expõe a identidade do carro no DOM (`data-nro` repete entre carros).
- **7.3 "Carro X de N": N = carros que AINDA TÊM GARAGEM.** `mapaCarrosPorReserva(reservas, ajustes)` —
  com o 2º parâmetro, exclui os `sem_garagem`. Dar baixa em 2 de 5 carros reindexa os 3 restantes **na
  hora** ("1 de 3", "2 de 3", "3 de 3"). Ordem de desempate inalterada (`vagaIdx` → `apto` → `id`), para a
  numeração não dançar.
- **7.4 Botão "Limpar informações" (Gestão › Manutenção).** Apaga **todos** os dados de reserva —
  `reservas`, `hospedados`, `ajustes`, `reservasManuais`, **`contatos` (telefones digitados)** e
  **`envios` (histórico de contato)** — e **PRESERVA `gestao`** (empresa, funcionários, modelos).
  **Confirmação obrigatória** em modal que diz que é **irreversível** e que telefones e envios também somem.
  Fica no fim da Gestão, em card próprio, para não ser clicado por acidente. ⚠ **Isto NÃO é migração:** é
  ação deliberada do usuário. A regra de **migração não-destrutiva** (`onupgradeneeded` nunca apaga nada)
  continua valendo e não foi tocada. Depois de limpar, o app volta ao estado vazio **sem quebrar** e
  importar de novo funciona.
- **7.5 FERIADOS NACIONAIS SÃO CALCULADOS PELO APP — não há cadastro.** `pascoa(ano)` (Meeus/Butcher) +
  `feriadosNacionais(ano)` = **9 fixos** (01/01, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 20/11, 25/12)
  + **4 móveis** derivados da Páscoa (Carnaval −48/−47, Sexta-feira Santa −2, Corpus Christi +60).
  `ehFeriado(data)` recalcula por ano sob demanda (cache em memória): funciona offline e **nunca envelhece**.
  ⚠ **NÃO criar tela/cadastro de feriado.** Municipais (Balneário Camboriú) ficam **fora**; quando as datas
  vierem, entram como **lista embutida** aqui, nunca como cadastro.
- **7.6 Realce de fim de semana e feriado = FUNDO DE COLUNA, subordinado aos blocos.** `realceDoDia(data)`
  → `'feriado'` | `'fds'` | `''`, com **feriado PREVALECENDO** sobre fim de semana. Aplicado por `mkRow`
  (nas `.cell`, **atrás** dos blocos) e por `mkDatesRow` (no cabeçalho), **seguindo a DATA da coluna, nunca a
  posição**. ⚠ **Alpha muito menor que o de qualquer status**: `--fds-bg` .06/.07 e `--feriado-bg` .07,
  contra .18/.12 dos blocos — e o realce **não tem borda**, enquanto todo bloco tem borda sólida por cima.
  É assim que o "Aguardando" (amarelo) continua claramente legível sobre uma coluna de fim de semana e o
  hospedado (teal) não se confunde com o verde do feriado. O tom é composto sobre `--cell-livre`
  (`linear-gradient` de uma cor só) para valer **também atrás das células ocupadas**.
  ⚠ **NÃO alterar nenhuma cor de bloco por causa disto** — em especial, **o tom do amarelo "Aguardando"
  não muda** (decisão do Doug; a receita da v1.5.6.1 segue intacta).

## Versão atual

**v1.5.7** — **total de carros correto (fim da explosão) + arraste por carro + "X de N" recomputando +
botão Limpar + realce de fim de semana/feriado calculado** (sem schema, DB v6; sem store novo). Carros =
total da reserva (#26389: 4, não 20), com `GARAGEM 0N` por apto ainda somando (#26161 = 3); `ajustes`
chaveado por carro (`chaveCarro`/`resolverAjuste`, com fallback legado); N conta só quem tem garagem;
Limpar zera os dados de reserva preservando a Gestão; feriados nacionais calculados (fixos + móveis via
Páscoa), sem cadastro; realce de coluna que não confunde com os status. Testes **449/449** (293 engine +
100 jsdom + 56 Playwright), sem `skip`; hooks `[real]` verdes + **comparação parser antigo × novo no PDF
real: 101 = 101, conjuntos idênticos**. Ver `RELATORIO-v1.5.7.md`.

**v1.5.6.1** — **amarelo claro e translúcido, no mesmo estilo do azul e do verde** (correção visual sobre
o patch; sem schema, sem lógica, sem layout). `.cell-span.amarelo` deixou o fill sólido da v1.5.5 e voltou
à receita única do app (fundo `--amarelo-bg` no alpha padrão `.18`/`.12` + borda sólida `--amarelo` + nome
`--nome-amarelo`); `--sobre-amarelo` removido. Azul, verde, vermelho e roxo intactos; nenhum laranja.
Testes **406/406** (264 engine + 91 jsdom + 51 Playwright), sem `skip`; hooks `[real]` verdes. Ver
`RELATORIO-v1.5.6.1.md`.

**v1.5.6** — **vaga extra p/ hospedado em overbooking + numeração de vagas fixa + conferência
anti-duplicata (sinaliza, não apaga)** (sem schema, DB v6; sem store novo). Testes **387/387** (253 engine
+ 88 jsdom + 46 Playwright), sem `skip`; hooks `[real]` verdes (0 falso-positivo de duplicata no relatório
real). Ver `RELATORIO-v1.5.6.md`.

**v1.5.5** — **amarelo = cor da bolinha + arraste move só a arrastada + seletor de status inteiro + Contato
como fila de trabalho** (sem schema, DB v6). Amarelo sólido (fim do mostarda); **congelamento de layout** faz
o arraste manual mover só a reserva arrastada (import automático intacto); modal do detalhe rola sem cortar;
Contato lista **só Aguardando** (por status, flags não excluem), reativo, ordenado por chegada, com marca de
já contatado e "Abrir WhatsApp" por linha; telefone capturado do documento por presença, persistente, com
**prioridade do usuário**; **nenhum DDI assumido**. Testes **372/372** (245 engine + 83 jsdom + 44 Playwright),
sem `skip`. Ver `RELATORIO-v1.5.5.md`.

**v1.5.4** — **apresentação / interação** (sem schema, DB v6): amarelo derivado da bolinha "Aguardando",
**laranja de grupo removido por completo** (cor/bolinha/legenda/👥) com a cor seguindo o status real,
**"Carro 0N" dentro do bloco**, checkbox "Mostrar reservas editadas manualmente" + área ampliada, **"Vaga
extra" no menu de status só em overbooking** (via de acesso garantida, escolher não muda o status), e
**destaque persistente ao clicar**. Alocação e dados da v1.5.3 preservados. Testes **348/348** (235 engine
+ 73 jsdom + 40 Playwright) com os **2 hooks `[real]` agora rodando e verdes** (Comandas real → 21
hospedados; Reservas real sem regressão). Ver `RELATORIO-v1.5.4.md`.

**v1.5.3** — **ferramentas**: motos editáveis (2=1 vaga de carro), busca com destaque, vagas extras
(até 3) + overbooking→extra, adicionar reserva manual (encaixe + oferta de vaga extra + dedup "manter
uma só"), painel de edições manuais. Migração não-destrutiva **DB v5→v6** (`reservasManuais`). Testes
**325/325** (217 engine + 73 jsdom + 35 Playwright) + 2 hooks `[real]` + exercício com o PDF real. Ver
`RELATORIO-v1.5.3.md`.

**v1.5.2** — **correções visíveis**: nomes de reservas (menos "Hóspede"), obs de indisponibilidade →
"sem garagem" (com rede de segurança/notificação), amarelo × laranja distintos + ícone de grupo, aviso
de overbooking com período. Sem mudança de schema (DB **v5**). Testes **291/291** (198 engine + 63
jsdom + 30 Playwright) + 2 hooks `[real]` (pendentes de amostras) + exercício com o PDF real. Ver
`RELATORIO-v1.5.2.md`.

**v1.5.1.1** — **correção do parser do Comandas** (a v1.5.1 quebrava com o PDF real: esperava linha
única; o PDF.js entrega os campos em linhas separadas / outra ordem → 0 hóspedes → validação recusava).
`parsearComandas` reescrita **por regiões/estado** (independente de ordem; entrada/saída por ano de 4
dígitos; canal entre Extras/Taxas; veículo nas linhas GARAGEM) + **regra do período explícita**
(ocupação = entrada→saida; não usa a comanda diária; check-out libera). Validação aceita ≥1 hospedado.
Sem mudança de schema (DB **v5**). Testes **265/265** (181 engine + 57 jsdom + 27 Playwright) + 2 hooks
`[real]` prontos (pendentes das amostras em `amostras/`) + exercício com o PDF real de Reservas (37,
sem regressão). Ver `RELATORIO-v1.5.1.1.md`.

**v1.5.1** — 2º documento (Comandas / Hospedados): dois slots com emissão, validação por informação,
bloqueio de documento mais antigo, store `hospedados` (DB v4→v5), hospedados alocados/renderizados como
ocupantes de prioridade máxima e **arrastáveis/editáveis** (remoção → "Sem garagem (manual)"),
anti-duplicação entre os documentos. Ver `RELATORIO-v1.5.1.md`.

**Próximos passos** (adiados, ver `PLANEJAMENTO.md`): **calibrar a extração para outros PMSs** (quando
houver amostras reais); confirmação real de entrega + envio em massa (backend + WhatsApp Business API);
integração Reserva → Garage Spot.
