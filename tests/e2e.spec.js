/*
 * Testes E2E (Playwright + Chromium, navegador real, servido por HTTP) — Reserva de Garagem v1.1.0.
 *   npx playwright test
 */
const { test, expect } = require('@playwright/test');
const os = require('os');
const path = require('path');
const fs = require('fs');

// v1.5.1.1 — procura PDFs reais em amostras/ (o usuário coloca depois). Hook pronto p/ validar
// contra o documento REAL; se não houver amostra, o teste é pulado com motivo (não mascara bug).
const AMOSTRAS_DIR = path.join(__dirname, '..', 'amostras');
function acharAmostras(regex) {
  try { return fs.readdirSync(AMOSTRAS_DIR).filter(f => /\.pdf$/i.test(f) && regex.test(f)).map(f => path.join(AMOSTRAS_DIR, f)); }
  catch (e) { return []; }
}

// ── PDF sintético com datas relativas a hoje (determinístico) ──
function pad(n) { return String(n).padStart(2, '0'); }
function fmtBloco(d) { return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`; }
function fmtSai(d) { return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; }
function dias(n) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d; }
function bloco(nro, ent, sai, apto, origem, obs, hosp) {
  return `${fmtBloco(ent)} ${fmtSai(sai)} 1 2 ${apto} ABC ${nro} H\n${origem}\nObs do Apto: ${obs}\nHóspedes :\n${hosp}\n${hosp}\nDesbravador Software`;
}
function montarPDF() {
  const hoje = dias(0), maisTarde = dias(5), ontem = dias(-2), depois = dias(3);
  return [
    bloco('30001', hoje, maisTarde, '201', 'WHATSAPP', 'GARAGEM PEQUENO', 'ANA PEQUENA'),
    bloco('30002', hoje, maisTarde, '202', 'BOOKING 413101ID20542561', 'GARAGEM GRANDE', 'BRUNO GRANDE'),
    bloco('30003', hoje, maisTarde, '203', 'EXPEDIA', 'VERIFICAR INTERESSE SEM CLASSIF', 'CARLA AMARELA'),
    bloco('30004', ontem, depois, '204', 'WHATSAPP', 'GARAGEM PEQUENO', 'DAVI PASSADO'),
  ].join('\n');
}

// v1.5.1 — Comandas em aberto (datas dd/mm/aaaa relativas a hoje)
function fmtComandaData(d) { return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; }
function blocoComanda(apto, nome, ent, sai, canal, desc) {
  return `        ${apto} ${nome} ${fmtComandaData(ent)}      ${fmtComandaData(sai)}      ${canal}      Extras
GARAGEM           ${fmtBloco(ent)}       1 ESTACIONAMENTO ${desc}
                                                     40,00           0,00 Lançamento      0     0    ${apto} FUNC X`;
}
function montarComandas(list) {
  const hoje = dias(0), maisTarde = dias(5), ontem = dias(-2), depois = dias(3);
  const blocos = list || [
    blocoComanda('501', 'HOSPEDE CARRO', hoje, maisTarde, 'BOOKING.COM', 'CARRO DE PASSEIO'),
    blocoComanda('502', 'HOSPEDE GRANDE', ontem, depois, '', 'CAMIONETE - BAIXA60,00'),
  ];
  return `HOTEL GUMZ                     Comandas em aberto - detalhado            Página:    1
Filtro: Lançadas até 31/12/3000 | Todas contas:sim |
` + blocos.join('\n');
}

async function boot(page) {
  await page.goto('/index.html');
  await page.waitForFunction(() => /salvo|mem/.test(document.getElementById('db-chip').textContent));
}
async function importar(page) {
  await page.evaluate(async (txt) => { await window.importarPDF(window.parsear(txt)); }, montarPDF());
  await page.waitForSelector('.cell-span');
}
async function importarComandas(page, txt) {
  await page.evaluate(async (t) => { await window.importarComandas(window.parsearComandas(t)); }, txt || montarComandas());
  await page.waitForSelector('.cell-span.hospedado');
}

test('smoke: carrega, rodapé v1.5.1, abas (Mapa/Contato/Gestão), dois slots', async ({ page }) => {
  await boot(page);
  await expect(page.locator('#footer-version')).toHaveText('v1.5.5');
  await expect(page.locator('#tab-mapa')).toContainText('Mapa de Reservas');
  await expect(page.locator('#tab-mapa svg.tab-ico')).toHaveCount(1);
  await expect(page.locator('#tab-contato svg.tab-ico.wa')).toHaveCount(1);
  await expect(page.locator('#tab-gestao')).toContainText('Gestão');
  // v1.5.1 — dois slots identificados (Reservas / Hospedados)
  await expect(page.locator('#upload-label')).toContainText('Reservas');
  await expect(page.locator('#upload-label-hosp')).toContainText('Hospedados');
});

test('Gestão: seções presentes e legenda de chaves + botão "?"', async ({ page }) => {
  await boot(page);
  await page.click('#tab-gestao');
  await expect(page.locator('.gcard h3', { hasText: 'Empresa' })).toBeVisible();
  await expect(page.locator('.gcard h3', { hasText: 'Modelos de Mensagens' })).toBeVisible();
  await expect(page.locator('.gcard h3', { hasText: 'Backup' })).toBeVisible();
  await page.click('.ajuda-btn');
  await expect(page.locator('#ajuda-modal')).toBeVisible();
  await expect(page.locator('#ajuda-modal')).toContainText('[funcionario]');
});

test('Gestão: autocomplete [n sugere [nome] e chip insere chave', async ({ page }) => {
  await boot(page);
  await page.click('#tab-gestao');
  const ta = page.locator('#modelo-verificando-1');
  await ta.click();
  await page.keyboard.type('[n');
  await expect(page.locator('#ac-box')).toBeVisible();
  await expect(page.locator('#ac-box')).toContainText('[nome]');
  await page.keyboard.press('Tab');
  await expect(ta).toHaveValue('[nome]');
  // chip insere outra chave
  await page.locator('#modelo-verificando-2').click();
  await page.locator('#modelo-verificando-2 ~ .chips .chip', { hasText: '[empresa]' }).click();
  await expect(page.locator('#modelo-verificando-2')).toHaveValue('[empresa]');
});

test('Envio: preview substituído, troca de modelo e Editar não altera o modelo salvo', async ({ page }) => {
  await boot(page);
  await importar(page);
  await page.evaluate(() => { window.gestaoSetEmpresa('Hotel Gumz'); window.gestaoSetModelo('verificando', 1, 'Segundo modelo: olá [nome]'); });
  await page.click('#tab-contato');
  // habilita o botão de envio definindo um telefone para a reserva amarela 30003
  await page.fill('#fone-30003', '47998765432');
  await page.click('#btn-fone-30003');
  await page.locator('.ct-item[data-nro="30003"] .wa-btn', { hasText: 'Mensagem' }).click();
  await expect(page.locator('#envio-modal')).toBeVisible();
  const prev = page.locator('#envio-preview');
  await expect(prev).toHaveValue(/Carla Amarela/); // v1.4.0 — [nome] em formato de nome próprio
  await expect(prev).toHaveValue(/Hotel Gumz/);
  await expect(prev).not.toHaveValue(/\[nome\]/);
  // troca para Modelo 2
  await page.locator('.envio-mbtn', { hasText: 'Modelo 2' }).click();
  await expect(prev).toHaveValue('Segundo modelo: olá Carla Amarela');
  // Editar só este envio
  await page.click('#envio-editar');
  await expect(prev).not.toHaveAttribute('readonly', '');
  await prev.fill('TEXTO EDITADO SÓ AQUI');
  const modeloSalvo = await page.evaluate(() => window.getGestaoConfig().modelos.verificando[1]);
  expect(modeloSalvo).toBe('Segundo modelo: olá [nome]');
});

test('mapa renderiza seções e reservas após importar', async ({ page }) => {
  await boot(page);
  await importar(page);
  await expect(page.locator('.secao-titulo', { hasText: 'Pequenos' })).toBeVisible();
  await expect(page.locator('.secao-titulo', { hasText: 'Grandes' })).toBeVisible();
  expect(await page.locator('.cell-span').count()).toBeGreaterThanOrEqual(3);
});

test('check-in no passado renderiza com borda cortada (cortado-esq)', async ({ page }) => {
  await boot(page);
  await importar(page);
  expect(await page.locator('.cell-span.cortado-esq').count()).toBeGreaterThanOrEqual(1);
});

test('clicar no nº PMS dispara feedback de cópia (toast)', async ({ page }) => {
  await boot(page);
  await importar(page);
  await page.click('#tab-contato');
  await page.locator('.ct-badge.pms.copyable').first().click();
  await expect(page.locator('#copy-toast')).toHaveClass(/show/);
  await expect(page.locator('#copy-toast')).toContainText('Copiado');
});

test('clicar no nº OTA dispara feedback de cópia (toast)', async ({ page }) => {
  await boot(page);
  await importar(page);
  // v1.5.5 (6.4): a fila do Contato é só "Aguardando" — põe a Booking (OTA) em Aguardando p/ ver o badge OTA.
  await page.evaluate(() => window.salvarStatusManual('30002', 'aguardando'));
  await page.click('#tab-contato');
  await page.locator('.ct-badge.ota.copyable').first().click();
  await expect(page.locator('#copy-toast')).toContainText('Copiado');
});

test('filtro de ordenação inverte a ordem visível das vagas', async ({ page }) => {
  await boot(page);
  await importar(page);
  const antes = await page.locator('.row-label').allTextContents();
  await page.click('#btn-ordem');
  const depois = await page.locator('.row-label').allTextContents();
  expect(JSON.stringify(antes)).not.toBe(JSON.stringify(depois));
  await expect(page.locator('#ordem-label')).toContainText('baixo→cima');
});

test('telefone Confirmar↔Editar bloqueia/desbloqueia o campo', async ({ page }) => {
  await boot(page);
  await importar(page);
  await page.click('#tab-contato');
  const item = page.locator('.ct-item').first();
  const nro = await item.getAttribute('data-nro');
  await page.fill(`#fone-${nro}`, '47998765432');
  await page.click(`#btn-fone-${nro}`);
  await expect(page.locator(`#fone-${nro}`)).toHaveAttribute('readonly', '');
  await expect(page.locator(`#btn-fone-${nro}`)).toHaveText('Editar');
  await page.click(`#btn-fone-${nro}`);
  await expect(page.locator(`#fone-${nro}`)).not.toHaveAttribute('readonly', '');
  await expect(page.locator(`#btn-fone-${nro}`)).toHaveText('Confirmar');
});

// helper: arrasta o bloco que contém `texto` para a vaga `vagaAlvo` (ex.: "P5")
async function arrastar(page, texto, vagaAlvo, { soltar = true, passos = 12 } = {}) {
  const src = page.locator('.cell-span', { hasText: texto }).first();
  await src.scrollIntoViewIfNeeded();
  const sb = await src.boundingBox();
  const tgt = page.locator(`.row-cells[data-vaga="${vagaAlvo}"]`);
  const tb = await tgt.boundingBox();
  const startX = sb.x + sb.width / 2, startY = sb.y + sb.height / 2;
  const endX = tb.x + 60, endY = tb.y + tb.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: passos });
  if (soltar) await page.mouse.up();
  return { startX, startY, endX, endY };
}

test('arraste: mover de vaga abre modal; Confirmar reposiciona (✋)', async ({ page }) => {
  await boot(page);
  await importar(page);
  await arrastar(page, 'ANA', 'P5');
  await expect(page.locator('#mover-modal')).toBeVisible();
  await expect(page.locator('#mover-texto')).toContainText('não mudam');
  await page.click('#mover-confirmar');
  const alvo = page.locator('.row-cells[data-vaga="P5"] .cell-span', { hasText: 'ANA' });
  await expect(alvo).toHaveCount(1);
  await expect(alvo).toHaveClass(/tem-ajuste/);
});

test('arraste: Cancelar não muda nada', async ({ page }) => {
  await boot(page);
  await importar(page);
  await arrastar(page, 'ANA', 'P6');
  await expect(page.locator('#mover-modal')).toBeVisible();
  await page.click('#mover-modal >> text=Cancelar');
  await expect(page.locator('.row-cells[data-vaga="P6"] .cell-span', { hasText: 'ANA' })).toHaveCount(0);
});

test('abaixo do limiar = clique → abre o detalhe (não arrasta)', async ({ page }) => {
  await boot(page);
  await importar(page);
  const src = page.locator('.cell-span', { hasText: 'ANA' }).first();
  const sb = await src.boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(sb.x + sb.width / 2 + 3, sb.y + sb.height / 2 + 2, { steps: 2 }); // < 5px
  await page.mouse.up();
  await expect(page.locator('#detalhe-modal')).toBeVisible();
  await expect(page.locator('#mover-modal')).toBeHidden();
});

test('arraste funciona com ordenação invertida (vaga por identificador)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1600 }); // mapa inteiro visível (sem scroll)
  await boot(page);
  await importar(page);
  await page.click('#btn-ordem'); // baixo→cima
  await expect(page.locator('#ordem-label')).toContainText('baixo→cima');
  await arrastar(page, 'ANA', 'P9'); // vaga vazia; alvo resolvido por data-vaga, não por índice
  await expect(page.locator('#mover-modal')).toBeVisible();
  await page.click('#mover-confirmar');
  await expect(page.locator('.row-cells[data-vaga="P9"] .cell-span', { hasText: 'ANA' })).toHaveCount(1);
});

test('voltar ao automático remove o ajuste', async ({ page }) => {
  await boot(page);
  await importar(page);
  await arrastar(page, 'ANA', 'P5');
  await page.click('#mover-confirmar');
  await expect(page.locator('.row-cells[data-vaga="P5"] .cell-span', { hasText: 'ANA' })).toHaveCount(1);
  // abre detalhe (clique abaixo do limiar) e volta ao automático
  const src = page.locator('.row-cells[data-vaga="P5"] .cell-span', { hasText: 'ANA' });
  const sb = await src.boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down(); await page.mouse.move(sb.x + sb.width / 2 + 2, sb.y + sb.height / 2, { steps: 2 }); await page.mouse.up();
  await expect(page.locator('#detalhe-modal')).toBeVisible();
  await page.click('#detalhe-modal >> text=Voltar ao automático');
  await expect(page.locator('.row-cells[data-vaga="P5"] .cell-span.tem-ajuste')).toHaveCount(0);
});

// ════════ v1.4.0 — novos testes ════════

test('5.2 Contato: clicar fora do nome seleciona; copiar nº não quebra a seleção', async ({ page }) => {
  await boot(page);
  await importar(page);
  // v1.5.5 (6.4): a fila é só "Aguardando" — coloca a 30002 (Booking) em Aguardando p/ ela aparecer.
  await page.evaluate(() => window.salvarStatusManual('30002', 'aguardando'));
  await page.click('#tab-contato');
  const item = page.locator('.ct-item[data-nro="30002"]');
  await item.locator('.ct-meta').click(); // área que não é o nome
  await expect(item).toHaveClass(/active/);
  // copiar o nº PMS funciona (toast) e não derruba a seleção
  await item.locator('.ct-badge.pms.copyable').click();
  await expect(page.locator('#copy-toast')).toContainText('Copiado');
  await expect(item).toHaveClass(/active/);
});

test('5.3/5.4 enviar marca "enviado" e a prancheta registra (data/hora/funcionário)', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => { window.gestaoSetEmpresa('Hotel Gumz'); window.gestaoAddFuncionario(); const f = window.getGestaoConfig().funcionarios[0].id; window.gestaoSetFuncNome(f, 'João'); });
  await importar(page);
  await page.click('#tab-contato');
  await page.fill('#fone-30003', '47998765432');
  await page.click('#btn-fone-30003');
  // ainda NÃO enviado (só telefone)
  await expect(page.locator('.ct-item[data-nro="30003"] .status-env')).toHaveCount(0);
  await page.locator('.ct-item[data-nro="30003"] .wa-btn', { hasText: 'Mensagem' }).click();
  await expect(page.locator('#envio-modal')).toBeVisible();
  await page.click('#envio-enviar'); // dispara wa.me → registra envio
  await expect(page.locator('.ct-item[data-nro="30003"] .status-env')).toHaveCount(1);
  // prancheta reflete a reserva selecionada com o registro
  await page.locator('.ct-item[data-nro="30003"]').click();
  await expect(page.locator('#prancheta-contato')).toBeVisible();
  await expect(page.locator('#prancheta-contato .pr-item')).toHaveCount(1);
  await expect(page.locator('#prancheta-contato')).toContainText('João');
});

test('5.5/5.4 detalhe: copiar nº PMS/OTA + prancheta no canto inferior direito', async ({ page }) => {
  await boot(page);
  await importar(page);
  // abre o detalhe da reserva Booking (tem OTA) por clique abaixo do limiar
  const src = page.locator('.cell-span', { hasText: 'BRUNO' }).first();
  await src.scrollIntoViewIfNeeded();
  const sb = await src.boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(sb.x + sb.width / 2 + 2, sb.y + sb.height / 2, { steps: 2 });
  await page.mouse.up();
  await expect(page.locator('#detalhe-modal')).toBeVisible();
  await expect(page.locator('#detalhe-prancheta')).toBeVisible();
  // copiar nº PMS
  await page.locator('#detalhe-corpo .copyable', { hasText: '#30002' }).click();
  await expect(page.locator('#copy-toast')).toContainText('Copiado');
  // copiar OTA
  await page.locator('#detalhe-corpo .copyable', { hasText: '413101ID20542561' }).click();
  await expect(page.locator('#copy-toast')).toContainText('Copiado');
});

test('5.6 pan: arrastar o FUNDO move o mapa nas duas direções; bloco ainda move de vaga', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 680 }); // força overflow horiz. e vert. (altura p/ P5 ficar visível após o cabeçalho de 2 slots)
  await boot(page);
  await importar(page);
  // estado inicial de scroll
  const before = await page.evaluate(() => ({ x: document.getElementById('mapa-wrapper').scrollLeft, y: (document.scrollingElement || document.documentElement).scrollTop }));
  // arrasta o FUNDO (uma célula vazia, longe de qualquer bloco) p/ cima e p/ a esquerda.
  // Obs.: o wrapper tem overflow-y:visible, então seu bbox é a altura TOTAL do mapa — usar
  // coordenadas DENTRO do viewport (não o canto do bbox, que fica fora da tela).
  const wb = await page.locator('#mapa-wrapper').boundingBox();
  const sx = Math.min(wb.x + wb.width - 50, 700), sy = wb.y + 130;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx - 160, sy - 90, { steps: 12 });
  await page.mouse.up();
  const after = await page.evaluate(() => ({ x: document.getElementById('mapa-wrapper').scrollLeft, y: (document.scrollingElement || document.documentElement).scrollTop }));
  expect(after.x).toBeGreaterThan(before.x); // pan horizontal
  expect(after.y).toBeGreaterThan(before.y); // pan vertical
  // arrastar um BLOCO continua disparando o fluxo de mover vaga (v1.3.0)
  await arrastar(page, 'ANA', 'P5');
  await expect(page.locator('#mover-modal')).toBeVisible();
  await page.click('#mover-confirmar');
  await expect(page.locator('.row-cells[data-vaga="P5"] .cell-span', { hasText: 'ANA' })).toHaveCount(1);
});

// ════════ v1.5.0 — status manual (Parte A) + arraste no overbooking (Parte D) ════════

test('A: status no Contato → "Sem garagem" tira do mapa; checkbox mostra a área; voltar retorna', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1600 });
  await boot(page);
  await importar(page);
  await page.click('#tab-contato');
  await page.waitForSelector('.ct-item');
  // v1.5.5 (6.4): a fila é só "Aguardando" — usa a CARLA (30003, amarela), que está na fila.
  const sel = page.locator('.ct-item[data-nro="30003"] .status-sel');
  await expect(sel).toHaveCount(1);
  await sel.selectOption('sem_garagem');
  // some do mapa
  await expect(page.locator('#mapa-container .cell-span', { hasText: 'CARLA AMARELA' })).toHaveCount(0);
  // área "Sem garagem (manual)" oculta até ligar o checkbox
  await page.click('#tab-mapa');
  await expect(page.locator('.secao-semgar')).toHaveCount(0);
  await page.check('#chk-semgar');
  await expect(page.locator('.secao-semgar')).toContainText('CARLA AMARELA');
  // voltar status (confirmado) → reserva retorna ao mapa
  await page.locator('.secao-semgar .status-sel').selectOption('confirmado');
  await expect(page.locator('#mapa-container .cell-span', { hasText: 'CARLA AMARELA' })).toHaveCount(1);
});

test('A: editar status no detalhe e divergência com o PMS sinalizada', async ({ page }) => {
  await boot(page);
  await importar(page);
  // abre o detalhe da CARLA (amarela) por clique abaixo do limiar
  const src = page.locator('.cell-span', { hasText: 'CARLA AMARELA' }).first();
  const sb = await src.boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(sb.x + sb.width / 2 + 2, sb.y + sb.height / 2 + 2, { steps: 2 });
  await page.mouse.up();
  await expect(page.locator('#detalhe-modal')).toBeVisible();
  const sel = page.locator('#detalhe-corpo .status-sel');
  await expect(sel).toHaveCount(1);
  await sel.selectOption('confirmado'); // amarelo→confirmado diverge do PDF
  // reabre o detalhe para ver a divergência
  await page.locator('#detalhe-acoes >> text=Fechar').click();
  const src2 = page.locator('.cell-span', { hasText: 'CARLA AMARELA' }).first();
  const sb2 = await src2.boundingBox();
  await page.mouse.move(sb2.x + sb2.width / 2, sb2.y + sb2.height / 2);
  await page.mouse.down();
  await page.mouse.move(sb2.x + sb2.width / 2 + 2, sb2.y + sb2.height / 2 + 2, { steps: 2 });
  await page.mouse.up();
  await expect(page.locator('#detalhe-corpo .pms-diverg-badge')).toContainText('PMS ainda não atualizado');
});

test('D: arrastar bloco de vaga → overbooking (fixa) e overbooking → vaga (reposiciona)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 2600 });
  await boot(page);
  await importar(page);
  // semeia um bloco no overbooking p/ existir o alvo de drop (organização visual)
  await page.evaluate(() => window.salvarAjuste('30002', 'OVERBOOKING'));
  await page.waitForSelector('.row-cells[data-vaga="OVERBOOKING"] .cell-span');
  // arrasta ANA (vaga) → área de overbooking
  await arrastar(page, 'ANA', 'OVERBOOKING');
  await expect(page.locator('#mover-modal')).toBeVisible();
  await expect(page.locator('#mover-texto')).toContainText('OVERBOOKING');
  await expect(page.locator('#mover-texto')).toContainText('não altera status');
  await page.click('#mover-confirmar');
  await expect(page.locator('.row-cells[data-vaga="OVERBOOKING"] .cell-span', { hasText: 'ANA PEQUENA' })).toHaveCount(1);
  // arrasta BRUNO (overbooking) → vaga P5
  await arrastar(page, 'BRUNO', 'P5');
  await expect(page.locator('#mover-modal')).toBeVisible();
  await expect(page.locator('#mover-texto')).toContainText('vaga P5'); // v1.5.3 — texto focado no destino
  await page.click('#mover-confirmar');
  await expect(page.locator('.row-cells[data-vaga="P5"] .cell-span', { hasText: 'BRUNO' })).toHaveCount(1);
});

test('D: Cancelar o arraste p/ overbooking não muda nada', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 2600 });
  await boot(page);
  await importar(page);
  await page.evaluate(() => window.salvarAjuste('30002', 'OVERBOOKING'));
  await page.waitForSelector('.row-cells[data-vaga="OVERBOOKING"] .cell-span');
  await arrastar(page, 'ANA', 'OVERBOOKING');
  await expect(page.locator('#mover-modal')).toBeVisible();
  await page.click('#mover-modal >> text=Cancelar');
  await expect(page.locator('.row-cells[data-vaga="OVERBOOKING"] .cell-span', { hasText: 'ANA PEQUENA' })).toHaveCount(0);
});

// ════════ v1.5.1 — 2º DOCUMENTO (Comandas/Hospedados) ════════

test('v1.5.1 subir comandas → hospedados no mapa (visual próprio, vaga por tipo) + emissão no slot', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1600 });
  await boot(page);
  await importarComandas(page);
  // hospedados renderizados com visual próprio (classe .hospedado)
  await expect(page.locator('#mapa-container .cell-span.hospedado', { hasText: 'HOSPEDE CARRO' })).toHaveCount(1);
  await expect(page.locator('#mapa-container .cell-span.hospedado', { hasText: 'HOSPEDE GRANDE' })).toHaveCount(1);
  // camionete (G) na seção Grande
  const gVagas = page.locator('.row-cells[data-vaga^="G"] .cell-span', { hasText: 'HOSPEDE GRANDE' });
  await expect(gVagas).toHaveCount(1);
  // legenda inclui Hospedado
  await expect(page.locator('.legenda')).toContainText('Hospedado');
});

test('v1.5.1 arrastar hospedado e "marcar saída" → vai para Sem garagem (manual)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 2000 });
  await boot(page);
  await importarComandas(page);
  // arrasta o hospedado carro para a vaga P8
  await arrastar(page, 'HOSPEDE CARRO', 'P8');
  await expect(page.locator('#mover-modal')).toBeVisible();
  await page.click('#mover-confirmar');
  await expect(page.locator('.row-cells[data-vaga="P8"] .cell-span', { hasText: 'HOSPEDE CARRO' })).toHaveCount(1);
  // abre o detalhe (clique abaixo do limiar) e marca saída
  const src = page.locator('.cell-span', { hasText: 'HOSPEDE CARRO' }).first();
  const sb = await src.boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(sb.x + sb.width / 2 + 2, sb.y + sb.height / 2 + 2, { steps: 2 });
  await page.mouse.up();
  await expect(page.locator('#detalhe-modal')).toBeVisible();
  await page.locator('#detalhe-corpo .status-sel').selectOption('sem_garagem');
  await page.evaluate(() => window.fecharDetalhe()); // fecha o modal antes de mexer no mapa
  // some do mapa
  await expect(page.locator('#mapa-container .cell-span', { hasText: 'HOSPEDE CARRO' })).toHaveCount(0);
  // aparece na área Sem garagem (manual)
  await page.check('#chk-semgar');
  await expect(page.locator('.secao-semgar')).toContainText('HOSPEDE CARRO');
});

test('v1.5.1 documento mais antigo é recusado; arquivo sem info não gera + avisa; reimport de um slot não apaga o outro', async ({ page }) => {
  await boot(page);
  // aplica reservas + comandas (emissão 2000)
  await page.evaluate(async ({ res, com }) => {
    await window.aplicarUploadReservas(res, 2000, { nomeArquivo: 'r.pdf', dataHoraUpload: Date.now() });
    await window.aplicarUploadHospedados(com, 2000, { nomeArquivo: 'c.pdf', dataHoraUpload: Date.now() });
  }, { res: montarPDF(), com: montarComandas() });
  await page.waitForSelector('.cell-span.hospedado');
  const hospAntes = await page.evaluate(() => window.hospedadosNoPeriodo().length);
  // documento de comandas MAIS ANTIGO (emissão 1000) → recusado, mantém o atual + mensagem de aviso
  const r = await page.evaluate(async (com) => window.aplicarUploadHospedados(com, 1000, { nomeArquivo: 'antigo.pdf', dataHoraUpload: Date.now() }), montarComandas([blocoComanda('900', 'SO UM', dias(0), dias(3), '', 'CARRO DE PASSEIO')]));
  expect(r.status).toBe('recusado_antigo');
  expect(r.msg).toContain('mais antigo');
  expect(await page.evaluate(() => window.hospedadosNoPeriodo().length)).toBe(hospAntes);
  // arquivo SEM as infos no slot de comandas → não gera + aviso
  const r2 = await page.evaluate(async () => window.aplicarUploadHospedados('documento aleatorio sem estrutura', 5000, { nomeArquivo: 'x.pdf', dataHoraUpload: Date.now() }));
  expect(r2.status).toBe('invalido');
  expect(r2.msg).toContain('não conferem');
  // reimport SÓ das reservas não apaga hospedados
  const resCount = await page.evaluate(() => window.hospedadosNoPeriodo().length);
  await page.evaluate(async (res) => window.aplicarUploadReservas(res, 3000, { nomeArquivo: 'r2.pdf', dataHoraUpload: Date.now() }), montarPDF());
  expect(await page.evaluate(() => window.hospedadosNoPeriodo().length)).toBe(resCount);
});

test('v1.5.1.1 [real] Comandas de amostras/ → hospedados (pendente até haver amostra)', async ({ page }) => {
  const pdfs = acharAmostras(/comanda/i);
  test.skip(pdfs.length === 0, 'Sem PDF de Comandas em amostras/ — validação com o real fica pendente das amostras.');
  const avisos = [];
  page.on('dialog', d => { avisos.push(d.message()); d.accept(); });
  await boot(page);
  await page.setInputFiles('#file-input-hosp', pdfs[0]);
  // parsing/import independem da janela de datas: confere o store direto. O import é assíncrono e
  // RECONSTRÓI o store (limpa→repopula); usa expect.poll (aguarda o callback async e repete) — um
  // waitForFunction(async ...) resolveria de imediato no Promise truthy e leria o store ainda vazio.
  await expect.poll(async () => page.evaluate(async () => (await window.dbGetAll('hospedados')).length),
    { timeout: 20000, intervals: [200, 300, 500, 500, 1000] }).toBeGreaterThan(0);
  const n = await page.evaluate(async () => (await window.dbGetAll('hospedados')).length);
  console.log(`[amostra real] hospedados extraídos: ${n}`);
  expect(n).toBeGreaterThan(0);
  expect(avisos.join(' ')).not.toContain('não conferem'); // não recusou o comandas real
});

test('v1.5.1.1 [real] Reservas de amostras/ → sem regressão (pendente até haver amostra)', async ({ page }) => {
  const pdfs = acharAmostras(/reserva|listagem/i);
  test.skip(pdfs.length === 0, 'Sem PDF de Reservas em amostras/ — validação com o real fica pendente das amostras.');
  await boot(page);
  await page.setInputFiles('#file-input', pdfs[0]);
  await page.waitForSelector('.cell-span', { timeout: 15000 });
  const n = await page.evaluate(() => document.querySelectorAll('#mapa-container .cell-span').length);
  expect(n).toBeGreaterThan(0);
});

test('v1.5.4 (5.2) fim do laranja: Carro 01/02 no bloco, cores pelo status, sem 👥', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1400 });
  await boot(page);
  await page.evaluate(() => {
    const pad = n => String(n).padStart(2, '0');
    const d = n => { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + n); return x; };
    const fb = x => `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${String(x.getFullYear()).slice(2)}`;
    const fs = x => `${pad(x.getDate())}/${pad(x.getMonth() + 1)}`;
    const ent = d(0), sai = d(4);
    const b = (nro, apto, obs, nome) => `${fb(ent)} ${fs(sai)} 1 2 ${apto} ABC ${nro} H\nWHATSAPP\nObs do Apto: ${obs}\nHóspedes :\n${nome}\n${nome}\nDesbravador Software`;
    // mesma reserva (50002) em 2 aptos: um confirmado (azul), outro aguardando (amarelo).
    const txt = [b('50001', '201', 'VERIFICAR INTERESSE', 'ANA AMARELA'), b('50002', '202', 'GARAGEM PEQUENO', 'GRUPO A'), b('50002', '203', 'VERIFICAR INTERESSE', 'GRUPO B')].join('\n');
    return window.importarPDF(window.parsear(txt));
  });
  await page.waitForSelector('.cell-span');
  // NADA laranja sobra
  await expect(page.locator('.cell-span.laranja')).toHaveCount(0);
  await expect(page.locator('.grupo-ico')).toHaveCount(0);
  // "Carro 01" e "Carro 02" DENTRO dos blocos da mesma reserva
  await expect(page.locator('.cell-span', { hasText: 'Carro 01' })).toHaveCount(1);
  await expect(page.locator('.cell-span', { hasText: 'Carro 02' })).toHaveCount(1);
  // status diferentes → cores diferentes: há bloco azul e bloco amarelo
  const info = await page.evaluate(() => {
    const g = el => el ? getComputedStyle(el).borderTopColor : null;
    return { az: g(document.querySelector('.cell-span.azul')), am: g(document.querySelector('.cell-span.amarelo')) };
  });
  expect(info.az).not.toBeNull();
  expect(info.am).not.toBeNull();
  expect(info.az).not.toBe(info.am);
});

test('v1.5.2 aviso de overbooking informa o período', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const pad = n => String(n).padStart(2, '0');
    const d = n => { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + n); return x; };
    const fb = x => `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${String(x.getFullYear()).slice(2)}`;
    const fs = x => `${pad(x.getDate())}/${pad(x.getMonth() + 1)}`;
    const ent = d(0), sai = d(2);
    const blocos = [];
    for (let i = 0; i < 35; i++) blocos.push(`${fb(ent)} ${fs(sai)} 1 2 ${800 + i} ABC ${43000 + i} H\nWHATSAPP\nObs do Apto: VERIFICAR\nHóspedes :\nH ${i}\nH ${i}\nDesbravador Software`);
    return window.importarPDF(window.parsear(blocos.join('\n')));
  });
  await page.waitForSelector('.cell-span');
  await expect(page.locator('#alert-over')).toBeVisible();
  await expect(page.locator('#alert-over')).toContainText('Overbooking em');
});

test('v1.5.2 obs "SEM DISPONIBILIDADE DE GARAGEM" → fora do mapa + aviso; nomes aparecem', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const pad = n => String(n).padStart(2, '0');
    const d = n => { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + n); return x; };
    const fb = x => `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${String(x.getFullYear()).slice(2)}`;
    const fs = x => `${pad(x.getDate())}/${pad(x.getMonth() + 1)}`;
    const ent = d(0), sai = d(4);
    const b = (nro, apto, obs, nome) => `${fb(ent)} ${fs(sai)} 1 2 ${apto} ABC ${nro} H\nWHATSAPP\nObs do Apto: ${obs}\nHóspedes :\n${nome}\n${nome}\nDesbravador Software`;
    const txt = [b('51001', '301', 'GARAGEM PEQUENO', 'JOANA NORMAL'), b('51002', '302', 'SEM DISPONIBILIDADE DE GARAGEM', 'PEDRO SEMVAGA')].join('\n');
    return window.importarPDF(window.parsear(txt));
  });
  await page.waitForSelector('.cell-span');
  await expect(page.locator('.cell-span', { hasText: 'JOANA NORMAL' })).toHaveCount(1); // nome aparece
  await expect(page.locator('.cell-span', { hasText: 'PEDRO SEMVAGA' })).toHaveCount(0); // fora do mapa
  await expect(page.locator('#avisos')).toContainText('indisponibilidade');
  await page.check('#chk-semgar');
  await expect(page.locator('.secao-semgar')).toContainText('PEDRO SEMVAGA');
});

// ════════ v1.5.3 — ferramentas ════════
function motoPDF() {
  const ent = dias(0), sai = dias(4);
  const b = (nro, apto, nome) => `${fmtBloco(ent)} ${fmtSai(sai)} 1 2 ${apto} ABC ${nro} H\nWHATSAPP\nObs do Apto: GARAGEM MOTO\nHóspedes :\n${nome}\n${nome}\nDesbravador Software`;
  return [b('60001', '101', 'MOTO UM'), b('60003', '103', 'MOTO SOLO')].join('\n');
}

test('v1.5.3 moto arrastável para vaga de carro (P6)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1600 });
  await boot(page);
  await page.evaluate((txt) => window.importarPDF(window.parsear(txt)), motoPDF());
  await page.waitForSelector('.cell-span.moto-c');
  await arrastar(page, 'MOTO SOLO', 'P6');
  await expect(page.locator('#mover-modal')).toBeVisible();
  await expect(page.locator('#mover-texto')).toContainText('moto');
  await page.click('#mover-confirmar');
  await expect(page.locator('.row-cells[data-vaga="P6"] .cell-span', { hasText: 'MOTO SOLO' })).toHaveCount(1);
});

test('v1.5.3 busca destaca, conta e escurece; limpar remove', async ({ page }) => {
  await boot(page);
  await importar(page);
  await page.fill('#busca-input', 'CARLA');
  await expect(page.locator('#mapa-wrapper')).toHaveClass(/busca-ativa/);
  await expect(page.locator('.cell-span.busca-atual')).toHaveCount(1);
  await expect(page.locator('#busca-info')).toContainText('1 de');
  await page.click('#busca-clear');
  await expect(page.locator('#mapa-wrapper')).not.toHaveClass(/busca-ativa/);
});

test('v1.5.3 adicionar reserva manual pelo formulário → aparece no mapa (✍️)', async ({ page }) => {
  await boot(page);
  await importar(page);
  await page.click('.btn-add');
  await expect(page.locator('#add-modal')).toBeVisible();
  const iso = (n) => { const d = dias(n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  await page.fill('#add-nome', 'MANUAL TESTE');
  await page.fill('#add-entrada', iso(0));
  await page.fill('#add-saida', iso(3));
  await page.selectOption('#add-tipo', 'P');
  await page.fill('#add-apto', '999');
  await page.click('#add-modal button:has-text("Adicionar")');
  await expect(page.locator('.cell-span', { hasText: 'MANUAL TESTE' })).toHaveCount(1);
  await expect(page.locator('.cell-span .manual-ico').first()).toBeVisible();
});

test('v1.5.3 reserva manual que não cabe → oferece vaga extra; extra aparece', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 2600 });
  await boot(page);
  // lota TODAS as vagas (18 P + 14 G = 32) com carros no mesmo período
  await page.evaluate(() => {
    const pad = n => String(n).padStart(2, '0');
    const d = n => { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + n); return x; };
    const fb = x => `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${String(x.getFullYear()).slice(2)}`;
    const fs = x => `${pad(x.getDate())}/${pad(x.getMonth() + 1)}`;
    const ent = d(0), sai = d(3);
    const blocos = [];
    for (let i = 0; i < 32; i++) blocos.push(`${fb(ent)} ${fs(sai)} 1 2 ${200 + i} ABC ${70000 + i} H\nWHATSAPP\nObs do Apto: GARAGEM GRANDE\nHóspedes :\nLOTA ${i}\nLOTA ${i}\nDesbravador Software`);
    return window.importarPDF(window.parsear(blocos.join('\n')));
  });
  await page.waitForSelector('.cell-span');
  const iso = (n) => { const d = dias(n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  await page.click('.btn-add');
  await page.fill('#add-nome', 'NAO COUBE');
  await page.fill('#add-entrada', iso(0));
  await page.fill('#add-saida', iso(3));
  await page.selectOption('#add-tipo', 'G');
  await page.click('#add-modal button:has-text("Adicionar")');
  await expect(page.locator('#extra-modal')).toBeVisible();
  await expect(page.locator('#extra-texto')).toContainText('vaga extra');
  await page.click('#extra-confirmar');
  await expect(page.locator('.secao-extra')).toContainText('NAO COUBE');
});

test('v1.5.3 painel de edições manuais lista adições e status', async ({ page }) => {
  await boot(page);
  await importar(page);
  await page.evaluate(async () => {
    await window.salvarStatusManual('30003', 'sem_garagem');
    const rec = window.montarReservaManual({ nome: 'ADD PANEL', tipo: 'P', entrada: new Date(), saida: new Date(Date.now() + 3 * 864e5) }, { funcionario: 'Doug', dataHora: new Date().toISOString() });
    await window.salvarReservaManual(rec);
  });
  await page.click('text=✍️ Edições');
  await expect(page.locator('#edicoes-modal')).toBeVisible();
  await expect(page.locator('#edicoes-corpo')).toContainText('Reserva adicionada');
  await expect(page.locator('#edicoes-corpo')).toContainText('Sem garagem');
});

test('screenshots do mapa, contato e gestão (v1.5.4)', async ({ page }) => {
  await boot(page);
  await importar(page);
  await importarComandas(page);
  await page.screenshot({ path: path.join(os.homedir(), 'Desktop', 'v1.5.4-mapa.png'), fullPage: true });
  await page.click('#tab-contato');
  await page.waitForSelector('.ct-item');
  await page.screenshot({ path: path.join(os.homedir(), 'Desktop', 'v1.5.4-contato.png'), fullPage: true });
  await page.click('#tab-gestao');
  await page.waitForSelector('.gestao-wrap');
  await page.screenshot({ path: path.join(os.homedir(), 'Desktop', 'v1.5.4-gestao.png'), fullPage: true });
});

// ════════ v1.5.4 — checkbox editadas, vaga extra pelo status, destaque persistente ════════

test('v1.5.4 (5.3) checkbox renomeado; área lista incluída manual (segue no mapa) + status', async ({ page }) => {
  await boot(page);
  await importar(page);
  await expect(page.locator('.chk-semgar')).toContainText('editadas manualmente');
  // status manual + reserva incluída manualmente
  await page.evaluate(async () => {
    await window.salvarStatusManual('30001', 'confirmado');
    const rec = window.montarReservaManual({ nome: 'INCLUI MANUAL', tipo: 'P', entrada: new Date(), saida: new Date(Date.now() + 3 * 864e5), apto: '888' }, { funcionario: 'Doug', dataHora: new Date().toISOString() });
    await window.salvarReservaManual(rec);
  });
  await page.check('#chk-semgar');
  const area = page.locator('.secao-semgar');
  await expect(area).toContainText('Editadas manualmente');
  await expect(area).toContainText('INCLUI MANUAL');
  await expect(area).toContainText('Incluída manualmente');
  await expect(area).toContainText('no mapa'); // adicionada manualmente CONTINUA no mapa
  // a incluída manualmente também aparece no mapa
  await expect(page.locator('.cell-span', { hasText: 'INCLUI MANUAL' })).toHaveCount(1);
});

test('v1.5.4 (5.4) VIA DE ACESSO: "Vaga extra" no menu de status de reserva em overbooking (sem extra em uso)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 2600 });
  await boot(page);
  // lota 32 vagas + 1 excedente → overbooking, com NENHUMA vaga extra em uso
  await page.evaluate(() => {
    const pad = n => String(n).padStart(2, '0');
    const d = n => { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + n); return x; };
    const fb = x => `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${String(x.getFullYear()).slice(2)}`;
    const fs = x => `${pad(x.getDate())}/${pad(x.getMonth() + 1)}`;
    const ent = d(0), sai = d(3);
    const blocos = [];
    for (let i = 0; i < 33; i++) blocos.push(`${fb(ent)} ${fs(sai)} 1 2 ${200 + i} ABC ${71000 + i} H\nWHATSAPP\nObs do Apto: GARAGEM GRANDE\nHóspedes :\nOVER ${i}\nOVER ${i}\nDesbravador Software`);
    return window.importarPDF(window.parsear(blocos.join('\n')));
  });
  await page.waitForSelector('.secao-titulo:has-text("Overbooking")');
  // nenhuma seção de vaga extra ainda (nenhuma em uso)
  await expect(page.locator('.secao-extra')).toHaveCount(0);
  // abre o detalhe de uma reserva em overbooking (na seção de overbooking)
  const overCell = page.locator('.secao-bloco', { has: page.locator('.secao-titulo:has-text("Overbooking")') }).locator('.cell-span').first();
  await overCell.click();
  await expect(page.locator('#detalhe-modal')).toBeVisible();
  // a opção "Vaga extra" está ALCANÇÁVEL no menu de status mesmo sem nenhuma extra em uso
  await expect(page.locator('#detalhe-modal .status-sel option', { hasText: 'Vaga extra' })).toHaveCount(1);
  // escolhê-la coloca a reserva na vaga extra (seção aparece) sem virar "sem garagem"
  await page.locator('#detalhe-modal .status-sel').selectOption('__extra__');
  await expect(page.locator('.secao-extra')).toContainText('OVER');
});

test('v1.5.4 (5.5) destaque persiste após fechar o detalhe; pan NÃO limpa; clique no vazio limpa', async ({ page }) => {
  await boot(page);
  await importar(page);
  const alvo = page.locator('.cell-span', { hasText: 'ANA PEQUENA' }).first();
  await alvo.click();
  await expect(page.locator('#detalhe-modal')).toBeVisible();
  // fecha o detalhe → destaque PERMANECE
  await page.click('#detalhe-modal .btn-primary:has-text("Fechar")');
  await expect(page.locator('#detalhe-modal')).toBeHidden();
  await expect(page.locator('.cell-span.destaque-clique')).toHaveCount(1);
  await expect(page.locator('.cell-span.destaque-clique')).toContainText('ANA PEQUENA');
  // arrastar o fundo (pan) NÃO limpa o destaque
  const wrap = page.locator('#mapa-wrapper');
  const box = await wrap.boundingBox();
  await page.mouse.move(box.x + box.width - 40, box.y + box.height - 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y + box.height - 20, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.cell-span.destaque-clique')).toHaveCount(1);
  // clicar em OUTRA reserva move o destaque (só uma)
  await page.locator('.cell-span', { hasText: 'BRUNO GRANDE' }).first().click();
  await page.click('#detalhe-modal .btn-primary:has-text("Fechar")');
  await expect(page.locator('.cell-span.destaque-clique')).toHaveCount(1);
  await expect(page.locator('.cell-span.destaque-clique')).toContainText('BRUNO GRANDE');
});

/* ════════════════════════ v1.5.5 ════════════════════════ */
const snapMapa = (page) => page.evaluate(() => { const m = {}; document.querySelectorAll('#mapa-container .cell-span[data-nro]').forEach(s => { const wr = s.closest('[data-vaga]'); if (wr && s.dataset.nro) m[s.dataset.nro] = wr.dataset.vaga; }); return m; });

test('v1.5.5 (6.2) CENTRAL: arrastar 1 p/ vaga livre não move NENHUMA outra (snapshot antes×depois)', async ({ page }) => {
  await boot(page);
  await importar(page);
  const antes = await snapMapa(page);
  const usadas = new Set(Object.values(antes));
  let livre = null; for (let k = 1; k <= 18; k++) { if (!usadas.has('P' + k)) { livre = 'P' + k; break; } }
  expect(livre).toBeTruthy();
  await arrastar(page, 'ANA PEQUENA', livre);
  await expect(page.locator('#mover-modal')).toBeVisible();
  await page.click('#mover-confirmar');
  await expect(page.locator(`.row-cells[data-vaga="${livre}"] .cell-span`, { hasText: 'ANA PEQUENA' })).toHaveCount(1);
  const depois = await snapMapa(page);
  expect(depois['30001']).toBe(livre); // ANA moveu
  for (const nro of Object.keys(antes)) { if (nro !== '30001') expect(depois[nro], nro + ' não pode se mover').toBe(antes[nro]); }
});

test('v1.5.5 (6.2) soltar EM CIMA de outra: só a conflitante reacomoda; as demais ficam', async ({ page }) => {
  await boot(page);
  await importar(page);
  const antes = await snapMapa(page);
  const vagaCarla = antes['30003']; // vaga da CARLA (amarela, P), que sobrepõe o período da ANA
  expect(vagaCarla && /^P\d+$/.test(vagaCarla)).toBeTruthy();
  await arrastar(page, 'ANA PEQUENA', vagaCarla); // solta ANA em cima da CARLA
  await expect(page.locator('#mover-modal')).toBeVisible();
  await expect(page.locator('#mover-conflito')).toBeVisible(); // avisa o conflito
  await page.click('#mover-confirmar');
  // aguarda o re-render (o handler é assíncrono) — ANA assume a vaga da CARLA
  await expect(page.locator(`.row-cells[data-vaga="${vagaCarla}"] .cell-span`, { hasText: 'ANA PEQUENA' })).toHaveCount(1);
  const depois = await snapMapa(page);
  expect(depois['30001']).toBe(vagaCarla);            // ANA assume a vaga
  expect(depois['30003']).not.toBe(vagaCarla);        // CARLA (conflitante) reacomodou
  expect(depois['30002']).toBe(antes['30002']);       // BRUNO (não envolvido) intacto
  expect(depois['30004']).toBe(antes['30004']);       // DAVI (não envolvido) intacto
});

test('v1.5.5 (6.3) seletor de status do detalhe visível por inteiro (janela baixa / mobile)', async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 560 });
  await boot(page);
  await importar(page);
  await page.locator('.cell-span', { hasText: 'CARLA AMARELA' }).first().click();
  await expect(page.locator('#detalhe-modal')).toBeVisible();
  const card = page.locator('#detalhe-modal .modal-card');
  const cb = await card.boundingBox();
  expect(cb.height).toBeLessThanOrEqual(page.viewportSize().height); // card cabe na viewport (não estoura)
  const sel = page.locator('#detalhe-corpo .status-sel');
  await expect(sel).toHaveCount(1);
  await sel.scrollIntoViewIfNeeded();
  await expect(sel).toBeInViewport();                 // rolou por dentro e ficou visível (não cortado)
  await sel.selectOption('confirmado');               // e é utilizável
});

test('v1.5.5 (6.8) fila do Contato: só Aguardando → colar telefone → WhatsApp SEM 55 → contatado', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => { window.gestaoSetEmpresa('Hotel Gumz'); window.gestaoAddFuncionario(); const f = window.getGestaoConfig().funcionarios[0].id; window.gestaoSetFuncNome(f, 'Doug'); });
  await importar(page);
  await page.click('#tab-contato');
  // só Aguardando na fila: CARLA (amarela) presente; confirmadas fora
  await expect(page.locator('.ct-item[data-nro="30003"]')).toHaveCount(1);
  await expect(page.locator('.ct-item[data-nro="30001"]')).toHaveCount(0);
  // sem telefone → botão "Abrir WhatsApp" desabilitado
  await expect(page.locator('.ct-item[data-nro="30003"] .wa-btn.disabled')).toHaveCount(1);
  // cola número internacional (com +) e confirma
  await page.fill('#fone-30003', '+1 347 555 1234');
  await page.click('#btn-fone-30003');
  // mensagem montada pela Gestão + link wa.me com os dígitos como vieram (NUNCA injeta 55)
  await page.locator('.ct-item[data-nro="30003"] .wa-btn', { hasText: 'Mensagem' }).click();
  await expect(page.locator('#envio-modal')).toBeVisible();
  const href = await page.locator('#envio-enviar').getAttribute('href');
  expect(href).toContain('wa.me/13475551234');
  expect(href).not.toContain('5513475551234');
  // dispara → registra envio → linha marcada "contatado" (reenvio segue permitido)
  await page.click('#envio-enviar');
  await expect(page.locator('.ct-item[data-nro="30003"]')).toHaveClass(/enviado/);
  await expect(page.locator('.ct-item[data-nro="30003"] .status-env')).toContainText('contatado');
});
