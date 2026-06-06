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
- **IndexedDB** (`garagemGumz`, **v4**): stores **`reservas`** (keyPath `id`, escrito **só** pela
  importação de PDF), **`contatos`** (keyPath `nro`, só a ferramenta de contato), **`gestao`**
  (singleton `id:"config"`, v1.2.0), **`ajustes`** (keyPath `nro`, edição manual, v1.3.0) e
  **`envios`** (keyPath `id` autoincrement + índice `nro`, histórico de envios, v1.4.0 — só o
  disparo do `wa.me` escreve). Essa separação é o que torna a mesclagem **não-destrutiva** trivial:
  importar PDF nunca toca em telefones/ajustes/envios.
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

## Versão atual

**v1.4.0** — Contato (seleção por toda a reserva, status **enviado** derivado + histórico/prancheta) +
detalhe (copiar nº PMS/OTA, prancheta) + **pan vertical** no mapa + **`[nome]` em formato de nome
próprio**. Store `envios` (DB v4, não-destrutivo). Tudo de v1.1/1.2/1.3 **inalterado** (alocação
automática, arraste de mover vaga, selo de gravação). Testes 188/188 (128 engine + 40 jsdom + 20
Playwright). Ver `RELATORIO-v1.4.0.md`.

**Roadmap local (sem backend) concluído.** Próximos passos exigem infraestrutura: **confirmação real de
entrega** + envio em massa (backend + WhatsApp Business API) e integração Reserva → Garage Spot. Ver
`PLANEJAMENTO.md`.
