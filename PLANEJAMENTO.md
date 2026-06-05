# PLANEJAMENTO.md — Reserva de Garagem do Hotel Gumz

> Roadmap em **3 níveis**. Manter sempre atualizado ao fim de cada versão.
> Versão atual: **v1.1.0** (entregue) · Próxima planejada: **v1.2.0** (Gestão + Modelos).

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

---

## 🔜 CONFIRMADO PARA O FUTURO (plano de patches)

### v1.2.0 — Gestão + Modelos de Mensagens
- Nova **aba Gestão**. Modelos por status (verificando/overbooking), **até 3 cada**, com
  numeração 1/2/3 + padrão editável.
- Chaves `[nome] [data] [canal] [empresa] [funcionario]` com **substituição real**, autocompletar
  e **legenda + botão "?"**.
- **Cadastro de empresa** (`[empresa]`) e **funcionários** com padrão.
- Ao enviar: conferir/trocar modelo/editar **só o envio** (sem alterar o modelo salvo).

### v1.3.0 — Edição manual + Backup/Restauração
- **Edição manual:** mover reserva de vaga (com confirmação) e **data proibida**; distinguir
  "mudar só de vaga" de "mudar de data" (prévia "ghost", confirmação específica).
- **Backup/Restauração:** Export/Import dos dados.

### Adiados ("vamos ver depois")
- Mapeamento do **nome do canal** para `[canal]` (ex.: expedia.com / hoteis.com / omnibees).
- Suporte a **mais de uma empresa**.

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
- **Versão atual:** v1.1.0 (UX + check-in no passado).
- **Próxima planejada:** v1.2.0 (Gestão + Modelos de Mensagens).
- **Depois:** v1.3.0 (edição manual + backup/restauração). Adiados: mapeamento de `[canal]`;
  múltiplas empresas.
