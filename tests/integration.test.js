/*
 * Testes de INTEGRAÇÃO (jsdom + fake-indexeddb) — Reserva de Garagem.
 * Carrega o garagem-app/index.html num DOM real simulado, com IndexedDB e localStorage,
 * e exercita o app de ponta a ponta (sem navegador): import → render → contato →
 * persistência + os novos recursos da v1.1.0 (cópia, telefone Confirmar↔Editar,
 * ordenação, info de upload, recorte de check-in no passado).
 *
 *   node tests/integration.test.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const fidb = require('fake-indexeddb');

let pass = 0, fail = 0; const fails = [];
function eq(a, b, m) { if (a !== b) throw new Error((m ? m + ' — ' : '') + `esperado ${JSON.stringify(b)}, recebeu ${JSON.stringify(a)}`); }
function ok(c, m) { if (!c) throw new Error(m || 'condição falsa'); }
async function T(name, fn) { try { await fn(); pass++; } catch (e) { fail++; fails.push(name + ': ' + e.message); } }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── datas relativas a hoje (determinístico em qualquer dia) ──
function pad(n) { return String(n).padStart(2, '0'); }
function fmtBloco(d) { return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`; }
function fmtSai(d) { return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; }
function diasDeHoje(n) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d; }

function bloco(nro, ent, sai, apto, origem, obs, hosp) {
  return `${fmtBloco(ent)} ${fmtSai(sai)} 1 2 ${apto} ABC ${nro} H
${origem}
Obs do Apto: ${obs}
Hóspedes :
${hosp}
${hosp}
Desbravador Software`;
}

function montarPDF() {
  const ontem = diasDeHoje(-2), depois = diasDeHoje(3), hoje = diasDeHoje(0), maisTarde = diasDeHoje(5);
  return [
    bloco('30001', hoje, maisTarde, '201', 'WHATSAPP', 'GARAGEM PEQUENO', 'ANA PEQUENA'),
    bloco('30002', hoje, maisTarde, '202', 'BOOKING 413101ID20542561', 'GARAGEM GRANDE', 'BRUNO GRANDE'),
    bloco('30003', hoje, maisTarde, '203', 'EXPEDIA', 'SEM INFO DE GARAGEM AQUI VERIFICAR', 'CARLA AMARELA'),
    bloco('30004', ontem, depois, '204', 'WHATSAPP', 'GARAGEM PEQUENO', 'DAVI PASSADO'),
  ].join('\n');
}

async function novoApp() {
  // IndexedDB limpo a cada app
  const idb = new fidb.IDBFactory();
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname, '..', 'garagem-app', 'index.html'), 'utf8'), {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/',
    beforeParse(window) {
      window.indexedDB = idb;
      window.IDBKeyRange = fidb.IDBKeyRange;
      window.pdfjsLib = { GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.resolve({ numPages: 0, getPage: () => { } }) }) };
      window.alert = () => { };
      if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addListener() { }, removeListener() { } });
    }
  });
  const w = dom.window;
  // espera o init() (abrirDB + setDbChip) assentar
  for (let i = 0; i < 60; i++) { if (/salvo|mem/.test(w.document.getElementById('db-chip').textContent)) break; await sleep(15); }
  await sleep(30);
  return { dom, w };
}

(async () => {
  /* ── 1. boot + IndexedDB ── */
  await T('app inicializa e abre IndexedDB (chip "salvo")', async () => {
    const { w } = await novoApp();
    ok(/salvo/.test(w.document.getElementById('db-chip').textContent), 'chip deveria indicar persistência');
  });

  await T('rodapé mostra v1.1.0', async () => {
    const { w } = await novoApp();
    eq(w.document.getElementById('footer-version').textContent, 'v1.1.0');
  });

  /* ── 2. abas com novos rótulos/ícones (5.1) ── */
  await T('aba Mapa de Reservas com ícone (calendário)', async () => {
    const { w } = await novoApp();
    const tab = w.document.getElementById('tab-mapa');
    ok(/Mapa de Reservas/.test(tab.textContent), 'rótulo deve ser "Mapa de Reservas"');
    ok(tab.querySelector('svg.tab-ico'), 'deve ter ícone SVG');
  });
  await T('aba Contato com ícone do WhatsApp', async () => {
    const { w } = await novoApp();
    const tab = w.document.getElementById('tab-contato');
    ok(tab.querySelector('svg.tab-ico.wa'), 'deve ter ícone WhatsApp (classe .wa)');
  });

  /* ── 3. import + render do mapa ── */
  await T('importa PDF e renderiza seções do mapa', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(30);
    const titulos = [...w.document.querySelectorAll('.secao-titulo')].map(e => e.textContent);
    ok(titulos.some(t => /Pequenos/.test(t)), 'seção pequenos');
    ok(titulos.some(t => /Grandes/.test(t)), 'seção grandes');
    ok(w.document.querySelectorAll('.cell-span').length >= 3, 'deve renderizar spans de reservas');
  });

  /* ── 4. check-in no passado: incluído + borda cortada (5.6) ── */
  await T('reserva com check-in no passado renderiza com classe cortado-esq', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(30);
    const cortados = [...w.document.querySelectorAll('.cell-span.cortado-esq')];
    ok(cortados.length >= 1, 'DAVI PASSADO (entrada ontem) deve ter borda cortada');
    const temFuturoSemCorte = [...w.document.querySelectorAll('.cell-span')].some(s => !s.classList.contains('cortado-esq'));
    ok(temFuturoSemCorte, 'reservas que entram dentro da janela NÃO são cortadas');
  });

  /* ── 5. contato: PMS + OTA copiáveis (5.2) ── */
  await T('aba Contato lista com badges PMS e OTA copiáveis', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    w.trocarAba('contato');
    const pms = w.document.querySelector('.ct-badge.pms.copyable');
    ok(pms, 'badge PMS deve ser copiável');
    ok(/copiarTexto/.test(pms.getAttribute('onclick') || ''), 'PMS clica em copiarTexto');
    const ota = w.document.querySelector('.ct-badge.ota.copyable');
    ok(ota, 'badge OTA (Booking #30002) deve ser copiável');
  });

  await T('copiarTexto mostra toast "Copiado!" (fallback file://)', async () => {
    const { w } = await novoApp();
    // sem navigator.clipboard → usa fallback execCommand (stubado)
    w.document.execCommand = () => true;
    const okc = await w.copiarTexto('30001');
    eq(okc, true);
    ok(/Copiado/.test(w.document.getElementById('copy-toast').textContent), 'toast deve aparecer');
  });

  /* ── 6. telefone Confirmar↔Editar (5.3) ── */
  await T('telefone: Confirmar bloqueia o campo e vira Editar; Editar desbloqueia', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    w.trocarAba('contato');
    const item = w.document.querySelector('.ct-item');
    const nro = item.dataset.nro;
    const inp = w.document.getElementById('fone-' + nro);
    ok(!inp.readOnly, 'inicialmente editável');
    inp.value = '47998765432';
    await w.confirmarTelefone(nro);              // salva → re-render bloqueado
    await sleep(10);
    const inp2 = w.document.getElementById('fone-' + nro);
    const btn2 = w.document.getElementById('btn-fone-' + nro);
    ok(inp2.readOnly, 'após Confirmar o campo fica bloqueado');
    eq(btn2.textContent, 'Editar');
    eq(inp2.value, '47998765432', 'valor persistido permanece inalterado');
    w.acaoTelefone(nro);                          // Editar → desbloqueia
    const inp3 = w.document.getElementById('fone-' + nro);
    const btn3 = w.document.getElementById('btn-fone-' + nro);
    ok(!inp3.readOnly, 'após Editar o campo desbloqueia');
    eq(btn3.textContent, 'Confirmar');
  });

  /* ── 7. ordenação inverte a EXIBIÇÃO (5.4) ── */
  await T('toggleOrdemVagas inverte a ordem visível das linhas e persiste', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    const labelsAntes = [...w.document.querySelectorAll('.row-label')].map(e => e.textContent);
    w.toggleOrdemVagas();
    await sleep(10);
    const labelsDepois = [...w.document.querySelectorAll('.row-label')].map(e => e.textContent);
    ok(JSON.stringify(labelsAntes) !== JSON.stringify(labelsDepois), 'a ordem visível deve mudar');
    eq(w.localStorage.getItem('garagem_ordem_vagas'), 'baixo', 'preferência persistida');
    // primeira seção: o primeiro rótulo de antes deve aparecer por último depois (dentro da seção)
    eq(labelsDepois[0], 'P18', 'com baixo→cima, P18 aparece no topo da seção pequena');
  });

  await T('preferência de ordenação é relida ao reabrir', async () => {
    const { w } = await novoApp();
    w.localStorage.setItem('garagem_ordem_vagas', 'baixo');
    w.carregarOrdemVagas();
    w.atualizarBtnOrdem();
    ok(/baixo→cima/.test(w.document.getElementById('ordem-label').textContent), 'rótulo deve refletir a preferência salva');
  });

  /* ── 8. info de upload (5.5) ── */
  await T('info de upload persiste {nomeArquivo,dataHoraUpload} e exibe data/hora', async () => {
    const { w } = await novoApp();
    w.salvarUploadInfo(w.montarUploadInfo({ name: 'LISTAGEM RESERVA.pdf' }, new Date(2026, 5, 5, 9, 7).getTime()));
    const el = w.document.getElementById('upload-info');
    ok(el.style.display !== 'none', 'info visível');
    ok(/05\/06\/2026 09:07/.test(el.textContent), 'mostra data/hora');
    const salvo = JSON.parse(w.localStorage.getItem('garagem_upload_info'));
    eq(salvo.nomeArquivo, 'LISTAGEM RESERVA.pdf');
  });
  await T('clicar na info mostra o nome do arquivo; caminho indisponível não quebra', async () => {
    const { w } = await novoApp();
    w.salvarUploadInfo(w.montarUploadInfo({ name: 'x.pdf' }, Date.now()));
    w.toggleUploadInfoDetalhe();
    const el = w.document.getElementById('upload-info');
    ok(/x\.pdf/.test(el.textContent), 'mostra o nome do arquivo');
    ok(/indisponível/.test(el.textContent), 'nota de caminho indisponível (navegador)');
  });
  await T('info de upload é relida ao reabrir o app', async () => {
    const { w } = await novoApp();
    w.localStorage.setItem('garagem_upload_info', JSON.stringify({ nomeArquivo: 'reaberto.pdf', dataHoraUpload: new Date(2026, 0, 2, 3, 4).getTime(), caminho: '' }));
    w.carregarUploadInfo();
    w.renderUploadInfo();
    ok(/02\/01\/2026 03:04/.test(w.document.getElementById('upload-info').textContent));
  });

  /* ── 9. persistência: reabrir traz reservas + telefone (mesclagem não-destrutiva) ── */
  await T('persistência: reabrir mantém reservas e telefone (mesmo IndexedDB)', async () => {
    const idb = new fidb.IDBFactory();
    const mk = async () => {
      const dom = new JSDOM(fs.readFileSync(path.join(__dirname, '..', 'garagem-app', 'index.html'), 'utf8'), {
        runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
        beforeParse(window) {
          window.indexedDB = idb; window.IDBKeyRange = fidb.IDBKeyRange;
          window.pdfjsLib = { GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.resolve({ numPages: 0 }) }) };
          window.alert = () => { };
        }
      });
      const w = dom.window;
      for (let i = 0; i < 60; i++) { if (/salvo|mem/.test(w.document.getElementById('db-chip').textContent)) break; await sleep(15); }
      await sleep(30); return w;
    };
    const w1 = await mk();
    await w1.importarPDF(w1.parsear(montarPDF()));
    await sleep(20);
    w1.trocarAba('contato');
    const nro = w1.document.querySelector('.ct-item').dataset.nro;
    w1.document.getElementById('fone-' + nro).value = '47912345678';
    await w1.confirmarTelefone(nro);
    await sleep(20);
    // reabre com o MESMO IndexedDB
    const w2 = await mk();
    await sleep(40);
    ok(w2.document.querySelectorAll('.cell-span').length >= 3, 'reservas carregadas do banco ao reabrir');
    w2.trocarAba('contato');
    const inp = w2.document.getElementById('fone-' + nro);
    ok(inp && inp.value === '47912345678', 'telefone preservado após reabrir');
    ok(inp.readOnly, 'telefone resolvido reabre bloqueado (estado Editar)');
  });

  /* ── 10. reimportar preserva telefone (mesclagem) ── */
  await T('reimportar PDF não apaga telefone (store contatos separado)', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20); w.trocarAba('contato');
    const nro = w.document.querySelector('.ct-item').dataset.nro;
    w.document.getElementById('fone-' + nro).value = '47900000000';
    await w.confirmarTelefone(nro);
    await sleep(20);
    await w.importarPDF(w.parsear(montarPDF())); // reimporta
    await sleep(20); w.trocarAba('contato');
    const inp = w.document.getElementById('fone-' + nro);
    eq(inp.value, '47900000000', 'telefone sobrevive à reimportação');
  });

  console.log(`\nINTEGRAÇÃO (jsdom + fake-indexeddb): ${pass}/${pass + fail} ✓`);
  if (fail) { console.log('\nFALHAS:'); fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
})();
