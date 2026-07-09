# RELATÓRIO — Reserva de Garagem v1.5.1.1 (correção do parser do Comandas)

**Data:** 09/07/2026 · **Repo:** `ApolloDSk/controle-garagem-hotel-gumz` (branch `master`).
**Nenhum repositório do Garage Spot foi tocado.** Correção em cima da v1.5.1 (sem mudança de schema).

---

## Causa (bug)

Ao subir o **Comandas em aberto REAL**, o app mostrava *"As informações deste documento não conferem…"*.
A `parsearComandas` da v1.5.1 (validada só com **dado sintético numa linha só**) esperava o bloco do
hóspede **numa única linha** (`<apto> <NOME> <entrada> <saída> [canal] Extras`). No PDF real, lido pelo
**PDF.js em ordem de leitura**, **essa linha não existe**: os campos vêm em **linhas separadas e em
outra ordem** (apto+nome sozinhos; datas, canal e linhas GARAGEM em linhas próprias). Resultado: o
parser achava **zero hóspedes** → `validarDocumentoComandas` recusava o documento.

## Correção

1. **`parsearComandas` reescrita por REGIÕES/ESTADO, independente de ordem:**
   - **Início de bloco** = linha `<apto> <NOME>` (o nome é o texto **antes** da 1ª data ou de
     "Extras"/"Taxas"). Isso casa **tanto** o layout de linha única **quanto** a ordem de leitura real.
     Rejeita ruído/valores/lançamentos (`inicioBlocoComanda` + `RE_NOISE_NOME`).
   - **Região do bloco** = até o próximo início de bloco ou **"Total Geral"**.
   - **entrada/saída** = os **dois primeiros** valores de data com **ano de 4 dígitos** na região; as
     **diárias de 2 dígitos** das linhas GARAGEM são **ignoradas**.
   - **canal** (opcional) = entre "Extras" e "Taxas" (ordem real) **ou** entre a 2ª data e "Extras"
     (linha única); reforço por lista de canais conhecidos (`extrairCanalComanda`).
   - **tipoVeiculo** nas linhas **GARAGEM/ESTACIONAMENTO** (só no **corpo** — o nome "SEM GARAGEM" não
     conta): `CARRO DE PASSEIO`→P, `CAMIONETE`→G, `MOTO`→moto; **sem tipo → padrão**; multi-veículo →
     um ocupante por tipo; auto-filtro (bloco sem lançamento de garagem é ignorado).
2. **Regra do PERÍODO explícita** (`hospedadoParaReserva`): a ocupação da vaga é o **período da
   hospedagem `entrada`→`saida`** (datas de 4 dígitos do cabeçalho), **NUNCA** a data da última comanda
   diária. Basta **≥1 comanda de garagem** (de qualquer dia) para ocupar até o fim da estadia — cobre o
   caso de o PMS ainda não ter lançado a comanda de hoje. O **dia de check-out libera a vaga** (o mapa
   desenha `entrada≤dt<saida`, igual às reservas). Se o carro sair antes, o usuário remove na mão pelo
   "marcar saída / remover".
3. **Validação** (`validarDocumentoComandas`): aceita o documento quando o parser extrai **≥1 hospedado**
   (apto + par de datas de 4 dígitos + linha de garagem no corpo); só recusa quando **nenhum** registro
   é extraído. (O comportamento já era `n≥1`; agora o parser corrigido efetivamente extrai os registros.)
4. `APP_VERSION` → **`v1.5.1.1`**.

**Só mudaram a `parsearComandas`, a regra do período (comentada/explícita) e o efeito na validação.**
Reservas, dois slots, emissão/bloqueio de documento antigo, alocação, hospedados arrastáveis/editáveis,
"Sem garagem (manual)", divergência, anti-duplicação, arraste, status manual, Gestão/Backup, pan —
**inalterados**. Sem mudança de schema (IndexedDB continua **v5**; nenhum store novo).

---

## Validação com PDFs reais

- **Reservas (real):** o `LISTAGEM RESERVA.pdf` real foi subido pelo file-input do slot Reservas —
  **37 reservas** (não-regressão) e emissão lida do documento (`CreationDate` → 05/05/2026 18:09).
  Zero erros de console.
- **Comandas na ordem de leitura real:** exercitado de ponta a ponta (parser → import → render) tanto
  nos testes quanto no navegador real (status `aplicado`, hospedado alocado/renderizado). O **aviso "não
  conferem" NÃO dispara** mais.
- **Comandas real (PDF do Desbravador):** **PENDENTE das amostras.** Não há PDF de Comandas real no
  disco. Foi criada a pasta **`amostras/`** (com `README.md`; os `.pdf` são gitignored por conterem
  dados de hóspedes) e **hooks Playwright `[real]`** prontos: ao colocar um `amostras/*comanda*.pdf`,
  o teste sobe pelo slot Hospedados e confere a extração (contagem esperada ~31); sem a amostra, o teste
  é **pulado com motivo** (não mascara bug). A validação definitiva será o usuário subir o Comandas real.

---

## Testes — 265/265 ✓ (+ 2 hooks `[real]` pulados por falta de amostra; sem `skip` mascarando)

- **ENGINE (unitários): 181/181** (173 da v1.5.1 + **8 novos**): fixture na **ordem de leitura real** →
  3 hospedados corretos (canal vazio no apto 238; datas de 4 dígitos; diária de 2 dígitos ignorada);
  bloco sem garagem ignorado; **regra do período** (não encurta faltando a comanda de hoje; check-out
  libera a vaga); validação aceita o comandas na ordem de leitura.
- **INTEGRAÇÃO (jsdom): 57/57** (56 + **1 novo**): comandas na ordem de leitura → hospedado no mapa
  (vaga por tipo), sem recusa.
- **Playwright (Chromium): 27 passam + 2 hooks `[real]` pulados** (pendentes das amostras).
- Toda a suíte da v1.5.1 **mantida verde** (os fixtures single-line continuam parseando no parser novo).

## Cópia única no Desktop
`reserva-garagem-index-v1.5.1.1.html` (standalone regenerado). Cópia anterior removida (regra permanente).

## Ressalvas
- Heurísticas do Comandas calibradas no **Desbravador** (única amostra/diagnóstico). Validação contra o
  **PDF real** fica **pendente das amostras** (hook pronto em `amostras/`). Extrator isolado/plugável.
