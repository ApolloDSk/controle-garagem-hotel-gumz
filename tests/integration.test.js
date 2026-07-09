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
function montarComandas(blocos) {
  const hoje = diasDeHoje(0), maisTarde = diasDeHoje(5), ontem = diasDeHoje(-2), depois = diasDeHoje(3);
  const list = blocos || [
    blocoComanda('501', 'HOSPEDE CARRO', hoje, maisTarde, 'BOOKING.COM', 'CARRO DE PASSEIO'),
    blocoComanda('502', 'HOSPEDE GRANDE', ontem, depois, '', 'CAMIONETE - BAIXA60,00'),
  ];
  return `HOTEL GUMZ                     Comandas em aberto - detalhado            Página:    1
Filtro: Lançadas até 31/12/3000 | Todas contas:sim |
` + list.join('\n');
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
  await aguardarBoot(w);
  return { dom, w };
}

// v1.4.0 — boot determinístico: aguarda a promessa de init() (window.__appReady), eliminando a
// corrida com o fim do init (carregarGestao/Ajustes/Envios/DoBanco) que tornava os testes flaky.
async function aguardarBoot(w) {
  for (let i = 0; i < 400; i++) { if (w.__appReady) break; await sleep(5); }
  try { await w.__appReady; } catch (e) { }
}

(async () => {
  /* ── 1. boot + IndexedDB ── */
  await T('app inicializa e abre IndexedDB (chip "salvo")', async () => {
    const { w } = await novoApp();
    ok(/salvo/.test(w.document.getElementById('db-chip').textContent), 'chip deveria indicar persistência');
  });

  await T('rodapé mostra v1.5.1.1', async () => {
    const { w } = await novoApp();
    eq(w.document.getElementById('footer-version').textContent, 'v1.5.1.1');
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
      await aguardarBoot(w); return w;
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

  /* ── 11. Gestão (v1.2.0) ── */
  await T('aba Gestão existe e abre com seções', async () => {
    const { w } = await novoApp();
    ok(w.document.getElementById('tab-gestao'), 'botão da aba Gestão');
    w.trocarAba('gestao');
    const html = w.document.getElementById('view-gestao').innerHTML;
    ok(/Empresa/.test(html) && /Funcionários/.test(html) && /Modelos de Mensagens/.test(html) && /Backup/.test(html), 'todas as seções presentes');
  });

  await T('migração cria store gestao e semeia, sem tocar reservas/contatos', async () => {
    const { w } = await novoApp();
    ok(Array.from(w.indexedDB ? [] : []) || true);
    const g = w.getGestaoConfig();
    ok(g && g.modelos.verificando[0].includes('[nome]'), 'gestao semeada');
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    ok(w.document.querySelectorAll('.cell-span').length >= 3, 'reservas intactas após gestao existir');
  });

  await T('Gestão persiste empresa e funcionário ao reabrir (mesmo IndexedDB)', async () => {
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
      await aguardarBoot(w); return w;
    };
    const w1 = await mk();
    w1.gestaoSetEmpresa('Hotel Gumz');
    w1.gestaoAddFuncionario();
    const fid = w1.getGestaoConfig().funcionarios[0].id;
    w1.gestaoSetFuncNome(fid, 'João');
    await w1.salvarGestao();
    await sleep(20);
    const w2 = await mk();
    const g = w2.getGestaoConfig();
    eq(g.empresa.nome, 'Hotel Gumz', 'empresa persistida');
    ok(g.funcionarios.some(f => f.nome === 'João'), 'funcionário persistido');
  });

  /* ── 12. Fluxo de envio (preview + troca + editar só este envio) ── */
  await T('envio: preview substituído (sem [nome] literal) p/ reserva amarela', async () => {
    const { w } = await novoApp();
    w.gestaoSetEmpresa('Hotel Gumz');
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    w.trocarAba('contato');
    w.abrirEnvio('30003'); // CARLA AMARELA (verificando)
    const txt = w.document.getElementById('envio-preview').value;
    ok(/Carla Amarela/.test(txt), 'nome substituído (formato de nome próprio v1.4.0)'); ok(/Hotel Gumz/.test(txt), 'empresa substituída');
    ok(!/\[nome\]|\[empresa\]|\[data\]|\[canal\]|\[funcionario\]/.test(txt), 'nenhuma chave literal');
    eq(w.document.getElementById('envio-modal').style.display, 'flex', 'modal aberto');
  });

  await T('envio: trocar Modelo 1↔2 re-substitui o texto', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    w.trocarAba('contato');
    w.gestaoSetModelo('verificando', 1, 'Segundo modelo para [nome]');
    w.abrirEnvio('30003');
    ok(w.document.getElementById('envio-modelos').style.display !== 'none', 'botões de modelo aparecem');
    w.envioTrocarModelo(1);
    eq(w.document.getElementById('envio-preview').value, 'Segundo modelo para Carla Amarela');
  });

  await T('envio: Editar muda só o preview e NÃO altera o modelo salvo', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    w.trocarAba('contato');
    const modeloAntes = w.getGestaoConfig().modelos.verificando[0];
    w.abrirEnvio('30003');
    w.envioToggleEditar();
    const ta = w.document.getElementById('envio-preview');
    ok(!ta.readOnly, 'preview editável');
    ta.value = 'TEXTO TOTALMENTE EDITADO';
    eq(w.getGestaoConfig().modelos.verificando[0], modeloAntes, 'modelo salvo permanece inalterado');
  });

  await T('envio: reserva azul/confirmada NÃO usa fluxo templado (link simples)', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    eq(w.categoriaReserva({ garagem: 'azul_pequeno' }), null);
  });

  /* ── 13. Autocomplete + chips (DOM) ── */
  await T('Gestão: chip insere a chave no textarea do modelo', async () => {
    const { w } = await novoApp();
    w.trocarAba('gestao');
    const ta = w.document.getElementById('modelo-verificando-1'); // slot vazio
    ta.value = ''; ta.selectionStart = 0;
    w.inserirChave('verificando', 1, '[nome]');
    eq(w.document.getElementById('modelo-verificando-1').value, '[nome]');
    eq(w.getGestaoConfig().modelos.verificando[1], '[nome]', 'persistido no estado');
  });

  /* ── 14. Backup ── */
  await T('Backup: importar Mesclar adiciona contatos ausentes e gestao se ausente', async () => {
    const { w } = await novoApp();
    w.gestaoSetEmpresa('Local Existente'); // config local relevante → mesclar não deve sobrescrever
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    const backup = {
      schema: 'reserva-garagem-backup/1', appVersion: 'v1.2.0', exportadoEm: Date.now(),
      stores: {
        contatos: [{ nro: '99999', telefone: '47900000000', telefoneStatus: 'resolvido' }],
        gestao: [{ id: 'config', empresa: { nome: 'Importada' }, funcionarios: [], funcionarioPadraoId: null, modelos: { verificando: ['v', '', ''], overbooking: ['o', '', ''] }, modeloPadrao: { verificando: 0, overbooking: 0 } }]
      }
    };
    await w.aplicarImport(backup, 'mesclar');
    await sleep(20);
    const cont = (await w.dbGetAll('contatos')).find(c => String(c.nro) === '99999');
    ok(cont && cont.telefone === '47900000000', 'contato importado');
    // gestao local relevante → mesclar NÃO sobrescreve
    eq(w.getGestaoConfig().empresa.nome, 'Local Existente', 'mesclar não sobrescreve gestao existente');
  });

  await T('Backup: importar Substituir repõe a gestao (com confirm stubado)', async () => {
    const { w } = await novoApp();
    w.confirm = () => true; // stub
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    const backup = {
      schema: 'reserva-garagem-backup/1', stores: {
        contatos: [],
        gestao: [{ id: 'config', empresa: { nome: 'Substituta' }, funcionarios: [{ id: 'a', nome: 'Z' }], funcionarioPadraoId: 'a', modelos: { verificando: ['x', '', ''], overbooking: ['y', '', ''] }, modeloPadrao: { verificando: 0, overbooking: 0 } }]
      }
    };
    await w.aplicarImport(backup, 'substituir');
    await sleep(10);
    eq(w.getGestaoConfig().empresa.nome, 'Substituta');
  });

  await T('Backup: arquivo inválido não quebra (mensagem)', async () => {
    const { w } = await novoApp();
    w.trocarAba('gestao');
    await w.aplicarImport({ schema: 'errado', stores: {} }, 'mesclar').catch(() => { });
    // backupValido bloqueia antes; simula o caminho do gestaoImportarArquivo:
    ok(!w.backupValido({ schema: 'errado' }), 'schema inválido detectado');
  });

  /* ── 15. Edição manual (v1.3.0) ── */
  await T('migração v3→v4 cria store envios sem perder reservas/contatos/gestao/ajustes', async () => {
    const { w } = await novoApp();
    let okAll = true;
    for (const s of ['reservas', 'contatos', 'gestao', 'ajustes', 'envios']) { try { await w.dbGetAll(s); } catch (e) { okAll = false; } }
    ok(okAll, 'todos os 5 stores acessíveis (envios criado, antigos intactos)');
  });

  await T('salvar ajuste fixa a reserva na vaga manual (✋) no mapa', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    await w.salvarAjuste('30001', 'P9'); // ANA PEQUENA → vaga P9
    await sleep(20);
    const linhaP9 = [...w.document.querySelectorAll('.row-cells[data-vaga="P9"] .cell-span')];
    ok(linhaP9.some(s => /ANA/.test(s.textContent)), 'reserva aparece na vaga P9');
    ok(linhaP9.some(s => s.classList.contains('tem-ajuste')), 'marcada com ajuste manual');
  });

  await T('ajuste persiste ao reabrir (mesmo IndexedDB)', async () => {
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
      await aguardarBoot(w); return w;
    };
    const w1 = await mk();
    await w1.importarPDF(w1.parsear(montarPDF()));
    await sleep(20);
    await w1.salvarAjuste('30002', 'G7');
    await sleep(20);
    const w2 = await mk();
    await sleep(40);
    const aj = (await w2.dbGetAll('ajustes')).find(a => String(a.nro) === '30002');
    ok(aj && aj.vagaIdManual === 'G7', 'ajuste persistido no banco');
    const linhaG7 = [...w2.document.querySelectorAll('.row-cells[data-vaga="G7"] .cell-span')];
    ok(linhaG7.some(s => /BRUNO/.test(s.textContent)), 'reserva reabre na vaga ajustada');
  });

  await T('reimport do PDF NÃO apaga ajustes (não-destrutivo)', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    await w.salvarAjuste('30001', 'P9');
    await sleep(20);
    await w.importarPDF(w.parsear(montarPDF())); // reimporta
    await sleep(20);
    const aj = (await w.dbGetAll('ajustes')).find(a => String(a.nro) === '30001');
    ok(aj && aj.vagaIdManual === 'P9', 'ajuste sobrevive à reimportação');
  });

  await T('voltar ao automático remove o ajuste', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    await w.salvarAjuste('30001', 'P9');
    await sleep(20);
    await w.removerAjuste('30001');
    await sleep(20);
    const aj = (await w.dbGetAll('ajustes')).find(a => String(a.nro) === '30001');
    ok(!aj, 'ajuste removido do banco');
    const linhaP9 = [...w.document.querySelectorAll('.row-cells[data-vaga="P9"] .cell-span')];
    ok(!linhaP9.some(s => s.classList.contains('tem-ajuste')), 'sem marcador de ajuste em P9');
  });

  await T('linhas de carro têm data-vaga; moto NÃO (v1.5.0: overbooking passa a ter)', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    ok(w.document.querySelector('.row-cells[data-vaga="P1"]'), 'P1 tem data-vaga');
    ok(w.document.querySelector('.row-cells[data-vaga="G1"]'), 'G1 tem data-vaga');
    const motoRow = [...w.document.querySelectorAll('.row-label')].find(e => /^M/.test(e.textContent));
    if (motoRow) { const wrap = motoRow.parentElement.querySelector('.row-cells'); ok(!wrap.dataset.vaga, 'moto não é arrastável'); }
  });

  /* ── v1.5.0 — Parte A: status manual editável + auditoria + divergência ── */
  await T('A3 salvarStatusManual grava statusManual + auditoria (funcionário + dataHora)', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    w.gestaoAddFuncionario(); await sleep(10);
    const fid = w.getGestaoConfig().funcionarios[0].id;
    w.gestaoSetFuncNome(fid, 'Douglas'); await sleep(10);
    await w.salvarStatusManual('30002', 'sem_garagem'); // BRUNO GRANDE → sem garagem
    await sleep(20);
    const aj = (await w.dbGetAll('ajustes')).find(a => String(a.nro) === '30002');
    ok(aj && aj.statusManual === 'sem_garagem', 'statusManual persistido');
    ok(aj.ultimaAlteracao && aj.ultimaAlteracao.funcionario === 'Douglas', 'grava nome-texto do funcionário');
    ok(aj.ultimaAlteracao.dataHora && !isNaN(new Date(aj.ultimaAlteracao.dataHora)), 'grava dataHora ISO');
  });

  await T('A2 sem_garagem tira a reserva do mapa; checkbox mostra a área', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    await w.salvarStatusManual('30001', 'sem_garagem'); // ANA PEQUENA
    await sleep(20);
    const noMapa = [...w.document.querySelectorAll('#mapa-container .cell-span')].some(s => /ANA PEQUENA/.test(s.textContent));
    ok(!noMapa, 'ANA saiu do mapa');
    // área "Sem garagem (manual)" só aparece com o checkbox ligado
    ok(!w.document.querySelector('.secao-semgar'), 'área oculta por padrão');
    const chk = w.document.getElementById('chk-semgar'); chk.checked = true; w.toggleSemGaragem();
    await sleep(20);
    const area = w.document.querySelector('.secao-semgar');
    ok(area && /ANA PEQUENA/.test(area.textContent), 'ANA listada na área Sem garagem');
  });

  await T('A6 voltar status (sem_garagem→confirmado) retorna a reserva ao mapa', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    await w.salvarStatusManual('30001', 'sem_garagem'); await sleep(20);
    await w.salvarStatusManual('30001', 'confirmado'); await sleep(20);
    const noMapa = [...w.document.querySelectorAll('#mapa-container .cell-span')].some(s => /ANA PEQUENA/.test(s.textContent));
    ok(noMapa, 'ANA voltou ao mapa');
  });

  await T('A4 statusManual persiste e SOBREVIVE à reimportação do PDF', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    await w.salvarStatusManual('30003', 'confirmado'); // CARLA AMARELA → confirmado (diverge do PDF)
    await sleep(20);
    await w.importarPDF(w.parsear(montarPDF())); // reimporta
    await sleep(20);
    const aj = (await w.dbGetAll('ajustes')).find(a => String(a.nro) === '30003');
    ok(aj && aj.statusManual === 'confirmado', 'statusManual sobrevive à reimportação');
  });

  await T('A6 divergência com o PMS é sinalizada no Contato', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    await w.salvarStatusManual('30003', 'confirmado'); // amarelo→confirmado diverge
    await sleep(20);
    w.trocarAba('contato'); await sleep(20);
    const item = w.document.querySelector('.ct-item[data-nro="30003"]');
    ok(item && item.querySelector('.pms-diverg-badge'), 'badge de divergência presente no Contato');
    ok(item.querySelector('.status-sel'), 'editor de status presente no Contato');
  });

  /* ── v1.5.0 — Parte D: arraste no overbooking (placement visual) ── */
  await T('D7 salvarAjuste OVERBOOKING move a reserva para a área de overbooking', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    await w.salvarAjuste('30001', 'OVERBOOKING'); // ANA → overbooking (visual)
    await sleep(20);
    const overRow = [...w.document.querySelectorAll('.row-cells[data-vaga="OVERBOOKING"] .cell-span')];
    ok(overRow.some(s => /ANA PEQUENA/.test(s.textContent)), 'ANA aparece no overbooking');
    // não muda o status efetivo (continua confirmado/azul de origem)
    const aj = (await w.dbGetAll('ajustes')).find(a => String(a.nro) === '30001');
    ok(aj && aj.vagaIdManual === 'OVERBOOKING' && aj.statusManual == null, 'placement gravado; status intacto');
  });

  await T('D9 placement OVERBOOKING sobrevive à reimportação; voltar limpa só o placement', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    await w.salvarStatusManual('30001', 'aguardando'); await sleep(10);
    await w.salvarAjuste('30001', 'OVERBOOKING'); await sleep(10);
    await w.importarPDF(w.parsear(montarPDF())); await sleep(20);
    let aj = (await w.dbGetAll('ajustes')).find(a => String(a.nro) === '30001');
    ok(aj && aj.vagaIdManual === 'OVERBOOKING' && aj.statusManual === 'aguardando', 'placement + status sobrevivem');
    await w.voltarAoAutomatico('30001'); await sleep(20);
    aj = (await w.dbGetAll('ajustes')).find(a => String(a.nro) === '30001');
    ok(aj && aj.vagaIdManual == null && aj.statusManual === 'aguardando', 'voltar limpa placement, mantém status');
  });

  /* ── 16. v1.4.0 — status "enviado" derivado + histórico/prancheta + seleção ── */
  await T('5.3 status "enviado" é derivado do histórico (não do telefone)', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    w.trocarAba('contato');
    // digitar/confirmar telefone NÃO marca "enviado"
    w.document.getElementById('fone-30003').value = '47998765432';
    await w.confirmarTelefone('30003');
    await sleep(10);
    const itemAntes = w.document.querySelector('.ct-item[data-nro="30003"]');
    ok(!itemAntes.classList.contains('enviado'), 'só telefone NÃO marca enviado');
    ok(!w.document.querySelector('.ct-item[data-nro="30003"] .ct-badge.status-env'), 'sem badge enviado antes do envio');
    // após registrar um envio → status enviado
    await w.registrarEnvio('30003', 'verificando', 0);
    await sleep(10);
    const itemDepois = w.document.querySelector('.ct-item[data-nro="30003"]');
    ok(itemDepois.classList.contains('enviado'), 'com ≥1 registro → enviado');
    ok(w.document.querySelector('.ct-item[data-nro="30003"] .ct-badge.status-env'), 'badge ✓ enviado aparece');
  });

  await T('5.4 registrarEnvio grava registro com nro/dataHora/funcionario/categoria/modelo', async () => {
    const { w } = await novoApp();
    w.gestaoSetEmpresa('Hotel Gumz');
    w.gestaoAddFuncionario();
    const fid = w.getGestaoConfig().funcionarios[0].id;
    w.gestaoSetFuncNome(fid, 'João');
    await w.salvarGestao();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    await w.registrarEnvio('30003', 'verificando', 1);
    await sleep(10);
    const regs = (await w.dbGetAll('envios')).filter(e => String(e.nro) === '30003');
    eq(regs.length, 1, 'um registro gravado');
    eq(regs[0].funcionario, 'João', 'grava o NOME-texto do funcionário padrão');
    eq(regs[0].categoria, 'verificando'); eq(regs[0].modelo, 1);
    ok(/^\d{4}-\d{2}-\d{2}T/.test(regs[0].dataHora), 'dataHora em ISO');
  });

  await T('5.4 prancheta reflete a reserva selecionada (data/hora/funcionário) + estado vazio', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    w.trocarAba('contato');
    // sem seleção → prancheta oculta
    const pr = w.document.getElementById('prancheta-contato');
    w.ativarContato('30001');
    ok(pr.style.display !== 'none', 'prancheta visível ao selecionar');
    ok(/Nenhum envio registrado/.test(pr.textContent), 'estado vazio amigável');
    await w.registrarEnvio('30001', 'confirmado', null);
    await sleep(10);
    w.ativarContato('30001');
    ok(!/Nenhum envio registrado/.test(pr.textContent), 'após envio, lista registro');
    ok(w.document.querySelector('#prancheta-contato .pr-item'), 'item de envio na prancheta');
  });

  await T('5.4 prancheta aparece no detalhe da reserva (Mapa)', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    await w.registrarEnvio('30001', 'confirmado', null);
    await sleep(10);
    const res = w.ativasNoPeriodo().find(r => r.nro === '30001');
    w.abrirDetalheReserva(res);
    const modal = w.document.getElementById('detalhe-modal');
    ok(/flex/.test(modal.style.display), 'detalhe aberto');
    ok(w.document.querySelector('#detalhe-prancheta'), 'prancheta presente no detalhe');
    ok(w.document.querySelector('#detalhe-prancheta .pr-item'), 'registro listado no detalhe');
  });

  await T('5.5 detalhe: nº PMS e OTA são copiáveis', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    const res = w.ativasNoPeriodo().find(r => r.nro === '30002'); // Booking → tem OTA
    w.abrirDetalheReserva(res);
    const corpo = w.document.getElementById('detalhe-corpo');
    const copiaveis = [...corpo.querySelectorAll('.copyable')].map(e => e.getAttribute('onclick') || '');
    ok(copiaveis.some(o => /copiarTexto\('30002'\)/.test(o)), 'nº PMS copiável');
    ok(copiaveis.some(o => /copiarTexto\('413101ID20542561'\)/.test(o)), 'localizador OTA copiável');
  });

  await T('5.4 envios persistem ao reabrir; reimport do PDF NÃO apaga', async () => {
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
      const w = dom.window; await aguardarBoot(w); return w;
    };
    const w1 = await mk();
    await w1.importarPDF(w1.parsear(montarPDF()));
    await sleep(20);
    await w1.registrarEnvio('30001', 'confirmado', null);
    await sleep(20);
    await w1.importarPDF(w1.parsear(montarPDF())); // reimporta
    await sleep(20);
    ok((await w1.dbGetAll('envios')).some(e => String(e.nro) === '30001'), 'envio sobrevive à reimportação');
    const w2 = await mk(); // reabre mesmo IndexedDB
    await sleep(20);
    ok((await w2.dbGetAll('envios')).some(e => String(e.nro) === '30001'), 'envio persiste ao reabrir');
  });

  await T('5.2 clicar em qualquer parte do item seleciona a reserva', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    w.trocarAba('contato');
    const item = w.document.querySelector('.ct-item[data-nro="30002"]');
    // clicar na área de meta (não o nome) dispara a seleção via item.onclick
    item.querySelector('.ct-meta').dispatchEvent(new w.Event('click', { bubbles: true }));
    ok(item.classList.contains('active'), 'item selecionado ao clicar fora do nome');
  });

  /* ── v1.5.1 — 2º DOCUMENTO (Comandas/Hospedados) ── */
  await T('v1.5.1 migração v4→v5: store hospedados existe, demais intactos', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF())); await sleep(20);
    ok(Array.isArray(await w.dbGetAll('hospedados')), 'store hospedados acessível');
    ok(Array.isArray(await w.dbGetAll('reservas')), 'reservas intacto');
    ok(Array.isArray(await w.dbGetAll('ajustes')), 'ajustes intacto');
    ok(Array.isArray(await w.dbGetAll('envios')), 'envios intacto');
  });

  await T('v1.5.1 importarComandas → hospedados no mapa (visual próprio, vaga por tipo)', async () => {
    const { w } = await novoApp();
    await w.importarComandas(w.parsearComandas(montarComandas())); await sleep(20);
    const spans = [...w.document.querySelectorAll('#mapa-container .cell-span.hospedado')];
    ok(spans.some(s => /HOSPEDE CARRO/.test(s.textContent)), 'hospedado carro pequeno renderizado (classe hospedado)');
    ok(spans.some(s => /HOSPEDE GRANDE/.test(s.textContent)), 'hospedado camionete renderizado');
    // camionete (G) deve ocupar a seção Grande
    const alocG = w.aplicarAjustes(w.conjuntoAtivo(), {});
    ok([].concat(...alocG.linhasG).some(r => /HOSPEDE GRANDE/.test(r.nomeCompleto)), 'camionete alocada em vaga grande');
  });

  await T('v1.5.1 anti-duplicação: reserva com mesmo apto+período some (hospedado prevalece)', async () => {
    const { w } = await novoApp();
    const hoje = diasDeHoje(0), maisTarde = diasDeHoje(5);
    await w.importarPDF(w.parsear(bloco('40001', hoje, maisTarde, '601', 'WHATSAPP', 'GARAGEM PEQUENO', 'FULANO RESERVA'))); await sleep(20);
    await w.importarComandas(w.parsearComandas(montarComandas([blocoComanda('601', 'FULANO HOSPEDE', hoje, maisTarde, '', 'CARRO DE PASSEIO')]))); await sleep(20);
    ok(!w.conjuntoAtivo().some(r => r.nro === '40001'), 'reserva 40001 (apto 601) deduplicada');
    ok(w.conjuntoAtivo().some(r => r.ehHospedado && r.apto === '601'), 'hospedado do apto 601 presente');
  });

  await T('v1.5.1 hospedado editável: marcar saída → sai do mapa, aparece em Sem garagem, restaurável', async () => {
    const { w } = await novoApp();
    await w.importarComandas(w.parsearComandas(montarComandas())); await sleep(20);
    const h = w.hospedadosNoPeriodo().find(x => x.apto === '501');
    await w.salvarStatusManual(h.nro, 'sem_garagem'); await sleep(20);
    ok(![...w.document.querySelectorAll('#mapa-container .cell-span')].some(s => /HOSPEDE CARRO/.test(s.textContent)), 'saiu do mapa');
    const chk = w.document.getElementById('chk-semgar'); chk.checked = true; w.toggleSemGaragem(); await sleep(20);
    const area = w.document.querySelector('.secao-semgar');
    ok(area && /HOSPEDE CARRO/.test(area.textContent), 'listado na área Sem garagem (manual)');
    // auditoria gravada
    const aj = (await w.dbGetAll('ajustes')).find(a => String(a.nro) === h.nro);
    ok(aj && aj.statusManual === 'sem_garagem' && aj.ultimaAlteracao, 'override + auditoria gravados');
    // restaura
    await w.salvarStatusManual(h.nro, 'confirmado'); await sleep(20);
    ok([...w.document.querySelectorAll('#mapa-container .cell-span')].some(s => /HOSPEDE CARRO/.test(s.textContent)), 'voltou ao mapa');
  });

  await T('v1.5.1 hospedado arrastável: salvarAjuste grava placement na chave do hospedado', async () => {
    const { w } = await novoApp();
    await w.importarComandas(w.parsearComandas(montarComandas())); await sleep(20);
    const h = w.hospedadosNoPeriodo().find(x => x.apto === '501');
    await w.salvarAjuste(h.nro, 'P7'); await sleep(20);
    const aj = (await w.dbGetAll('ajustes')).find(a => String(a.nro) === h.nro);
    ok(aj && aj.vagaIdManual === 'P7', 'placement gravado na chave do hospedado');
    // a vaga P7 passa a conter o hospedado
    const cellP7 = w.document.querySelector('.row-cells[data-vaga="P7"]');
    ok(cellP7 && /HOSPEDE CARRO/.test(cellP7.textContent), 'hospedado fixado na vaga P7');
  });

  await T('v1.5.1 override do hospedado SOBREVIVE ao reimport do comandas; divergência se comanda ainda mostra garagem', async () => {
    const { w } = await novoApp();
    await w.importarComandas(w.parsearComandas(montarComandas())); await sleep(20);
    const h = w.hospedadosNoPeriodo().find(x => x.apto === '501');
    await w.salvarStatusManual(h.nro, 'sem_garagem'); await sleep(20);
    await w.importarComandas(w.parsearComandas(montarComandas())); await sleep(20); // reimporta (comanda ainda mostra garagem)
    const aj = (await w.dbGetAll('ajustes')).find(a => String(a.nro) === h.nro);
    ok(aj && aj.statusManual === 'sem_garagem', 'override sobrevive ao reimport');
    const h2 = w.hospedadosNoPeriodo().find(x => x.apto === '501');
    ok(w.pmsDivergente(h2, aj), 'divergência: saiu manualmente mas comanda ainda mostra garagem');
  });

  await T('v1.5.1 reimport de um slot NÃO afeta o outro; hospedados persistem ao reabrir', async () => {
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
      const w = dom.window; await aguardarBoot(w); return w;
    };
    const w1 = await mk();
    await w1.importarPDF(w1.parsear(montarPDF())); await sleep(20);
    await w1.importarComandas(w1.parsearComandas(montarComandas())); await sleep(20);
    // reimporta SÓ reservas → hospedados intactos
    await w1.importarPDF(w1.parsear(montarPDF())); await sleep(20);
    ok((await w1.dbGetAll('hospedados')).length >= 2, 'reimport de reservas não apaga hospedados');
    ok((await w1.dbGetAll('reservas')).length >= 4, 'reservas presentes');
    // reabre mesmo IndexedDB
    const w2 = await mk(); await sleep(20);
    ok(w2.hospedadosNoPeriodo().length >= 2, 'hospedados persistem ao reabrir');
  });

  await T('v1.5.1 validação por informação: comanda no slot reservas é recusada (mantém atual)', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF())); await sleep(20);
    const antes = (await w.dbGetAll('reservas')).length;
    const r = await w.aplicarUploadReservas(montarComandas(), 999, { nomeArquivo: 'comanda.pdf', dataHoraUpload: Date.now() });
    eq(r.status, 'invalido', 'comanda não gera controle de reservas');
    eq((await w.dbGetAll('reservas')).length, antes, 'reservas mantidas');
  });

  await T('v1.5.1 bloqueio de emissão: documento mais antigo é recusado, mantém o atual', async () => {
    const { w } = await novoApp();
    const r1 = await w.aplicarUploadHospedados(montarComandas(), 2000, { nomeArquivo: 'novo.pdf', dataHoraUpload: Date.now() });
    eq(r1.status, 'aplicado', '1º documento aplicado');
    const n1 = (await w.dbGetAll('hospedados')).length;
    const r2 = await w.aplicarUploadHospedados(montarComandas([blocoComanda('999', 'ANTIGO', diasDeHoje(0), diasDeHoje(3), '', 'CARRO DE PASSEIO')]), 1000, { nomeArquivo: 'antigo.pdf', dataHoraUpload: Date.now() });
    eq(r2.status, 'recusado_antigo', 'documento mais antigo recusado');
    eq((await w.dbGetAll('hospedados')).length, n1, 'conjunto de hospedados mantido (não substituído)');
    // igual/mais recente aplica
    const r3 = await w.aplicarUploadHospedados(montarComandas([blocoComanda('999', 'RECENTE', diasDeHoje(0), diasDeHoje(3), '', 'CARRO DE PASSEIO')]), 3000, { nomeArquivo: 'recente.pdf', dataHoraUpload: Date.now() });
    eq(r3.status, 'aplicado', 'emissão mais recente aplica');
  });

  await T('v1.5.1.1 comandas na ORDEM DE LEITURA real → hospedados no mapa (não recusa)', async () => {
    const { w } = await novoApp();
    // datas relativas a hoje, mas em ordem de leitura (campos em linhas separadas)
    const ent = diasDeHoje(0), sai = diasDeHoje(5);
    const f4 = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const f2 = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
    const txt = `Comandas em aberto - detalhado Página: 1
HOTEL GUMZ
Filtro: Lançadas até 31/12/3000
Apartamento
801 HOSPEDE LEITURA
Ponto de Venda Qtde Descrição Val.Unit. Val.Total Tipo Func
Data Origem
${f4(ent)} ${f4(sai)}
Comanda Cupom
Extras
BOOKING.COM
Taxas
GARAGEM 1 ESTACIONAMENTO CAMIONETE - BAIXA 2025
60,00 60,00 Lançamento X
${f2(ent)} 1
Total Geral`;
    // validação aceita
    ok(w.validarDocumentoComandas(txt).ok, 'documento na ordem de leitura é aceito');
    const r = await w.aplicarUploadHospedados(txt, 1000, { nomeArquivo: 'comanda.pdf', dataHoraUpload: Date.now() });
    eq(r.status, 'aplicado');
    await sleep(20);
    const spans = [...w.document.querySelectorAll('#mapa-container .cell-span.hospedado')];
    ok(spans.some(s => /HOSPEDE LEITURA/.test(s.textContent)), 'hospedado renderizado');
    // camionete (G) → seção grande
    ok([].concat(...w.aplicarAjustes(w.conjuntoAtivo(), {}).linhasG).some(x => /HOSPEDE LEITURA/.test(x.nomeCompleto)), 'camionete em vaga grande');
  });

  console.log(`\nINTEGRAÇÃO (jsdom + fake-indexeddb): ${pass}/${pass + fail} ✓`);
  if (fail) { console.log('\nFALHAS:'); fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
})();
