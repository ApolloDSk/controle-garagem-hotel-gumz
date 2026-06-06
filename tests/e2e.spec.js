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

test('smoke: carrega, rodapé v1.4.0, abas (Mapa/Contato/Gestão)', async ({ page }) => {
  await boot(page);
  await expect(page.locator('#footer-version')).toHaveText('v1.4.0');
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
  await page.setViewportSize({ width: 760, height: 520 }); // força overflow horizontal e vertical
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

test('screenshots do mapa, contato e gestão (v1.4.0)', async ({ page }) => {
  await boot(page);
  await importar(page);
  await page.screenshot({ path: path.join(os.homedir(), 'Desktop', 'v1.4.0-mapa.png'), fullPage: true });
  await page.click('#tab-contato');
  await page.waitForSelector('.ct-item');
  await page.screenshot({ path: path.join(os.homedir(), 'Desktop', 'v1.4.0-contato.png'), fullPage: true });
  await page.click('#tab-gestao');
  await page.waitForSelector('.gestao-wrap');
  await page.screenshot({ path: path.join(os.homedir(), 'Desktop', 'v1.4.0-gestao.png'), fullPage: true });
});
