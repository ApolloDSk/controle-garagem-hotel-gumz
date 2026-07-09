# PLANEJAMENTO.md — Reserva de Garagem do Hotel Gumz

> Roadmap em **3 níveis**. Manter sempre atualizado ao fim de cada versão.
> Versão atual: **v1.5.1.1** (entregue) · **Roadmap local sem backend CONCLUÍDO.** Próximos passos exigem infraestrutura (ou amostras de outros PMSs).

---

## ✅ DECIDIDO E EM EXECUÇÃO

### v1.0.0 (atual) — Fundação
- **Lógica de vagas correta:**
  - Amarelos (a verificar) usam **pequeno E grande** (bug corrigido — antes presos no pequeno).
  - **Encaixe inteligente:** reservas curtas preenchem buracos entre as longas (best-fit).
  - **Score de prioridade** (período + canal; Booking por último; confirmado > amarelo).
  - **Overbooking protege confirmados:** amarelos de menor prioridade vão primeiro; azuis nunca.
  - **Sinaliza carro grande em vaga pequena** (borda tracejada + tooltip).
- **Persistência IndexedDB** com **mesclagem não-destrutiva** (telefones/ajustes preservados;
  reserva sumida do PDF é arquivada, não apagada); **fallback** em memória; consulta de
  qualquer período já importado sem reimportar.
- **Ferramenta de contato (base):** aba Contato; filtros Todos/Confirmados (pequeno+grande)/
  Verificando/Overbooking; lista com nº PMS + nº OTA + nome + datas; campo de telefone com
  status "resolvido" (editável, persistido); **envio individual via `wa.me`** com 2 modelos
  de mensagem personalizados (nome + datas).
- **Versão na tela** (`APP_VERSION` no rodapé) + documentação (CLAUDE/PLANEJAMENTO/RELATORIO).

### v1.1.0 (entregue 05/06/2026) — UX + check-in no passado
- **Abas:** "Mapa de Reservas" (ícone calendário) + "Contato" (ícone WhatsApp).
- **Copiar nº PMS e OTA ao clicar** (clipboard + fallback `file://`), com feedback "Copiado!".
- **Telefone Confirmar↔Editar** (bloqueia/desbloqueia o campo; valor persistido inalterado).
- **Filtro de ordenação das vagas** (cima↔baixo) com preferência persistida; alocação intacta.
- **Info de data/hora do upload** + nome do arquivo ao clicar (limitação de caminho documentada).
- **Check-in no passado:** hóspedes ainda hospedados aparecem com **borda esquerda cortada**.
- Harness de testes versionado em `tests/` (98/98). Ver `RELATORIO-v1.1.0.md`.

### v1.2.0 (entregue 05/06/2026) — Gestão + Modelos de Mensagens + Backup
- **Aba Gestão:** Empresa (`[empresa]`), Funcionários (lista dinâmica + padrão único → `[funcionario]`),
  Modelos de Mensagens, Backup/Restauração. Store `gestao` (DB v2, migração não-destrutiva).
- **Modelos** por status (verificando/overbooking), até 3 cada, numeração 1/2/3 + padrão por
  categoria; chaves `[nome] [data] [canal] [empresa] [funcionario]` com **substituição real**
  (nunca literal), **autocomplete + chips**, **legenda + botão "?"**.
- **Envio:** preview substituído → trocar modelo 1/2/3 → **Editar só o envio** (não altera o modelo)
  → `wa.me`. Mapeamento amarelo→verificando, vermelho→overbooking; azul fora.
- **Backup:** export (dump de stores) + import Mesclar (não-destrutivo) / Substituir (confirmação).
- Testes 140/140. Ver `RELATORIO-v1.2.0.md`.

### v1.3.0 (entregue 05/06/2026) — Edição manual (mover de vaga; data proibida)
- Arraste **só de vaga** (Pointer Events + ghost + **limiar 5px**; clique abaixo do limiar abre o
  detalhe); **data nunca muda** pelo app. Vaga alvo por `data-vaga` (funciona com ordenação invertida).
- Confirmação obrigatória + aviso de **conflito não-destrutivo**; marcador **✋** + "Voltar ao
  automático". Store `ajustes` (DB v3, chave `nro`), sobrevive à reimportação do PDF.
- Escopo: **carros (P/G)**; motos/overbooking fora. Testes 162/162. Ver `RELATORIO-v1.3.0.md`.

### v1.4.0 (entregue 06/06/2026) — Contato + histórico de envios + pan vertical + `[nome]` formatado
- **`[nome]` em formato de nome próprio** (`formatarNomeProprio`: Title Case; conectores
  `de/da/do/dos/das/e` minúsculos; acentos; hífen) — só na **saída** da chave (não altera o dado).
- **Contato:** clicar em **qualquer parte da reserva** seleciona; controles internos com `stopPropagation`.
- **Status "enviado"** (renomeado de "resolvido"), **derivado do histórico** (`statusEnvioReserva`);
  **digitar telefone não marca**; registro nasce no **disparo do `wa.me`** (`registrarEnvio`).
  ⚠ "enviado" = **envio disparado**, não entrega confirmada (entrega real exige WhatsApp Business API).
- **Store `envios`** (DB **v4**, `id` autoincrement + índice `nro`): histórico por hospedagem; só o
  envio escreve; **reimport não apaga**. **Prancheta** (canto inferior direito) no **Contato** (reserva
  selecionada) e no **detalhe** do Mapa, com data/hora/funcionário, estado vazio amigável.
- **Detalhe:** copiar **nº PMS e OTA** ao clicar (fallback `file://`).
- **Mapa:** **pan vertical e horizontal** no fundo; arraste de **bloco** = mover vaga (v1.3.0) inalterado.
- Testes **188/188** (128 engine + 40 jsdom + 20 Playwright); flakiness pré-existente do harness
  corrigida na raiz (`window.__appReady`). Ver `RELATORIO-v1.4.0.md`.

### v1.5.0 (entregue 07/07/2026) — status manual editável + arraste no overbooking
- **Parte A — status manual editável** (Confirmado/Aguardando/**Sem garagem**) no **detalhe** e no
  **Contato**, com **auditoria** (funcionário-texto + data/hora). `statusEfetivo` injetado na
  alocação; **"Sem garagem" tira do mapa** e vai para a **área "Sem garagem (manual)"** (checkbox,
  cor distinta, abaixo do overbooking) com status **re-editável** (volta ao mapa).
- **Sinalização de divergência com o PMS** (`pmsDivergente`): override manual ≠ status do PDF →
  badge + marcador ◆ + tooltip (quem/quando). Ajuste manual **preservado** na reimportação.
- **Parte D — arraste para dentro/fora do overbooking** (sentinela `"OVERBOOKING"` em `vagaIdManual`):
  **visual/organização — NÃO muda status nem PMS**; mover para overbooking **libera a vaga** e os
  automáticos **realocam**. Datas nunca mudam. Motos **continuam não arrastáveis**.
- Store **`ajustes` estendido** (DB **segue v4**, não-destrutivo; registros antigos válidos).
  **Versionamento 1.5.x** registrado (sem 2.0 sem ordem). Testes **212/212** (141 engine + 47 jsdom
  + 24 Playwright). Ver `RELATORIO-v1.5.0.md`.

### v1.5.1 (entregue 08/07/2026) — 2º documento (Comandas / Hospedados)
- **Dois slots** (Reservas / Hospedados) com **emissão** do documento sempre visível; parse pelo
  conteúdo. **Validação por presença de informação** (gera com a info em qualquer formato/PMS;
  recusa+avisa sem a info). **Bloqueio de documento mais antigo** (emissão via `CreationDate` +
  reforço impresso) mantendo o atual.
- **Parser do Comandas** (`parsearComandas`): apto/nome/período/canal(opcional); veículo pelo PDV
  GARAGEM (CARRO→P, CAMIONETE→G, MOTO→moto); **tamanho opcional → padrão**; auto-filtro; multi-veículo.
- **Hospedados** (store `hospedados`, DB **v4→v5**) alocados como **ocupantes de prioridade máxima**,
  com **render próprio** (🏠), **arrastáveis e editáveis** (remoção → área "Sem garagem (manual)" com
  auditoria/persistência/divergência) reusando o `ajustes` pela **chave estável**. **Anti-duplicação**
  entre os dois documentos (hospedado prevalece).
- Migração não-destrutiva; reimport de um slot não afeta o outro. Testes **256/256** (173 engine + 56
  jsdom + 27 Playwright) + exercício de ponta a ponta com o **PDF real**. Ver `RELATORIO-v1.5.1.md`.

### v1.5.1.1 (entregue 09/07/2026) — correção do parser do Comandas (ordem de leitura real)
- **Bug:** a `parsearComandas` da v1.5.1 esperava o bloco do hóspede em **linha única**; no PDF real
  (PDF.js, ordem de leitura) os campos vêm em **linhas separadas/outra ordem** → 0 hóspedes → o app
  recusava o Comandas real ("informações não conferem").
- **Correção:** parser **por regiões/estado**, independente de ordem (início `<apto> <NOME>`; entrada/
  saída pelas 2 primeiras datas de **ano 4 dígitos**, ignorando as diárias de 2 dígitos; canal entre
  Extras/Taxas; veículo nas linhas GARAGEM do corpo). **Regra do período explícita** (ocupação =
  entrada→saida; basta ≥1 comanda de garagem; check-out libera). Validação aceita ≥1 hospedado.
- Sem mudança de schema. Testes **265/265** (181 engine + 57 jsdom + 27 Playwright) + 2 hooks `[real]`
  (pendentes das amostras em `amostras/`, gitignored). Ver `RELATORIO-v1.5.1.1.md`.

---

## ✅ ROADMAP LOCAL (sem backend) — CONCLUÍDO

Toda a evolução possível sem servidor foi entregue (v1.0.0 → v1.3.0). Os próximos passos exigem
infraestrutura.

## 🔜 PRÓXIMOS PASSOS (exigem infraestrutura)

### Envio em massa via WhatsApp (premium pago)
- Backend Node.js + **WhatsApp Business API oficial (Meta)** com templates aprovados; conta/custo
  do cliente. A função de mensagem (`substituirChaves`/modelos da v1.2.0) já é reutilizável.

### Integração Reserva → Garage Spot
- Idealmente camada de dados compartilhada; possível **primeiro passo leve** via exportação/
  importação de arquivo (o Backup da v1.2.0 já é uma base; chave de integração = `nro`).

## 🕓 ADIADOS ("vamos ver depois")
- **Calibrar a extração do Comandas para outros PMSs** — as heurísticas do `parsearComandas` foram
  calibradas na única amostra disponível (Desbravador). Quando houver documentos reais de outro PMS,
  ajustar o extrator (isolado/plugável). Refinamento de multi-veículo também aqui.
- **Confirmação real de entrega da mensagem** (entregue/lida) — exige **WhatsApp Business API/backend**.
  O status "enviado" (v1.4.0) só garante que o `wa.me` foi **disparado** pelo app.
- **Motos arrastáveis** (v1.5.0/v1.5.1: overbooking arrastável e hospedados arrastáveis; motos seguem fora).
- **Hospedados na aba Contato** (hoje só no mapa; Contato é ferramenta de telefonema para reservas).
- **(Opção) Arraste manual "posicional"** — fixar a reserva na posição solta **sem realocar** os
  automáticos (hoje mover libera a vaga e os automáticos se reorganizam), se o Douglas preferir.
- Mapeamento do **nome do canal** para `[canal]` (expedia.com / hoteis.com / omnibees).
- Suporte a **mais de uma empresa**.
- **Modelo de mensagem para reservas confirmadas/azuis** (hoje azul usa link `wa.me` simples).

### Envio em massa via WhatsApp (premium pago)
- Exige **backend Node.js**. Usar **WhatsApp Business API oficial (Meta)** com **templates
  pré-aprovados**; conta da empresa cliente (ela paga a Meta — ~R$0,40–0,80 por conversa
  iniciada pela empresa). **Não usar biblioteca não-oficial** (risco de ban — inaceitável).
- Modelo de negócio: o **controle** (com envio individual `wa.me` gratuito) é o núcleo
  vendável; o **envio em massa** é função **opcional premium**.
- Detalhe: chatbot (cliente inicia) usa janela de 24h gratuita; envio em massa (empresa
  inicia) é pago → por isso é premium. A função `gerarMensagem(dados, template)` da v1.0.0 já
  é reutilizável — o backend futuro usa a mesma lógica.

### Integração Reserva → Garage Spot
- Este app envia ao Garage Spot as reservas de garagem com **data de entrada E saída**, para o
  Garage Spot exibir previsão de chegadas e saídas (quantidades, com subtítulo pequeno/grande).
- **Filtro limitado a ~1 mês** (hoje + 30 dias) por otimização — o gestor de manobristas só
  precisa de curto prazo. Os dados deste app já são estruturados/exportáveis (chave = `nro`).

### App unificado (3º app)
- Junção de Reserva de Garagem + Garage Spot, vendável em pacotes (só reserva / só Garage Spot /
  pacote completo do ciclo: reserva → chegada → vistoria → movimentação → saída). Exige camada
  de dados compartilhada (servidor/nuvem) — planejamento dedicado quando os dois apps amadurecerem.

---

## 🔮 EM ESTUDO / A REVISAR (ideias com perguntas em aberto)

- **Chatbot do hotel (vendável a outros setores):** atende o hóspede, consulta disponibilidade
  no Reserva de Garagem (via integração) e ao confirmar **lança a reserva no app** (mapa +
  painel de confirmações). Como o app **não** se conecta ao PMS, toda reserva vinda do chatbot
  fica **sinalizada** para o Douglas **lançar manualmente no PMS**; só após o lançamento e novo
  relatório vira reserva "oficial". Confirmação ao hóspede provavelmente passa por aprovação
  humana (chatbot sinaliza → Douglas analisa → confirma).
- **Check-ins já efetuados no PDF?** Verificar se o relatório traz reservas que já deram
  entrada. Se não, avaliar inserir manualmente os aptos já hospedados com garagem, ou ajustar o
  período exportado (ex.: começar uma semana antes de hoje).
- **Modelo de cobrança do envio em massa:** repasse direto do custo Meta (conta do cliente) vs.
  embutir cota na mensalidade.
- **LGPD / proteção de dados de hóspedes:** relevante quando houver servidor/banco compartilhado
  (telefones e dados pessoais).
- **APK (Android):** gerar quando o app amadurecer; foco do Reserva é desktop, mas mobile é
  desejável. (iOS exige conta Apple paga + Mac — descartado por ora.)

---

## Regras / decisões técnicas registradas

- **PDF universal** mantido (PMSs raramente têm API acessível; o PDF desamarra o produto).
- **Linguagem:** HTML/JS continua certo para as fases atuais; backend entra só com o envio em
  massa; trocar de linguagem agora não traria ganho.
- **Chave única das reservas:** `nro` do PMS (estável mesmo com mudança de nome/apto). No
  IndexedDB, store `reservas` usa `id = nro__apto__vagaIdx` (um nro pode ter vários carros/aptos)
  e store `contatos` usa `nro` (telefone é por reserva, separado do PDF → mesclagem trivial).
- **Score de prioridade (v1.0.0):** `diárias×10 + bônusCanal + (confirmado? +10000) − nro×1e-5`.
  Bônus de canal: Direta/WhatsApp/Telefone/Site = 50; Expedia = 30; Omnibees = 20; Booking = 0.

---

## Atualização ao final desta versão
- **Versão atual:** v1.5.0 (status manual editável + área/filtro "Sem garagem" + divergência PMS +
  arraste no overbooking). **Regra de versionamento 1.5.x** registrada (sem 2.0 sem ordem).
- **Roadmap local (sem backend) CONCLUÍDO** (v1.0.0 → v1.5.0).
- **Próximos passos (infra):** **confirmação real de entrega** + envio em massa (backend + WhatsApp
  Business API); integração Reserva → Garage Spot (passo leve via export/import).
- **Adiados:** confirmação real de entrega; **motos arrastáveis**; (opção) arraste "posicional" sem
  realocar os automáticos; mapeamento de `[canal]`; múltiplas empresas; modelo p/ reservas azuis;
  envio em massa; múltiplas empresas.
