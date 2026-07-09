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
  await expect(page.locator('#footer-version')).toHaveText('v1.5.1.1');
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
  // editor de status presente no Contato
  const sel = page.locator('.ct-item[data-nro="30001"] .status-sel');
  await expect(sel).toHaveCount(1);
  await sel.selectOption('sem_garagem');
  // some do mapa
  await expect(page.locator('#mapa-container .cell-span', { hasText: 'ANA PEQUENA' })).toHaveCount(0);
  // área "Sem garagem (manual)" oculta até ligar o checkbox
  await page.click('#tab-mapa');
  await expect(page.locator('.secao-semgar')).toHaveCount(0);
  await page.check('#chk-semgar');
  await expect(page.locator('.secao-semgar')).toContainText('ANA PEQUENA');
  // voltar status (confirmado) → reserva retorna ao mapa
  await page.locator('.secao-semgar .status-sel').selectOption('confirmado');
  await expect(page.locator('#mapa-container .cell-span', { hasText: 'ANA PEQUENA' })).toHaveCount(1);
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
  await expect(page.locator('#mover-texto')).toContainText('do');
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
  // parsing/import independem da janela de datas: confere o store direto
  await page.waitForFunction(async () => (await window.dbGetAll('hospedados')).length > 0, null, { timeout: 15000 });
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

test('screenshots do mapa, contato e gestão (v1.5.1)', async ({ page }) => {
  await boot(page);
  await importar(page);
  await importarComandas(page);
  await page.screenshot({ path: path.join(os.homedir(), 'Desktop', 'v1.5.1-mapa.png'), fullPage: true });
  await page.click('#tab-contato');
  await page.waitForSelector('.ct-item');
  await page.screenshot({ path: path.join(os.homedir(), 'Desktop', 'v1.5.1-contato.png'), fullPage: true });
  await page.click('#tab-gestao');
  await page.waitForSelector('.gestao-wrap');
  await page.screenshot({ path: path.join(os.homedir(), 'Desktop', 'v1.5.1-gestao.png'), fullPage: true });
});
