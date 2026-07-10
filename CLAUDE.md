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
- **Múltiplos carros / TOTAL CARROS**: "GARAGEM 0X CARROS" e "TOTAL X CARROS" geram N vagas;
  "TOTAL X APARTAMENTOS E Y CARROS" é **ignorado**. Validado (#26161 Henrides: apto 129=1 +
  apto 130=2 = 3 vagas).
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

## Versão atual

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
