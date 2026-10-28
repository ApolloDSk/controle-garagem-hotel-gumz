# RELATÓRIO — v1.5.9 (28/10/2026)

**Nº OTA correto (Origem) + chaves `[ota]`/`[canal]` + "Copiar mensagem" no Detalhe com marca de contatado +
busca no Contato + Limpar preservando a Gestão + reserva multi-quarto sem apto não é duplicata.**
DB segue **v6**, **sem store novo**, sem dependência nova, sem arquivo novo.

## ⚠ Retomada

Esta versão foi concluída em **retomada**: o notebook reiniciou no meio da execução e a sessão perdeu o
contexto. Diagnóstico ao retomar:

| Verificação | Resultado |
|---|---|
| `git status` | 4 arquivos modificados, não commitados (`index.html`, 3 testes) |
| branch | `master` |
| último commit | `fb20162` v1.5.8 (sem commit da v1.5.9) |
| tags | `pre-v1.5.9` no local **e** no remote (→ `fb20162`); `v1.5.9` não existia |
| `git diff --stat` | +247 / −53 (index.html 274 linhas) |
| Desktop | `reserva-garagem-index-v1.5.8.html` |
| suíte no estado parcial | engine 325/325 · jsdom 102/103 · Playwright 66/67 |

→ **Caso B (trabalho parcial não commitado).** O diff foi lido inteiro e estava **coerente**: A–G já estavam
implementados no app. As 2 falhas eram testes do Limpar ainda na regra antiga. Nada foi descartado; o trabalho
continuou a partir do parcial. Faltavam: `[ota]` na legenda da Gestão, os testes novos da v1.5.9, a validação
nas amostras, o standalone, as docs, o commit/tag e o Desktop.

## Fase 1 — auditoria

### 1. Nº OTA (A)
- **Antes:** `extrairNroOTA` pegava `\d{4,}ID\d{3,}` da linha de origem (ex.: `413101ID21742482`) — é o
  **localizador do channel manager**, não o número da reserva na OTA.
- **Agora:** `extrairOrigemOTA` lê `Origem (<canal>): <nº>` da observação. Regex genérica, com um nível de
  parênteses aninhados e quebra de linha no meio; o número tem de conter dígito. O localizador fica em
  `localizador`.
- **Evidência — `Listagem de reservas - emissão 10jul26.pdf`** (91 reservas distintas, 101 carros):

| Canal (amigável) | Reservas | Com nº OTA |
|---|---:|---:|
| Booking.com | 45 | 45 |
| site oficial do hotel (Booking Engine(\*\* NA \*\*)) | 8 | 8 |
| Expedia | 7 | 7 |
| BestBuy Travel | 2 | 2 |
| OFB Operadora de Turismo LTDA | 2 | 2 |
| Via Capi Nacional · EZ Link · W2M Dynamic - ES · Interep · Soul Traveler | 1 cada | 1 cada |
| **Total com `Origem (…):`** | **69** | **69 (100%)** |
| Sem Origem (WhatsApp 16 / Telefone 6) | 22 | 0 → "não informado" |

  Nenhuma das 22 sem Origem tem localizador; **0 localizador exibido como Nº OTA**; nenhum nº OTA repetido sob
  nº de reserva diferente. Exemplos: #25895 `413101ID20428816` → **6139208311** (Booking); #26058
  `413101ID20608862` → **2444736832** (Expedia); #27316 → **RES004092-18243** (site oficial).
  Nenhum outro lugar mais confiável que a Origem foi encontrado.

### 2. Chaves (B/C)
`substituirChaves` resolvia `[nome] [data] [canal] [empresa] [funcionario]` por mapa; chave sem dado virava
`''` (nunca literal). **`[canal]` vinha de `reserva.canal || reserva.origem`**: o canal da comanda (hospedado)
ou a palavra de origem do relatório ("Whatsapp", "Booking"…). Agora a **Origem é a fonte principal**
(`canalOTA`) e a antiga virou **fallback**.

### 3. Mensagem / envios (D)
O Contato agrupa por nº (`reservasContato`), escolhe a categoria (`categoriaReserva`: overbooking →
`overbooking`; amarelo → `verificando`), o modelo padrão (`modeloPadraoIdx`) e monta o texto com
`substituirChaves`. O registro nasce no disparo do `wa.me` (`registrarEnvio` → store `envios`); "já
contatado" = ≥1 registro (`statusEnvioReserva`). O Detalhe reusa isso tudo (ver abaixo).
Ajuste necessário: `categoriaReserva` passou a respeitar o **status efetivo** (Aguardando manual sobre PDF
azul usa o modelo de verificação; Confirmado manual sai do sistema de modelos). Antes, o Contato listava por
status efetivo mas escolhia o modelo pela cor do PDF.

### 4. Busca (E)
`matchBusca(res, termo)`: nº, nome, apto, tipo de veículo e nº OTA, parcial e sem diferenciar maiúsculas.
Reusada no Contato, acrescida da data de entrada.

### 5. Limpar (F) — decisão do Doug: "Seguir e reportar"
- **O Limpar NÃO apagava os modelos.** `STORES_DADOS_RESERVA` (v1.5.8) = `reservas, hospedados, ajustes,
  reservasManuais, contatos, envios`; o store **`gestao` nunca foi tocado**. Reproduzido: editar modelo →
  Limpar → reabrir = modelo intacto. O teste da v1.5.7 já provava a Gestão "byte a byte".
- **Hipóteses fora do Limpar** (sem mudança estrutural nesta versão):
  1. **(mais provável)** cada arquivo `.html` aberto por `file://` tem **banco próprio**: a versão nova copiada
     no Desktop (`…-v1.5.8.html` → `…-v1.5.9.html`) abre com dados zerados, inclusive a Gestão;
  2. restauração de backup no modo **"Substituir"**;
  3. chip **"memória"** (IndexedDB indisponível → nada persiste).
- **Correção de fundo:** requisito no `PLANEJAMENTO.md` — no executável, armazenamento em **local fixo** que
  não muda a cada versão.
- O Limpar da v1.5.8 apagava também `garagem_layout`, `garagem_upload_info*`, `contatos` e `envios`.

### 6. Duplicata #27316 (G)
O relatório lista **2 linhas** da #27316: `18/07/26 22/07 APF Garantida Aberta 5 3 0 1 4 - 27316 A` e
`… TST Garantida Aberta 3 1 0 1 4 - 27316 A`. Apto `-`, `vagaIdx` 1 nas duas → mesma chave
`nro+apto+vagaIdx` → alerta da v1.5.6. **Distinção segura:** a linha do relatório (`linhaPMS`: datas + tipo de
quarto + situação + pax). Ela entra na identidade **só quando o apto não foi atribuído**. Quartos diferentes →
legítimo; mesma linha repetida → alerta; sem `linhaPMS` → alerta (notificar).

## Implementação

- **Copiar mensagem (D):** botão `📋 Copiar mensagem` no Detalhe, só com modelo aplicável (Aguardando ou em
  overbooking; hospedado não). Texto montado por `grupoContatoDe(nro)` → `agruparContato` (a mesma montagem do
  Contato), `dadosMensagem`, mesma categoria e modelo → **idêntico ao Contato** (provado em e2e comparando a
  área de transferência com o preview do Contato). 1 modelo preenchido → copia direto (1 clique); vários →
  abre o **mesmo** modal do Contato em modo "copiar" (troca 1/2/3, "editar só este envio"). Ao copiar: toast,
  registro `{tipo:'copiado'}` no `envios` com funcionário padrão + data/hora, "Última cópia: dd/mm hh:mm", e
  a seção Envios identifica 📋 Texto copiado × 💬 Enviado. Chave usada e vazia → aviso no modal e no toast.
- **Ícone de contatado:** 💬 discreto junto do nome (onde já ficam ✋/✍️), longe dos selos ⧉/≠/×N. Aparece após
  cópia **ou** envio, enquanto Aguardando ou em overbooking; some em Confirmado fora do overbooking e em Sem
  garagem. Tooltip: "Contatado (mensagem copiada|enviada) em dd/mm hh:mm — aguardando resposta". O bloco é
  redesenhado na hora (`registrarEnvio` → `rerenderMapaEContato`).
- **Busca no Contato:** campo `#ct-busca` no topo da fila; nome, nº, nº OTA, apto, entrada `dd/mm`, `dd/mm/aa`,
  `dd/mm/aaaa`; filtra a fila do período (os dois juntos); Esc limpa; sem resultado → "Nenhuma reserva
  Aguardando encontrada para “…” neste período."
- **Limpar agora:**

| Apaga | Preserva |
|---|---|
| reservas (relatório) e hospedados | **toda a Gestão** (empresa, funcionários, **modelos**) |
| reservas manuais | **telefones** (`contatos`, por nº — religam na reimportação) |
| ajustes (posições, status, exceções, conflitos/retratos) | **histórico de envios e cópias** (`envios`) |
| posições do mapa no `localStorage` (`garagem_layout`) + info de upload | |
| pendências e duplicatas dispensadas | |

  O modal lista as duas colunas. Depois do Limpar, o redesenho do mapa vazio pode regravar `garagem_layout`
  como `{}` (sem nenhuma posição) — esperado.
- **Dado antigo:** reserva gravada pela v1.5.8 e ainda não reimportada tem o localizador em `nroOTA`;
  `hidratar` o move para `localizador` em memória (Nº OTA "não informado" até reimportar). Nada é apagado.

## Comparativo v1.5.8 × v1.5.9 nas amostras

Texto extraído com o próprio leitor do app (`lerPDFcompleto`, Chromium) e parseado pelos dois motores
(v1.5.8 de `fb20162`, v1.5.9 do working tree):

- **Reservas:** 101 = 101 carros; **idênticos campo a campo** fora de `nroOTA` (e dos campos novos
  `localizador`/`canalOTA`/`linhaPMS`). Única diferença: o Nº OTA (localizador → nº real).
- **Duplicatas:** v1.5.8 `[#27316/- × #27316/-]` → v1.5.9 **nenhuma**.
- **Comandas:** 22 hospedados (= v1.5.8; parser intocado).

## Testes — 517/517

- **Engine 342/342** (+17): extração da Origem (3 canais, aninhado, quebra de linha, sem Origem, sem dígito);
  parsear separa nº OTA × localizador; duplicata por nº OTA com o número corrigido (e mesmo localizador com nº
  diferentes **não** alerta); `canalAmigavel`; `[ota]`/`[canal]` nos 3 canais + fallback; `chavesVazias`;
  `categoriaReserva` por status efetivo; `tipo` do envio; busca por data; #27316 sem alerta, mesma linha com
  alerta, sem `linhaPMS` com alerta, mesmo apto atribuído com alerta.
- **jsdom 105/105** (+2, 1 reforçado): Limpar preserva telefone/histórico e **reimportar religa o telefone**
  (o teste antigo passava vazio: a reserva era Confirmada, o campo de telefone não existia e o
  `if (inp)` engolia isso); dado antigo da v1.5.8; regra do ícone (overbooking × Confirmado).
- **Playwright 70/70** (+3, 2 reforçados): ponta a ponta Aguardando → Copiar mensagem → texto = Contato →
  ícone → Confirmado → ícone some → sem botão; envio pelo Contato marca o bloco + Sem garagem + vários modelos
  (modo copiar) + aviso de `[ota]` vazio; busca no Contato com período; Limpar mantém modelo editado,
  telefone, envio e zera as posições; hook `[real]` agora exige **0 duplicata** e **0 localizador** como Nº OTA
  na amostra.
- Sem `test.skip` mascarando: os 2 `test.skip` existentes são os condicionais dos hooks `[real]` (pulam só
  sem amostras); com as amostras presentes, os dois rodaram e passaram.

## Entrega

- `APP_VERSION` = `v1.5.9`; standalone regenerado (`node build-standalone.js`).
- Commit + tag `v1.5.9` no remote; `pre-v1.5.9` já estava publicada (não recriada).
- Desktop: só `reserva-garagem-index-v1.5.9.html` (= standalone).
- ⚠ **Ao abrir a v1.5.9 no Desktop**, pela hipótese 1 acima ela deve abrir **sem dados** (outro arquivo =
  outro banco no `file://`). Para trazer tudo: na v1.5.8, **Gestão › Exportar backup**; na v1.5.9, importar
  o backup em **Substituir** (traz tudo, inclusive ajustes e reservas). O **Mesclar** traz a Gestão (num app
  ainda sem empresa/funcionários) e os telefones, mas não as reservas — aí é só reimportar os relatórios.
  As posições do mapa (`localStorage`) não vão no backup; o encaixe é refeito na 1ª importação.
- Nenhum repositório do GarageSpot foi tocado. Amarelo e selo de gravação intocados.
