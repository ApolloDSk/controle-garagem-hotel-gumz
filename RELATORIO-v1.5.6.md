# RELATÓRIO — v1.5.6

**Reserva de Garagem do Hotel Gumz** — patch único com três temas:
vaga extra para **hospedado em overbooking** · **numeração das vagas fixa** (cima→baixo) ·
**conferência anti-duplicata** (sinaliza, nunca apaga). Sem mudança de schema (DB segue **v6**), sem
backend, sem dependência nova, sem arquivo novo, **sem store novo**. Migração não-destrutiva.

---

## Fase 0 — Backup
`master` limpo; tag **`pre-v1.5.6`** criada e enviada ao remote antes de editar.

---

## Fase 1 — Auditoria (o que o código fazia)

1. **Seletor de status — dois conjuntos.** `statusEditorHTML(nro, st, {overbooking, extraLivre})`
   (a chegar) já oferecia "➕ Vaga extra (EXTRAn)" em overbooking. `statusEditorHospedadoHTML(nro, st)`
   (hospedado) só tinha "Na garagem"/"Saiu". **Causa raiz:** no detalhe, `emOver=!!res._over && !ehH`
   — o **`!ehH` excluía o hospedado** — e a chamada não passava ctx. O roteamento
   `onStatusChange`→`colocarEmVagaExtra` já é status-agnóstico (por `nro`) e serve ao hospedado.

2. **Numeração × filtro.** Em `renderSecaoLinhas`, o rótulo era criado junto da linha
   (`{label:'P'+(i+1), linha}`) e `aplicarOrdemLinhas` **invertia label+linha juntos** → em "baixo→cima"
   o topo virava P18. **Causa raiz: o número estava amarrado à ordem de renderização.**

3. **Chaves de identidade.** `nro` (PMS), `nroOTA` (`extrairNroOTA`), `apto`, `vagaIdx` (multi-carro);
   `id=\`${nro}__${apto}__${vagaIdx}\``. Multi-apto = mesmo `nro`, `apto` diferente; multi-carro = mesmo
   `nro`+`apto`, `vagaIdx` diferente. Base sólida para o gatilho de duplicata.

4. **Destaque da busca.** `.busca-ativa` escurece o resto; `.busca-atual` contorna; `scrollIntoView`.
   Reusado (classes dedicadas `dup-isolando`/`dup-foco`) para isolar o par.

5. **Persistência.** Ajustes manuais persistem por chave estável no store `ajustes`. A **dispensa** de
   duplicata NÃO segue esse caminho: é um **Set em memória, limpo a cada importação** (e a cada
   reabertura) — nada no banco.

---

## Implementação

### 6.1 — Vaga extra para hospedado em overbooking
- `statusEditorHospedadoHTML(nro, st, ctx)` ganhou o `ctx` opcional `{overbooking, extraLivre}` e passa a
  oferecer "➕ Vaga extra (EXTRAn)" quando em overbooking (desabilitada com razão se as 3 estiverem
  ocupadas no período) — **mantendo** "Na garagem"/"Saiu".
- No detalhe, `emOver=!!res._over` (removido o `!ehH`); `extraLivre` calculado para ambos; ctx passado
  para os dois editores.
- Mover para a vaga extra usa `colocarEmVagaExtra` (por `nro`): grava só o placement `EXTRAn` +
  auditoria — **NÃO altera o status** (o hospedado continua "Na garagem"). **Fora de overbooking a opção
  não aparece.**

### 6.2 — Numeração das vagas SEMPRE de cima para baixo
- O rótulo passou a ser **por posição visual** (`P1` sempre no topo, fixo); o filtro cima↔baixo só
  **reordena o conteúdo**.
- O `data-vaga` (alvo de drop / id de alocação / congelamento v1.5.5) **permanece o id da vaga** — drag,
  persistência de ajustes e congelamento de layout **intactos**.
- Mapa `mapaVagaLabel` (id de alocação → rótulo visível) alimenta o tooltip ✋ e o modal "mover", para o
  usuário sempre ver o número fixo. Em "cima→baixo" (padrão) rótulo e id coincidem.

### 6.3 — Conferência anti-duplicata (sinaliza, nunca apaga)
- `detectarDuplicatas(reservas)` (puro, union-find): gatilho = **identidade repetida** —
  **mesmo `nro`+`apto`+`vagaIdx`** (a mesma reserva/carro repetida) **ou** **mesmo `nroOTA` sob ≥2 `nros`
  distintos**. **Multi-carro** (vagaIdx diferente), **multi-apto** (apto diferente) e **homônimos** (nºs
  diferentes) **não** disparam. Hospedados (sem nº PMS/OTA) e nºs `AUTO*` (placeholder) ficam de fora.
- `assinaturaCluster` = ids ordenados (estável na importação).
- **Selo `⧉` nos DOIS blocos** do par; **clicar isola** o par (`dup-isolando` escurece o resto,
  `dup-foco` contorna, scroll); **clicar no fundo** volta ao normal; **`✕` dispensa** (nos dois, via
  assinatura do cluster).
- **Dispensa NÃO-permanente:** `duplicatasDispensadas` é um Set **limpo a cada importação** — se o
  relatório reproduzir o par, o alerta **reaparece**; se o usuário corrigir no PMS, some. **Nada
  persistido, nenhum store novo.**
- **Nunca apaga:** o app só sinaliza; qualquer exclusão é ação explícita do usuário (fluxo existente).

### 6.4 — `APP_VERSION` = `v1.5.6`.

---

## Preservação (não regrediu)
Tudo da v1.5.5 e anteriores: amarelo = cor da bolinha; arraste move só a arrastada (congelamento de
layout); modal do detalhe rolando; Contato como fila de Aguardando; telefone sem DDI injetado; alocação
automática na importação; overbooking que nunca derruba confirmado; Carro 01/02; destaque persistente;
hospedados; parser do comandas; vagas extras; +Reserva manual; log de edições; status manual + auditoria;
ajustes persistindo; histórico de envios; modelos da Gestão; selo de gravação. **Homônimos e multi-apto
continuam entrando normalmente** e **não** são sinalizados.

---

## Testes — TODOS verdes (sem `skip` mascarando)
- **ENGINE (Node):** 253/253 (+8: `detectarDuplicatas` real/OTA, homônimos, multi-apto, multi-carro,
  hospedado fora, `AUTO*` fora, `assinaturaCluster` estável).
- **INTEGRAÇÃO (jsdom):** 88/88 (+5: editor do hospedado oferece extra só em overbooking; hospedado
  forçado a overbooking mostra extra e mover mantém status; duplicata real com selo nos dois + dispensar
  + reimport reproduz + nunca apaga; isolar/limpar; homônimos/multi-apto sem selo; numeração fixa
  reescrita).
- **PLAYWRIGHT (Chromium):** 46/46, incluindo os fluxos ponta a ponta: hospedado em overbooking →
  atribuir vaga extra (posição muda, status permanece); alternar organização → números inalterados;
  forçar par duplicado → selo nos dois → clicar isola → `✕` dispensa nos dois → reimport reproduz.
- Hooks `[real]` de `amostras/` (Comandas → 21 hospedados; Reservas sem regressão) verdes, **agora com a
  asserção de que nenhuma reserva legítima do relatório real é marcada como duplicata**.

**Total: 387/387 verde** (253 engine + 88 integração + 46 Playwright).

---

## Validação com PDF real (`amostras/`, emissão 10/jul)
Parser sem regressão; **`.dup-badge` = 0** no relatório real (multi-apto/homônimos legítimos preservados).

---

## Parqueado / próximo
- **Empacotar como executável desktop** (patch próprio; Electron/Tauri a escolher; precisa do ícone; sem
  separação por empresa; dados não migram — reimportar o relatório reconstrói).
- Adiados de sempre: outros PMSs, múltiplas empresas, `[canal]`, modelo para confirmadas, integração
  Garage Spot / backend, envio em massa.
</content>
