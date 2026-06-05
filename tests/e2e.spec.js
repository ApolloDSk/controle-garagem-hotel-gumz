/*
 * Testes E2E (Playwright + Chromium, navegador real, servido por HTTP) — Reserva de Garagem v1.1.0.
 *   npx playwright test
 */
const { test, expect } = require('@playwright/test');
const os = require('os');
const path = require('path');

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

async function boot(page) {
  await page.goto('/index.html');
  await page.waitForFunction(() => /salvo|mem/.test(document.getElementById('db-chip').textContent));
}
async function importar(page) {
  await page.evaluate(async (txt) => { await window.importarPDF(window.parsear(txt)); }, montarPDF());
  await page.waitForSelector('.cell-span');
}

test('smoke: carrega, rodapé v1.2.0, abas (Mapa/Contato/Gestão)', async ({ page }) => {
  await boot(page);
  await expect(page.locator('#footer-version')).toHaveText('v1.2.0');
  await expect(page.locator('#tab-mapa')).toContainText('Mapa de Reservas');
  await expect(page.locator('#tab-mapa svg.tab-ico')).toHaveCount(1);
  await expect(page.locator('#tab-contato svg.tab-ico.wa')).toHaveCount(1);
  await expect(page.locator('#tab-gestao')).toContainText('Gestão');
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
  await expect(prev).toHaveValue(/CARLA/);
  await expect(prev).toHaveValue(/Hotel Gumz/);
  await expect(prev).not.toHaveValue(/\[nome\]/);
  // troca para Modelo 2
  await page.locator('.envio-mbtn', { hasText: 'Modelo 2' }).click();
  await expect(prev).toHaveValue('Segundo modelo: olá CARLA AMARELA');
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

test('screenshots do mapa, contato e gestão (v1.2.0)', async ({ page }) => {
  await boot(page);
  await importar(page);
  await page.screenshot({ path: path.join(os.homedir(), 'Desktop', 'v1.2.0-mapa.png'), fullPage: true });
  await page.click('#tab-contato');
  await page.waitForSelector('.ct-item');
  await page.screenshot({ path: path.join(os.homedir(), 'Desktop', 'v1.2.0-contato.png'), fullPage: true });
  await page.click('#tab-gestao');
  await page.waitForSelector('.gestao-wrap');
  await page.screenshot({ path: path.join(os.homedir(), 'Desktop', 'v1.2.0-gestao.png'), fullPage: true });
});
