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
- **IndexedDB** (`garagemGumz`, v1): store **`reservas`** (keyPath `id`, escrito **só** pela
  importação de PDF) e store **`contatos`** (keyPath `nro`, escrito **só** pela ferramenta de
  contato). Essa separação é o que torna a mesclagem **não-destrutiva** trivial: importar PDF
  nunca toca em telefones.
- **Chave da reserva no PMS = `nro`** (estável mesmo se nome/apto mudarem). Como um `nro` pode
  ter vários aptos/carros, a chave primária do store `reservas` é `id = nro__apto__vagaIdx`.

### Como rodar os testes / regenerar o standalone
- `node setup.js` → baixa o PDF.js para `pdfjs/` (gitignored).
- `node build-standalone.js` → regenera `controle-garagem-standalone.html` a partir do
  `index.html` (embute o PDF.js inline). **Rode sempre que mexer no `index.html`.**
- Testes de lógica (Node): o harness extrai o bloco ENGINE do `index.html` e roda asserts.
  Há também teste de integração com `jsdom` + `fake-indexeddb`. Ver `RELATORIO-*.md`.

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

## Versão atual

**v1.0.0** — fundação: lógica de vagas correta (amarelo usa pequeno+grande, encaixe
inteligente, prioridade, overbooking protege confirmados, sinaliza grande em vaga pequena);
persistência IndexedDB com mesclagem não-destrutiva; ferramenta de contato base (filtros,
telefone com status, wa.me individual). Ver `RELATORIO-v1.0.0.md` e `PLANEJAMENTO.md`.

**Próxima planejada:** v1.1.0 — edição manual (arrastar reservas com confirmação e prévia
"ghost"). A edição manual **NÃO** entrou na v1.0.0.
