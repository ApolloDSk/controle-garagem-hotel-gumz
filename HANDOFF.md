# HANDOFF — Reserva de Garagem do Hotel Gumz

> Documento de contexto para o próximo chat começar correto. Ler junto com `CLAUDE.md`,
> `PLANEJAMENTO.md` e o `RELATORIO-*` mais recente. A memória vive **nos arquivos**, não na conversa.

## Estado atual
- **Versão entregue: v1.4.0** (06/06/2026). Repo único: `ApolloDSk/controle-garagem-hotel-gumz`
  (branch `master`). ⚠ **Nunca** tocar nos repos do **Garage Spot** (`garagespot-*`) — outro projeto.
- App canônico: `garagem-app/index.html`; standalone (Chrome): `garagem-app/controle-garagem-standalone.html`
  (regenerar com `node build-standalone.js` em `garagem-app/` sempre que mexer no `index.html`).
- Stack: HTML/JS/CSS puro + PDF.js + IndexedDB (DB `garagemGumz` **v4**: stores `reservas`,
  `contatos`, `gestao`, `ajustes`, **`envios`**). Sem backend, sem APK.
- **Roadmap local (sem backend) CONCLUÍDO** (v1.0.0 → v1.4.0). O que falta exige infraestrutura.

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
6. **Escopo:** carros (P/G). **Motos e overbooking não são arrastáveis** (adiado).

## v1.1.0 / v1.2.0 (mantidos)
Abas Mapa/Contato/Gestão com ícones; copiar PMS/OTA; telefone Confirmar↔Editar; ordenação das
vagas; info de upload; check-in no passado (borda cortada). Gestão (Empresa/Funcionários/Modelos/
Backup); Modelos com chaves `[nome][data][canal][empresa][funcionario]` (substituição real);
envio com preview/troca/editar; Backup export/import (Mesclar/Substituir).

## Testes (versionados em `tests/`) — 188/188
- `npm install` (jsdom, fake-indexeddb, @playwright/test) + `npx playwright install chromium`.
- `npm run test:engine` (128) · `npm run test:integration` (40) · `npx playwright test` (20).
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
- Substituição de chaves nunca deixa literal (v1.2.0); limitação de caminho do navegador (v1.1.0);
  check-in no passado só aparece se constar no PDF.
- Alocação automática (amarelos/azuis/score/best-fit/overbooking) é **intocável**.

## Próximos passos (exigem infraestrutura)
- **Confirmação real de entrega da mensagem** (entregue/lida): exige WhatsApp Business API/backend.
- **Envio em massa via WhatsApp:** backend Node.js + WhatsApp Business API (Meta), templates
  aprovados; a lógica de mensagem (`substituirChaves`/modelos) já é reutilizável.
- **Integração Reserva → Garage Spot:** camada compartilhada; passo leve via export/import
  (Backup da v1.2.0 é base; chave = `nro`).
- **Adiados:** motos/overbooking arrastáveis; mapeamento de `[canal]`; múltiplas empresas;
  modelo p/ confirmadas/azuis.

## Tags
- `pre-v1.0.0`, `v1.0.0`, `pre-v1.1.0`, `v1.1.0`, `pre-v1.2.0`, `v1.2.0`, `pre-v1.3.0`, `v1.3.0`,
  `pre-v1.4.0`, `v1.4.0`.
