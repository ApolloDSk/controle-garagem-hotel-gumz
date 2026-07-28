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

  await T('rodapé mostra v1.5.7', async () => {
    const { w } = await novoApp();
    eq(w.document.getElementById('footer-version').textContent, 'v1.5.7');
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
    // v1.5.5 (6.4): a fila do Contato é só "Aguardando". Coloca a reserva Booking (com OTA) em
    // Aguardando p/ exercitar os badges PMS+OTA copiáveis na fila.
    await w.salvarStatusManual('30002', 'aguardando');
    await sleep(20);
    w.trocarAba('contato');
    const item = w.document.querySelector('.ct-item[data-nro="30002"]');
    ok(item, 'reserva Aguardando presente na fila');
    const pms = item.querySelector('.ct-badge.pms.copyable');
    ok(pms, 'badge PMS deve ser copiável');
    ok(/copiarTexto/.test(pms.getAttribute('onclick') || ''), 'PMS clica em copiarTexto');
    const ota = item.querySelector('.ct-badge.ota.copyable');
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
  // v1.5.6 (6.2) — os NÚMEROS das vagas são FIXOS de cima p/ baixo; o filtro só reordena o conteúdo.
  await T('toggleOrdemVagas mantém os números fixos (cima→baixo) e só reordena o conteúdo', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF()));
    await sleep(20);
    const labelsAntes = [...w.document.querySelectorAll('.row-label')].map(e => e.textContent);
    const vagasAntes = [...w.document.querySelectorAll('.row-cells[data-vaga]')].map(e => e.dataset.vaga);
    w.toggleOrdemVagas();
    await sleep(10);
    const labelsDepois = [...w.document.querySelectorAll('.row-label')].map(e => e.textContent);
    const vagasDepois = [...w.document.querySelectorAll('.row-cells[data-vaga]')].map(e => e.dataset.vaga);
    eq(JSON.stringify(labelsAntes), JSON.stringify(labelsDepois), 'os NÚMEROS das vagas NÃO mudam (fixos de cima para baixo)');
    ok(JSON.stringify(vagasAntes) !== JSON.stringify(vagasDepois), 'o CONTEÚDO (id de alocação por posição) reordena');
    eq(w.localStorage.getItem('garagem_ordem_vagas'), 'baixo', 'preferência persistida');
    eq(labelsDepois[0], 'P1', 'P1 sempre no topo, independente do filtro');
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
    // v1.5.5 (6.4): a fila é só "Aguardando". PDF diz confirmado (30002) → override p/ aguardando:
    // entra na fila E diverge do PMS (manual ≠ PDF) → o badge de divergência aparece na fila.
    await w.salvarStatusManual('30002', 'aguardando');
    await sleep(20);
    w.trocarAba('contato'); await sleep(20);
    const item = w.document.querySelector('.ct-item[data-nro="30002"]');
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
    // v1.5.5 (6.4): a fila é só "Aguardando" — usa a reserva amarela (30003) que está na fila.
    const item = w.document.querySelector('.ct-item[data-nro="30003"]');
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

  /* ── v1.5.2 — correções visíveis ── */
  await T('5.1 nome com cabeçalho "Hóspedes:" (sem espaço) aparece no mapa (não "Hóspede")', async () => {
    const { w } = await novoApp();
    const ent = diasDeHoje(0), sai = diasDeHoje(4);
    const txt = `${fmtBloco(ent)} ${fmtSai(sai)} 1 2 701 ABC 41010 H\nWHATSAPP\nObs do Apto: GARAGEM PEQUENO\nHóspedes:\nROBERTA MENEZES\nROBERTA MENEZES\nDesbravador Software`;
    await w.importarPDF(w.parsear(txt)); await sleep(20);
    ok([...w.document.querySelectorAll('#mapa-container .cell-span')].some(s => /ROBERTA MENEZES/.test(s.textContent)), 'nome extraído');
    ok(!w.ativasNoPeriodo().some(r => r.nomeCompleto === 'Hóspede'), 'nenhum "Hóspede"');
  });

  await T('5.2 obs "SEM DISPONIBILIDADE DE GARAGEM" → sai do mapa, vai p/ Sem garagem + aviso', async () => {
    const { w } = await novoApp();
    const ent = diasDeHoje(0), sai = diasDeHoje(4);
    const txt = `${fmtBloco(ent)} ${fmtSai(sai)} 1 2 702 ABC 41011 H\nWHATSAPP\nObs do Apto: SEM DISPONIBILIDADE DE GARAGEM\nHóspedes :\nCLEBER SANTOS\nCLEBER SANTOS\nDesbravador Software`;
    await w.importarPDF(w.parsear(txt)); await sleep(20);
    ok(![...w.document.querySelectorAll('#mapa-container .cell-span')].some(s => /CLEBER SANTOS/.test(s.textContent)), 'saiu do mapa');
    // aviso de sem-garagem por PDF aparece (com o filtro desligado)
    const av = w.document.getElementById('avisos');
    ok(av.style.display !== 'none' && /indisponibilidade/i.test(av.textContent), 'aviso de sem-garagem por PDF');
    // liga o filtro → aparece na área
    const chk = w.document.getElementById('chk-semgar'); chk.checked = true; w.toggleSemGaragem(); await sleep(20);
    ok(/CLEBER SANTOS/.test(w.document.querySelector('.secao-semgar').textContent), 'listado na área Sem garagem');
  });

  await T('5.2 obs ambígua → reserva PERMANECE no mapa + aviso de conferência (não marca sozinho)', async () => {
    const { w } = await novoApp();
    const ent = diasDeHoje(0), sai = diasDeHoje(4);
    const txt = `${fmtBloco(ent)} ${fmtSai(sai)} 1 2 703 ABC 41012 H\nWHATSAPP\nObs do Apto: GARAGEM LOTADA VERIFICAR COM RECEPCAO\nHóspedes :\nMARCOS DIAS\nMARCOS DIAS\nDesbravador Software`;
    await w.importarPDF(w.parsear(txt)); await sleep(20);
    ok([...w.document.querySelectorAll('#mapa-container .cell-span')].some(s => /MARCOS DIAS/.test(s.textContent)), 'permanece no mapa');
    const av = w.document.getElementById('avisos');
    ok(av.style.display !== 'none' && /#41012/.test(av.textContent) && /sem garagem/i.test(av.textContent), 'aviso de conferência presente');
  });

  await T('5.2 obs com garagem confirmada NÃO vira sem garagem nem aviso', async () => {
    const { w } = await novoApp();
    const ent = diasDeHoje(0), sai = diasDeHoje(4);
    const txt = `${fmtBloco(ent)} ${fmtSai(sai)} 1 2 704 ABC 41013 H\nWHATSAPP\nObs do Apto: COM GARAGEM GRANDE R$100\nHóspedes :\nPAULO REGO\nPAULO REGO\nDesbravador Software`;
    await w.importarPDF(w.parsear(txt)); await sleep(20);
    ok([...w.document.querySelectorAll('#mapa-container .cell-span')].some(s => /PAULO REGO/.test(s.textContent)), 'no mapa');
    eq(w.document.getElementById('avisos').style.display, 'none', 'sem aviso');
  });

  await T('v1.5.4 (5.2) mesma reserva (2 aptos) → "Carro 01/02" no bloco, SEM laranja, cor pelo status', async () => {
    const { w } = await novoApp();
    const ent = diasDeHoje(0), sai = diasDeHoje(4);
    // mesmo nro em 2 aptos: um confirmado (azul), outro aguardando (amarelo) → cores DIFERENTES.
    const txt = [
      `${fmtBloco(ent)} ${fmtSai(sai)} 1 2 705 ABC 41014 H\nWHATSAPP\nObs do Apto: GARAGEM PEQUENO\nHóspedes :\nGRUPO UM\nGRUPO UM\nDesbravador Software`,
      `${fmtBloco(ent)} ${fmtSai(sai)} 1 2 706 ABC 41014 H\nWHATSAPP\nObs do Apto: VERIFICAR INTERESSE\nHóspedes :\nGRUPO DOIS\nGRUPO DOIS\nDesbravador Software`,
    ].join('\n');
    await w.importarPDF(w.parsear(txt)); await sleep(20);
    // nada laranja sobra
    ok(!w.document.querySelector('#mapa-container .cell-span.laranja'), 'nenhum bloco laranja');
    ok(!w.document.querySelector('#mapa-container .grupo-ico'), 'nenhum ícone de grupo (👥)');
    // "Carro 01/02" DENTRO do bloco
    const info = [...w.document.querySelectorAll('#mapa-container .cell-span')].map(s => s.textContent).join(' | ');
    ok(/Carro 01/.test(info) && /Carro 02/.test(info), '"Carro 01" e "Carro 02" nos blocos');
    // status diferentes → cores diferentes (um azul, um amarelo)
    ok(w.document.querySelector('#mapa-container .cell-span.azul'), 'um bloco azul (confirmado)');
    ok(w.document.querySelector('#mapa-container .cell-span.amarelo'), 'um bloco amarelo (aguardando)');
  });

  await T('5.4 aviso de overbooking informa o PERÍODO/datas', async () => {
    const { w } = await novoApp();
    const ent = diasDeHoje(0), sai = diasDeHoje(2); // 2 dias de ocupação (hoje e hoje+1)
    // 35 reservas amarelas sobrepostas → 32 vagas ocupadas, resto em overbooking
    const blocos = [];
    for (let i = 0; i < 35; i++) blocos.push(`${fmtBloco(ent)} ${fmtSai(sai)} 1 2 ${800 + i} ABC ${42000 + i} H\nWHATSAPP\nObs do Apto: VERIFICAR INTERESSE\nHóspedes :\nHOSPEDE ${i}\nHOSPEDE ${i}\nDesbravador Software`);
    await w.importarPDF(w.parsear(blocos.join('\n'))); await sleep(30);
    const alert = w.document.getElementById('alert-over');
    ok(alert.style.display !== 'none', 'aviso de overbooking visível');
    ok(/Overbooking em/.test(alert.textContent), 'texto com "Overbooking em"');
    const dd = String(ent.getDate()).padStart(2, '0'), mm = String(ent.getMonth() + 1).padStart(2, '0');
    ok(alert.textContent.includes(`${dd}/${mm}`), 'inclui a data do overbooking');
  });

  /* ── v1.5.3 — ferramentas ── */
  const motoBloco = (nro, ent, sai, apto, nome) => `${fmtBloco(ent)} ${fmtSai(sai)} 1 2 ${apto} ABC ${nro} H\nWHATSAPP\nObs do Apto: GARAGEM MOTO\nHóspedes :\n${nome}\n${nome}\nDesbravador Software`;

  await T('v1.5.3 migração v5→v6: store reservasManuais existe; demais intactos', async () => {
    const { w } = await novoApp();
    ok(Array.isArray(await w.dbGetAll('reservasManuais')), 'store reservasManuais acessível');
    ok(Array.isArray(await w.dbGetAll('reservas')) && Array.isArray(await w.dbGetAll('ajustes')) && Array.isArray(await w.dbGetAll('hospedados')), 'demais stores intactos');
  });

  await T('5.1 duas motos → 1 slot de moto na seção de carros P (sem seção Moto separada)', async () => {
    const { w } = await novoApp();
    const ent = diasDeHoje(0), sai = diasDeHoje(4);
    await w.importarPDF(w.parsear([motoBloco('60001', ent, sai, '101', 'MOTO UM'), motoBloco('60002', ent, sai, '102', 'MOTO DOIS')].join('\n'))); await sleep(20);
    const par = [...w.document.querySelectorAll('.cell-span.moto-c')].filter(s => /MOTO UM/.test(s.textContent) && /MOTO DOIS/.test(s.textContent));
    ok(par.length === 1, 'as 2 motos num único bloco (par) na vaga de carro');
    ok(![...w.document.querySelectorAll('.secao-titulo')].some(t => /Moto — 1 vaga/.test(t.textContent)), 'sem seção Moto separada');
  });

  await T('5.1 moto arrastável: salvarAjuste(moto, P5) fixa a moto na vaga de carro P5', async () => {
    const { w } = await novoApp();
    const ent = diasDeHoje(0), sai = diasDeHoje(4);
    await w.importarPDF(w.parsear(motoBloco('60003', ent, sai, '103', 'MOTO SOLO'))); await sleep(20);
    await w.salvarAjuste('60003', 'P5'); await sleep(20);
    const p5 = w.document.querySelector('.row-cells[data-vaga="P5"]');
    ok(p5 && /MOTO SOLO/.test(p5.textContent), 'moto fixada em P5');
  });

  await T('5.2 busca: destaca resultado, conta e escurece o resto; limpar remove', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF())); await sleep(20);
    w.onBuscaInput('ANA'); await sleep(20);
    ok(w.document.getElementById('mapa-wrapper').classList.contains('busca-ativa'), 'mapa em modo busca');
    ok(w.document.querySelector('.cell-span.busca-hit'), 'há bloco marcado');
    ok(w.document.querySelector('.cell-span.busca-atual'), 'resultado atual contornado');
    ok(/1 de/.test(w.document.getElementById('busca-info').textContent), 'contagem exibida');
    w.limparBusca(); await sleep(10);
    ok(!w.document.getElementById('mapa-wrapper').classList.contains('busca-ativa'), 'destaque removido');
  });

  await T('5.2 busca por modelo (moto) casa', async () => {
    const { w } = await novoApp();
    const ent = diasDeHoje(0), sai = diasDeHoje(4);
    await w.importarPDF(w.parsear(motoBloco('60005', ent, sai, '105', 'FULANO MOTO'))); await sleep(20);
    w.onBuscaInput('moto'); await sleep(20);
    ok(w.document.querySelector('.cell-span.busca-hit'), 'moto casa por modelo');
  });

  await T('5.3 vaga extra: aparece só quando ocupada; EXTRA1 não conta nas normais', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF())); await sleep(20);
    ok(!w.document.querySelector('.secao-extra'), 'seção extra oculta por padrão');
    await w.salvarAjuste('30001', 'EXTRA1'); await sleep(20);
    const sec = w.document.querySelector('.secao-extra');
    ok(sec && /ANA PEQUENA/.test(sec.textContent), 'ANA aparece na vaga extra');
    ok(!w.document.querySelector('.row-cells[data-vaga="P1"] .cell-span') || ![...w.document.querySelectorAll('.secao-bloco')][0].textContent.includes('EXTRA'), 'extra fora das seções normais');
  });

  await T('5.4 adicionar reserva manual: entra no mapa (✍️), persiste, auditoria; remover', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF())); await sleep(20);
    w.gestaoAddFuncionario(); const fid = w.getGestaoConfig().funcionarios[0].id; w.gestaoSetFuncNome(fid, 'Doug'); await w.salvarGestao(); await sleep(10);
    const ent = diasDeHoje(0), sai = diasDeHoje(3);
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    w.document.getElementById('add-nome').value = 'HOSPEDE MANUAL';
    w.document.getElementById('add-entrada').value = iso(ent);
    w.document.getElementById('add-saida').value = iso(sai);
    w.document.getElementById('add-tipo').value = 'P';
    w.document.getElementById('add-apto').value = '777';
    await w.submeterAddManual(); await sleep(30);
    ok([...w.document.querySelectorAll('.cell-span')].some(s => /HOSPEDE MANUAL/.test(s.textContent)), 'reserva manual no mapa');
    ok(w.document.querySelector('.cell-span .manual-ico'), 'marcador ✍️ presente');
    const recs = await w.dbGetAll('reservasManuais');
    eq(recs.length, 1); eq(recs[0].ultimaAlteracao.funcionario, 'Doug', 'auditoria gravada');
    // remover
    await w.removerReservaManual(recs[0].id); await sleep(20);
    ok(![...w.document.querySelectorAll('.cell-span')].some(s => /HOSPEDE MANUAL/.test(s.textContent)), 'removida do mapa');
  });

  await T('5.4 dedup "manter uma só": manual com mesmo nº do PDF não duplica', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF())); await sleep(20);
    const rec = w.montarReservaManual({ nome: 'ANA PEQUENA', tipo: 'P', entrada: diasDeHoje(0), saida: diasDeHoje(5), nro: '30001', apto: '201' }, { funcionario: 'x', dataHora: new Date().toISOString() });
    await w.salvarReservaManual(rec); await sleep(20);
    // 30001 já existe no PDF → a manual é reconciliada (não aparece 2x)
    const anas = [...w.document.querySelectorAll('.cell-span')].filter(s => /ANA PEQUENA/.test(s.textContent));
    eq(anas.length, 1, 'ANA aparece uma só vez');
  });

  await T('5.4 manual persiste ao reimportar PDF (não vem de PDF)', async () => {
    const { w } = await novoApp();
    const rec = w.montarReservaManual({ nome: 'SO MANUAL', tipo: 'G', entrada: diasDeHoje(0), saida: diasDeHoje(4), apto: '888' }, { funcionario: 'x', dataHora: new Date().toISOString() });
    await w.salvarReservaManual(rec); await sleep(20);
    await w.importarPDF(w.parsear(montarPDF())); await sleep(20);
    ok((await w.dbGetAll('reservasManuais')).length >= 1, 'manual sobrevive ao reimport');
    ok([...w.document.querySelectorAll('.cell-span')].some(s => /SO MANUAL/.test(s.textContent)), 'ainda no mapa');
  });

  await T('5.5 painel de edições manuais lista adições + status', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF())); await sleep(20);
    await w.salvarStatusManual('30003', 'sem_garagem'); await sleep(20);
    const rec = w.montarReservaManual({ nome: 'ADD X', tipo: 'P', entrada: diasDeHoje(0), saida: diasDeHoje(3) }, { funcionario: 'Doug', dataHora: new Date().toISOString() });
    await w.salvarReservaManual(rec); await sleep(20);
    w.abrirEdicoesManuais(); await sleep(10);
    const corpo = w.document.getElementById('edicoes-corpo');
    ok(/Reserva adicionada/.test(corpo.textContent), 'lista a adição manual');
    ok(/Sem garagem/.test(corpo.textContent), 'lista a edição de status');
  });

  /* ════════════════════════ v1.5.5 ════════════════════════ */
  // posições atuais no mapa (DOM): nro → vagaId
  const posMapa = (w) => { const m = {}; w.document.querySelectorAll('#mapa-container .cell-span[data-nro]').forEach(s => { const wr = s.closest('[data-vaga]'); if (wr && s.dataset.nro) m[s.dataset.nro] = wr.dataset.vaga; }); return m; };

  await T('v1.5.5 (6.2) CENTRAL: arraste p/ vaga livre não move NENHUMA outra (mapa DOM)', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF())); await sleep(20);
    const antes = posMapa(w);
    const usadas = new Set(Object.values(antes));
    let livre = null; for (let k = 1; k <= 18; k++) { if (!usadas.has('P' + k)) { livre = 'P' + k; break; } }
    ok(livre, 'há vaga P livre');
    await w.salvarAjuste('30001', livre); await sleep(20);
    const depois = posMapa(w);
    eq(depois['30001'], livre, '30001 foi para a vaga livre');
    Object.keys(antes).forEach(nro => { if (nro !== '30001') eq(depois[nro], antes[nro], nro + ' não pode se mover'); });
  });

  await T('v1.5.5 (6.2) "voltar ao automático" re-aloca só a própria', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF())); await sleep(20);
    const antes = posMapa(w);
    const usadas = new Set(Object.values(antes));
    let livre = null; for (let k = 1; k <= 18; k++) { if (!usadas.has('P' + k)) { livre = 'P' + k; break; } }
    await w.salvarAjuste('30001', livre); await sleep(20);
    await w.removerAjuste('30001'); await sleep(20);
    const depois = posMapa(w);
    // as outras seguem intactas; 30001 volta ao automático (alguma vaga válida)
    Object.keys(antes).forEach(nro => { if (nro !== '30001') eq(depois[nro], antes[nro], nro + ' intacta'); });
    ok(depois['30001'], '30001 re-alocada automaticamente');
  });

  await T('v1.5.5 (6.4) Contato lista SÓ Aguardando; flag (overbooking) NÃO exclui; Confirmada fica fora', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF())); await sleep(20);
    await w.salvarStatusManual('30001', 'aguardando'); // confirmada → aguardando
    await w.salvarAjuste('30001', 'OVERBOOKING');       // + flag overbooking
    await sleep(20);
    w.trocarAba('contato'); await sleep(20);
    const nros = [...w.document.querySelectorAll('.ct-item')].map(e => e.dataset.nro);
    ok(nros.includes('30003'), 'amarela (aguardando) na fila');
    ok(nros.includes('30001'), 'aguardando EM OVERBOOKING entra (flag não exclui)');
    ok(!nros.includes('30002') && !nros.includes('30004'), 'nenhuma Confirmada na fila');
    // a flag aparece como marca visual
    ok(w.document.querySelector('.ct-item[data-nro="30001"] .ct-flag.over'), 'flag overbooking visível');
  });

  await T('v1.5.5 (6.4) reativo: aguardando→confirmado sai; volta→entra', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF())); await sleep(20);
    w.trocarAba('contato'); await sleep(20);
    ok(w.document.querySelector('.ct-item[data-nro="30003"]'), '30003 na fila');
    await w.salvarStatusManual('30003', 'confirmado'); await sleep(20);
    ok(!w.document.querySelector('.ct-item[data-nro="30003"]'), 'saiu ao confirmar');
    await w.salvarStatusManual('30003', 'aguardando'); await sleep(20);
    ok(w.document.querySelector('.ct-item[data-nro="30003"]'), 'voltou ao aguardar');
  });

  await T('v1.5.5 (6.10) fila ordenada por chegada mais próxima (estável)', async () => {
    const { w } = await novoApp();
    const pdf = [
      bloco('50001', diasDeHoje(3), diasDeHoje(6), '401', 'WHATSAPP', 'VERIFICAR INTERESSE SEM CLASSIF', 'TARDE'),
      bloco('50002', diasDeHoje(0), diasDeHoje(4), '402', 'WHATSAPP', 'VERIFICAR INTERESSE SEM CLASSIF', 'HOJE'),
      bloco('50003', diasDeHoje(1), diasDeHoje(5), '403', 'WHATSAPP', 'VERIFICAR INTERESSE SEM CLASSIF', 'AMANHA'),
    ].join('\n');
    await w.importarPDF(w.parsear(pdf)); await sleep(20);
    w.trocarAba('contato'); await sleep(20);
    const ordem = [...w.document.querySelectorAll('.ct-item')].map(e => e.dataset.nro);
    eq(ordem[0], '50002', 'chegada mais próxima no topo');
    eq(ordem[1], '50003'); eq(ordem[2], '50001');
  });

  await T('v1.5.5 (6.9) já contatado: marca "contatado" com data/hora (envios); reenvio permitido', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF())); await sleep(20);
    await w.registrarEnvio('30003', 'verificando', null); await sleep(20);
    w.trocarAba('contato'); await sleep(20);
    const item = w.document.querySelector('.ct-item[data-nro="30003"]');
    ok(item.classList.contains('enviado'), 'linha marcada como contatada');
    ok(/contatado/.test((item.querySelector('.status-env') || {}).textContent || ''), 'badge com "contatado" + data/hora');
    // a mensagem/WhatsApp continua disponível (reenvio permitido — nada bloqueado)
  });

  await T('v1.5.5 (6.5) telefone do documento é semeado por presença (Tel:/+DDI)', async () => {
    const { w } = await novoApp();
    const pdf = [bloco('40001', diasDeHoje(0), diasDeHoje(3), '301', 'WHATSAPP', 'VERIFICAR INTERESSE SEM CLASSIF Tel: +55 47 99999-8888', 'FONE DOC')].join('\n');
    await w.importarPDF(w.parsear(pdf)); await sleep(30);
    const c = (await w.dbGetAll('contatos')).find(x => String(x.nro) === '40001');
    ok(c && c.telefone.replace(/\D/g, '') === '5547999998888', 'telefone do documento capturado e persistido');
  });

  await T('v1.5.5 (6.5) telefone do USUÁRIO prevalece sobre o do documento (reimport)', async () => {
    const { w } = await novoApp();
    const mk = () => [bloco('40002', diasDeHoje(0), diasDeHoje(3), '302', 'WHATSAPP', 'VERIFICAR INTERESSE SEM CLASSIF Tel: +1 111 111 1111', 'FONE')].join('\n');
    await w.importarPDF(w.parsear(mk())); await sleep(30);
    w.trocarAba('contato'); await sleep(10);
    const inp = w.document.getElementById('fone-40002');
    inp.value = '5547912345678';
    await w.confirmarTelefone('40002'); await sleep(20);
    await w.importarPDF(w.parsear(mk())); await sleep(30); // documento traz +1..., mas o do usuário vence
    const c = (await w.dbGetAll('contatos')).find(x => String(x.nro) === '40002');
    eq(c.telefone, '5547912345678', 'mantém o número do usuário');
    eq(c.telefoneStatus, 'resolvido', 'status confirmado pelo usuário preservado');
  });

  await T('v1.5.5 (6.5) documento SEM telefone → nada semeado, sem erro', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF())); await sleep(30);
    const c = (await w.dbGetAll('contatos')).find(x => String(x.nro) === '30001');
    ok(!c || !c.telefone, 'sem telefone quando o documento não traz (caminho normal do Desbravador)');
  });

  await T('v1.5.5 (6.8) sem telefone → botão "Abrir WhatsApp" desabilitado; com telefone → habilitado', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(montarPDF())); await sleep(20);
    w.trocarAba('contato'); await sleep(20);
    ok(w.document.querySelector('.ct-item[data-nro="30003"] .wa-btn.disabled'), 'desabilitado sem telefone');
    const inp = w.document.getElementById('fone-30003'); inp.value = '5547912345678';
    await w.confirmarTelefone('30003'); await sleep(20);
    const item = w.document.querySelector('.ct-item[data-nro="30003"]');
    ok(!item.querySelector('.wa-btn.disabled') && item.querySelector('.wa-btn'), 'habilitado com telefone');
  });

  /* ════════════════════════ v1.5.6 ════════════════════════ */
  await T('v1.5.6 (6.1) editor do hospedado: oferece vaga extra SÓ em overbooking; mantém Na garagem/Saiu', async () => {
    const { w } = await novoApp();
    const comOver = w.statusEditorHospedadoHTML('K', 'confirmado', { overbooking: true, extraLivre: 'EXTRA1' });
    ok(/Vaga extra/.test(comOver) && /EXTRA1/.test(comOver), 'em overbooking oferece EXTRA1');
    ok(/Na garagem/.test(comOver) && /Saiu/.test(comOver), 'mantém as opções do hospedado');
    const semOver = w.statusEditorHospedadoHTML('K', 'confirmado', {});
    ok(!/Vaga extra/.test(semOver), 'fora de overbooking NÃO oferece vaga extra');
  });

  await T('v1.5.6 (6.1) hospedado forçado a overbooking → detalhe mostra vaga extra; mover mantém hospedado', async () => {
    const { w } = await novoApp();
    await w.importarComandas(w.parsearComandas(montarComandas())); await sleep(30);
    const hosp = w.conjuntoAtivo().find(r => r.ehHospedado);
    ok(hosp, 'há hospedado');
    await w.salvarAjuste(hosp.nro, 'OVERBOOKING'); await sleep(20);
    const hospOver = w.conjuntoAtivo().find(r => String(r.nro) === String(hosp.nro));
    w.abrirDetalheReserva(hospOver); await sleep(10);
    const sel = w.document.querySelector('#detalhe-corpo .status-sel');
    ok(sel && /Vaga extra/.test(sel.innerHTML), 'detalhe do hospedado em overbooking oferece vaga extra');
    // mover para a vaga extra NÃO altera o status (segue hospedado/na garagem)
    await w.colocarEmVagaExtra(hosp.nro); await sleep(20);
    const aj = (await w.dbGetAll('ajustes')).find(a => String(a.nro) === String(hosp.nro));
    ok(aj && /^EXTRA/.test(aj.vagaIdManual), 'posicionado numa vaga extra');
    ok(!aj.statusManual || aj.statusManual === 'confirmado', 'status do hospedado preservado (não virou outro status)');
  });

  const mkDupPDF = () => [
    bloco('90001', diasDeHoje(0), diasDeHoje(4), '701', 'WHATSAPP', 'GARAGEM PEQUENO', 'DUP UM'),
    bloco('90001', diasDeHoje(0), diasDeHoje(4), '701', 'WHATSAPP', 'GARAGEM PEQUENO', 'DUP UM'),
  ].join('\n');

  await T('v1.5.6 (6.3) duplicata real: selo nos DOIS blocos; dispensar remove dos dois; reimport reproduz; nunca apaga', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(mkDupPDF())); await sleep(30);
    eq(w.document.querySelectorAll('#mapa-container .dup-badge').length, 2, 'selo nos dois blocos do par');
    const cluster = w.document.querySelector('#mapa-container .cell-span[data-dupcluster]').dataset.dupcluster;
    w.dispensarDuplicata(cluster); await sleep(20);
    eq(w.document.querySelectorAll('#mapa-container .dup-badge').length, 0, 'dispensar remove o alerta dos DOIS');
    await w.importarPDF(w.parsear(mkDupPDF())); await sleep(30); // dispensa NÃO é permanente
    eq(w.document.querySelectorAll('#mapa-container .dup-badge').length, 2, 'reimport reproduz o par → alerta REAPARECE');
    const regs = (await w.dbGetAll('reservas')).filter(r => String(r.nro) === '90001' && r.ativo !== false);
    ok(regs.length >= 2, 'o app NUNCA apaga — as duas reservas seguem no banco');
  });

  await T('v1.5.6 (6.3) clicar no selo ISOLA o par (escurece o resto); limpar volta ao normal', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(mkDupPDF())); await sleep(30);
    const cluster = w.document.querySelector('#mapa-container .cell-span[data-dupcluster]').dataset.dupcluster;
    w.isolarDuplicata(cluster); await sleep(10);
    ok(w.document.getElementById('mapa-wrapper').classList.contains('dup-isolando'), 'modo isolamento ativo');
    eq(w.document.querySelectorAll('.cell-span.dup-foco').length, 2, 'só o par em foco');
    w.limparIsolamentoDup(); await sleep(10);
    ok(!w.document.getElementById('mapa-wrapper').classList.contains('dup-isolando'), 'clicar fora volta à visão normal');
  });

  await T('v1.5.6 (6.3) homônimos e multi-apto NÃO recebem selo (sem regressão)', async () => {
    const { w } = await novoApp();
    const pdf = [
      bloco('91001', diasDeHoje(0), diasDeHoje(4), '801', 'WHATSAPP', 'GARAGEM PEQUENO', 'JOAO SILVA'),
      bloco('91002', diasDeHoje(0), diasDeHoje(4), '802', 'WHATSAPP', 'GARAGEM PEQUENO', 'JOAO SILVA'), // homônimo
      bloco('91003', diasDeHoje(0), diasDeHoje(4), '803', 'WHATSAPP', 'GARAGEM PEQUENO', 'MULTI APTO'),
      bloco('91003', diasDeHoje(0), diasDeHoje(4), '804', 'WHATSAPP', 'GARAGEM PEQUENO', 'MULTI APTO'), // mesmo nº, apto diferente
    ].join('\n');
    await w.importarPDF(w.parsear(pdf)); await sleep(30);
    eq(w.document.querySelectorAll('#mapa-container .dup-badge').length, 0, 'nenhum selo (homônimos e multi-apto são legítimos)');
  });

  /* ════════════════════════ v1.5.6.1 — amarelo translúcido como azul/verde ════════════════════════ */
  // Lê as regras pelo CSSOM do documento carregado (não pelo texto do arquivo): garante que o que
  // chega ao navegador é a MESMA receita para os três status, e que nada pinta o bloco por inline.
  const regraDe = (w, sel) => {
    for (const sh of w.document.styleSheets) {
      for (const r of (sh.cssRules || [])) if (r.selectorText && r.selectorText.replace(/\s+/g, ' ') === sel) return r.style;
    }
    return null;
  };

  await T('v1.5.6.1 (7.1) CSSOM: amarelo tem a mesma receita do azul/hospedado (fundo -bg + borda matiz)', async () => {
    const { w } = await novoApp();
    const am = regraDe(w, '.cell-span.amarelo'), az = regraDe(w, '.cell-span.azul'), ho = regraDe(w, '.cell-span.hospedado');
    ok(am && az && ho, 'as três regras chegam ao CSSOM');
    eq(am.background || am.backgroundColor, 'var(--amarelo-bg)', 'fundo translúcido (nunca var(--amarelo) sólido)');
    eq(az.background || az.backgroundColor, 'var(--azul-bg)', 'azul intacto');
    eq(ho.background || ho.backgroundColor, 'var(--hosped-bg)', 'hospedado intacto');
    const semMatiz = st => (st.border || '').replace(/var\(--[a-z-]+\)/, 'MATIZ').replace(/\s+/g, ' ').trim();
    eq(semMatiz(am), semMatiz(az), 'mesma borda do azul');
    eq(semMatiz(am), semMatiz(ho), 'mesma borda do hospedado');
    ok(!regraDe(w, '.cell-span.amarelo .cell-info'), 'sem override de .cell-info no amarelo (herda --muted como o azul)');
  });

  await T('v1.5.6.1 (7.1) blocos aguardando e confirmado: estilo só pela classe, nada inline', async () => {
    const { w } = await novoApp();
    const ent = diasDeHoje(0), sai = diasDeHoje(4);
    const pdf = [
      bloco('95001', ent, sai, '901', 'WHATSAPP', 'GARAGEM PEQUENO', 'AZUL CONFIRMADO'),
      bloco('95002', ent, sai, '902', 'WHATSAPP', 'VERIFICAR INTERESSE', 'AMARELO AGUARDANDO'),
    ].join('\n');
    await w.importarPDF(w.parsear(pdf)); await sleep(30);
    const am = w.document.querySelector('#mapa-container .cell-span.amarelo');
    const az = w.document.querySelector('#mapa-container .cell-span.azul');
    ok(am && az, 'um bloco de cada status no mapa');
    [am, az].forEach(el => {
      eq(el.style.background, '', 'sem background inline (' + el.className + ')');
      eq(el.style.backgroundColor, '', 'sem background-color inline (' + el.className + ')');
      eq(el.style.borderColor, '', 'sem borda inline (' + el.className + ')');
    });
    // as variações do bloco (nome duplo, "Carro 0N"/.cell-info) não recebem cor própria no amarelo
    ok(!am.querySelector('[style*="color"]'), 'nada colorido por inline dentro do bloco amarelo');
  });

  await T('v1.5.6.1 (7.4) busca/isolamento tratam o amarelo como qualquer outro bloco', async () => {
    const { w } = await novoApp();
    const ent = diasDeHoje(0), sai = diasDeHoje(4);
    const pdf = [
      bloco('95003', ent, sai, '903', 'WHATSAPP', 'GARAGEM PEQUENO', 'ALVO BUSCA'),
      bloco('95004', ent, sai, '904', 'WHATSAPP', 'VERIFICAR INTERESSE', 'OUTRO AGUARDA'),
    ].join('\n');
    await w.importarPDF(w.parsear(pdf)); await sleep(30);
    w.onBuscaInput('ALVO BUSCA'); await sleep(20);
    ok(w.document.getElementById('mapa-wrapper').classList.contains('busca-ativa'), 'busca ativa');
    const am = w.document.querySelector('#mapa-container .cell-span.amarelo');
    ok(am && !am.classList.contains('busca-hit'), 'o amarelo fora da busca é escurecido pela regra genérica');
    eq(am.style.opacity, '', 'sem tratamento inline por cor');
  });

  /* ════════════════════════ v1.5.7 ════════════════════════ */
  const OBS_TOTAL4 = 'GARAGEM TOTAL 04 CARROS (03 PEQUENOS E 01 GRANDE)';
  const pdfMultiApto = (nro, obs) => ['352', '354', '355', '387', '390']
    .map(a => bloco(nro, diasDeHoje(0), diasDeHoje(4), a, 'BOOKING 413101ID20542561', obs, 'FAMILIA HENRICHSEN')).join('\n');

  await T('v1.5.7 (7.1) reserva multi-apto com TOTAL 04 → 4 blocos no mapa, não 20', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(pdfMultiApto('26389', OBS_TOTAL4))); await sleep(40);
    const blocos = [...w.document.querySelectorAll('#mapa-container .cell-span')]
      .filter(s => /FAMILIA HENRICHSEN/.test(s.textContent));
    eq(blocos.length, 4, 'exatamente 4 carros no mapa');
    ok(/Carro 04/.test(blocos.map(s => s.textContent).join(' ')), 'numerados até "Carro 04"');
    ok(!/Carro 0?5|de 20/.test(blocos.map(s => s.textContent).join(' ')), 'nenhum vestígio da explosão');
    const regs = (await w.dbGetAll('reservas')).filter(r => String(r.nro) === '26389' && r.ativo !== false);
    eq(regs.length, 4, 'o banco também guarda 4');
  });

  await T('v1.5.7 (7.1) multi-apto NÃO recebe selo de duplicata', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(pdfMultiApto('26389', OBS_TOTAL4))); await sleep(40);
    eq(w.document.querySelectorAll('#mapa-container .dup-badge').length, 0, 'multi-apto é legítimo');
  });

  await T('v1.5.7 (7.2) CENTRAL: mover UM carro não move os outros carros da reserva', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(pdfMultiApto('26389', OBS_TOTAL4))); await sleep(40);
    // chave = identificação do CARRO (.cell-info: "#nro · Ap X · Carro NN"). Não usar o texto todo:
    // o bloco arrastado ganha o marcador ✋ no nome e a chave mudaria junto.
    const posicoes = () => {
      const m = {};
      w.document.querySelectorAll('#mapa-container .cell-span').forEach(s => {
        const cel = s.closest('[data-vaga]'); const info = s.querySelector('.cell-info');
        if (cel && info) m[info.textContent.replace(/\s+/g, ' ').trim()] = cel.dataset.vaga;
      });
      return m;
    };
    const antes = posicoes();
    const alvo = w.conjuntoAtivo().find(r => String(r.nro) === '26389' && r.apto === '354');
    ok(alvo, 'achou o carro do apto 354');
    await w.salvarAjuste(w.chaveCarro(alvo), 'P17'); await sleep(40);
    const ajustes = await w.dbGetAll('ajustes');
    eq(ajustes.length, 1, 'um único registro de ajuste');
    eq(ajustes[0].nro, '26389__354__1', 'gravado pela chave do CARRO, não pelo nº da reserva');
    const depois = posicoes();
    const movidos = Object.keys(antes).filter(k => depois[k] && depois[k] !== antes[k]);
    eq(movidos.length, 1, 'só um bloco mudou de vaga (os outros 3 carros ficaram)');
    eq(w.document.querySelectorAll('#mapa-container .cell-span.tem-ajuste').length, 1, 'só um ✋');
  });

  await T('v1.5.7 (7.2) ajuste LEGADO (por nº) segue valendo — nada se perde na virada', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(bloco('28001', diasDeHoje(0), diasDeHoje(4), '601', 'WHATSAPP', 'GARAGEM PEQUENO', 'LEGADO UM'))); await sleep(30);
    await w.dbPut('ajustes', { nro: '28001', vagaIdManual: 'P12', statusManual: null, criadoEm: 1, atualizadoEm: 1 });
    await w.carregarAjustes(); await sleep(10); w.renderMapa(); await sleep(20);
    const bl = [...w.document.querySelectorAll('#mapa-container .cell-span')].find(s => /LEGADO UM/.test(s.textContent));
    ok(bl, 'bloco presente');
    eq(bl.closest('[data-vaga]').dataset.vaga, 'P12', 'ajuste gravado por nº continua posicionando');
  });

  await T('v1.5.7 (7.3) "Carro X de N" recomputa ao dar baixa em carros', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(pdfMultiApto('26390', 'GARAGEM TOTAL 05 CARROS'))); await sleep(40);
    const rotulos = () => [...w.document.querySelectorAll('#mapa-container .cell-carro')].map(e => e.textContent).sort();
    eq(rotulos().length, 5, '5 carros no mapa');
    eq(rotulos().join(','), 'Carro 01,Carro 02,Carro 03,Carro 04,Carro 05');
    const carros = w.conjuntoAtivo().filter(r => String(r.nro) === '26390');
    await w.salvarStatusManual(w.chaveCarro(carros[1]), 'sem_garagem');
    await w.salvarStatusManual(w.chaveCarro(carros[3]), 'sem_garagem'); await sleep(40);
    eq(rotulos().join(','), 'Carro 01,Carro 02,Carro 03', 'os 3 restantes reindexaram na hora');
    const total = [...w.document.querySelectorAll('#mapa-container .cell-span')]
      .filter(s => /FAMILIA HENRICHSEN/.test(s.textContent)).length;
    eq(total, 3, 'os 2 com baixa saíram do mapa');
  });

  await T('v1.5.7 (7.6) colunas de sábado/domingo e de feriado recebem o realce, pela DATA', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(bloco('28100', diasDeHoje(0), diasDeHoje(20), '701', 'WHATSAPP', 'GARAGEM PEQUENO', 'REALCE'))); await sleep(40);
    // a janela vem dos inputs de filtro do próprio app (dataInicio/dataFim são `let` de módulo)
    const datas = [];
    const d = new Date(w.document.getElementById('data-inicio').value + 'T00:00:00');
    const fim = new Date(w.document.getElementById('data-fim').value + 'T00:00:00');
    while (d <= fim) { datas.push(new Date(d)); d.setDate(d.getDate() + 1); }
    const cells = [...w.document.querySelectorAll('#mapa-container .vaga-row .row-cells')[0].querySelectorAll('.cell')];
    eq(cells.length, datas.length, 'uma célula por dia');
    datas.forEach((dt, i) => {
      const esperado = w.realceDoDia(dt);
      const tem = cells[i].classList.contains('feriado') ? 'feriado' : (cells[i].classList.contains('fds') ? 'fds' : '');
      eq(tem, esperado, `coluna ${dt.toDateString()}`);
    });
    // o cabeçalho segue a mesma regra
    const heads = [...w.document.querySelectorAll('#mapa-container .dates-row')[0].querySelectorAll('.date-cell')];
    datas.forEach((dt, i) => {
      const esperado = w.realceDoDia(dt);
      const tem = heads[i].classList.contains('feriado') ? 'feriado' : (heads[i].classList.contains('fds') ? 'fds' : '');
      eq(tem, esperado, `cabeçalho ${dt.toDateString()}`);
    });
    ok(datas.some(dt => w.ehFimDeSemana(dt)), 'a janela contém ao menos um fim de semana');
  });

  await T('v1.5.7 (7.6) realce é FUNDO: não altera nenhuma cor de bloco de status', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear([
      bloco('28200', diasDeHoje(0), diasDeHoje(9), '801', 'WHATSAPP', 'VERIFICAR INTERESSE', 'AGUARDA REALCE'),
      bloco('28201', diasDeHoje(0), diasDeHoje(9), '802', 'WHATSAPP', 'GARAGEM PEQUENO', 'CONFIRMA REALCE')].join('\n'))); await sleep(40);
    const am = w.document.querySelector('#mapa-container .cell-span.amarelo');
    const az = w.document.querySelector('#mapa-container .cell-span.azul');
    ok(am && az, 'blocos presentes');
    [am, az].forEach(el => {
      eq(el.style.background, '', 'sem fundo inline no bloco');
      ok(!el.classList.contains('fds') && !el.classList.contains('feriado'), 'o realce não entra no bloco');
    });
  });

  await T('v1.5.7 (7.4) Limpar: SEM confirmar não apaga nada', async () => {
    const { w } = await novoApp();
    await w.importarPDF(w.parsear(bloco('29001', diasDeHoje(0), diasDeHoje(4), '901', 'WHATSAPP', 'GARAGEM PEQUENO', 'FICA'))); await sleep(30);
    w.abrirLimparInformacoes(); await sleep(10);
    eq(w.document.getElementById('limpar-modal').style.display, 'flex', 'modal de confirmação aberto');
    w.fecharLimparInformacoes(); await sleep(20);
    ok((await w.dbGetAll('reservas')).length > 0, 'cancelar não apagou nada');
    ok(w.document.querySelector('#mapa-container .cell-span'), 'mapa intacto');
  });

  await T('v1.5.7 (7.4) CENTRAL: Limpar zera os dados de reserva e PRESERVA a Gestão', async () => {
    const { w } = await novoApp();
    // dados de reserva de todas as origens
    await w.importarPDF(w.parsear(bloco('29002', diasDeHoje(0), diasDeHoje(4), '902', 'WHATSAPP', 'GARAGEM PEQUENO', 'SOME'))); await sleep(30);
    await w.importarComandas(w.parsearComandas(montarComandas())); await sleep(30);
    const alvo = w.conjuntoAtivo().find(r => String(r.nro) === '29002');
    await w.salvarAjuste(w.chaveCarro(alvo), 'P5'); await sleep(20);
    w.trocarAba('contato'); await sleep(20);
    const inp = w.document.getElementById('fone-29002'); if (inp) inp.value = '5547999998888';
    await w.confirmarTelefone('29002'); await sleep(20);
    await w.registrarEnvio('29002', 'verificando', 0); await sleep(20);
    w.trocarAba('mapa'); await sleep(20);
    await w.salvarReservaManual(w.montarReservaManual(
      { nome: 'MANUAL SOME', tipo: 'P', entrada: diasDeHoje(0), saida: diasDeHoje(3), nro: '29003' },
      { funcionario: 'Ana', dataHora: new Date().toISOString() })); await sleep(20);
    // Gestão com conteúdo próprio
    w.gestaoSetEmpresa('Hotel Gumz'); await w.gestaoAddFuncionario('Douglas'); await sleep(20);
    const gestaoAntes = JSON.stringify(await w.dbGetAll('gestao'));
    ok(gestaoAntes.length > 2, 'Gestão tinha dados');

    await w.limparInformacoes(); await sleep(60);

    for (const s of ['reservas', 'hospedados', 'ajustes', 'reservasManuais', 'contatos', 'envios']) {
      eq((await w.dbGetAll(s)).length, 0, `store "${s}" vazio`);
    }
    eq(JSON.stringify(await w.dbGetAll('gestao')), gestaoAntes, 'Gestão PRESERVADA byte a byte');
    eq(w.document.querySelectorAll('#mapa-container .cell-span').length, 0, 'mapa vazio');
    eq(w.conjuntoAtivo().length, 0, 'estado em memória zerado');
    // e volta a funcionar: importar de novo
    await w.importarPDF(w.parsear(bloco('29010', diasDeHoje(0), diasDeHoje(4), '910', 'WHATSAPP', 'GARAGEM PEQUENO', 'DEPOIS'))); await sleep(40);
    ok(w.document.querySelector('#mapa-container .cell-span'), 'importar depois do clear funciona');
  });

  console.log(`\nINTEGRAÇÃO (jsdom + fake-indexeddb): ${pass}/${pass + fail} ✓`);
  if (fail) { console.log('\nFALHAS:'); fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
})();
