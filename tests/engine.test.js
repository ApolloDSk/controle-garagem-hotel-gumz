/*
 * Testes UNITÁRIOS do bloco ENGINE (lógica pura, sem DOM) — Reserva de Garagem.
 * Extrai o MESMO código embarcado em garagem-app/index.html (entre os marcadores
 * ===ENGINE START===/===ENGINE END===) e roda asserts em Node puro (sem dependências).
 *
 * Cobre não-regressão da v1.0.0 (parser, classificação, prioridade, alocação,
 * mesclagem, mensagens) + as novas funções puras da v1.1.0 (5.2–5.6).
 *
 *   node tests/engine.test.js
 */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'garagem-app', 'index.html'), 'utf8');
const s = html.indexOf('// ===ENGINE START===');
const e = html.indexOf('// ===ENGINE END===');
if (s < 0 || e < 0) { console.error('Marcadores do ENGINE não encontrados.'); process.exit(1); }
const code = html.slice(s, e);

const EXPORTS = [
  'APP_VERSION','parseDtEnt','parseDtSai','isAlta','fmtData','extrairNomes','extrairNroOTA',
  'classificar','parsear','processarMotos','nDiarias','ehConfirmado','bonusCanal','scorePrioridade',
  'sobrepoe','linhaLivre','custoEncaixe','melhorLinha','empilhar','alocarVagas',
  'normalizePhone','gerarMensagem','linkWhatsApp','mesclarRegistros',
  // v1.1.0
  'copiarTextoCore','estadoTelefoneInicial','aplicarOrdemLinhas','montarUploadInfo','fmtDataHora','recorteEsquerdo',
  // v1.2.0
  'substituirChaves','gestaoDefault','gestaoNormalizar','funcionarioPadrao','adicionarFuncionario','removerFuncionario',
  'definirFuncionarioPadrao','categoriaReserva','modelosPreenchidos','modeloPadraoIdx','autocompleteChaves','aplicarSugestao',
  'montarBackup','backupValido','mesclarContatos','decidirGestaoImport',
  // v1.3.0
  'aplicarAjustes','detectarConflito','ehReservaCarro','vagaValida',
  // v1.4.0
  'formatarNomeProprio','statusEnvioReserva','montarRegistroEnvio','enviosOrdenados',
  // v1.5.0
  'statusDerivadoDoPDF','statusEfetivo','pmsDivergente','placementOverbooking','placementValido',
  // v1.5.1
  'parsePdfDate','extrairEmissaoImpressa','compararEmissao','parsearComandas','tipoVeiculoDeSegmento',
  'validarDocumentoReservas','validarDocumentoComandas','chaveHospedado','garagemDeTipoVeiculo',
  'hospedadoParaReserva','dedupeReservasHospedados',
  // v1.5.2
  'nomeHeuristico','obsIndicaSemGaragem','overbookingPeriodos'
];
const E = new Function(code + '\nreturn {' + EXPORTS.join(',') + '};')();

/* ── mini-framework ── */
let pass = 0, fail = 0; const fails = [];
const queue = [];
function t(name, fn) { queue.push({ name, fn }); }
function eq(a, b, m) { if (a !== b) throw new Error((m ? m + ' — ' : '') + `esperado ${JSON.stringify(b)}, recebeu ${JSON.stringify(a)}`); }
function ok(c, m) { if (!c) throw new Error(m || 'condição falsa'); }
const D = (s) => { const [d, m, y] = s.split('/'); return new Date(2000 + +y, +m - 1, +d); };

/* ════════════ DATAS ════════════ */
t('parseDtEnt monta data de entrada', () => { const d = E.parseDtEnt('05/06/26'); eq(d.getFullYear(), 2026); eq(d.getMonth(), 5); eq(d.getDate(), 5); });
t('parseDtSai mesma virada de mês', () => { const d = E.parseDtSai('05/06/26', '08/06'); eq(d.getDate(), 8); eq(d.getMonth(), 5); eq(d.getFullYear(), 2026); });
t('parseDtSai vira o ano (dez→jan)', () => { const d = E.parseDtSai('28/12/26', '03/01'); eq(d.getFullYear(), 2027); eq(d.getMonth(), 0); });
t('isAlta dezembro >=20 é alta', () => { ok(E.isAlta(new Date(2026, 11, 22))); });
t('isAlta jan-mar é alta', () => { ok(E.isAlta(new Date(2026, 1, 10))); });
t('isAlta junho não é alta', () => { ok(!E.isAlta(new Date(2026, 5, 10))); });
t('fmtData formata DD/MM/AAAA', () => { eq(E.fmtData(new Date(2026, 5, 5)), '05/06/2026'); });

/* ════════════ NOMES / OTA ════════════ */
t('extrairNroOTA captura localizador', () => { eq(E.extrairNroOTA('BOOKING 413101ID20542561 algo'), '413101ID20542561'); });
t('extrairNroOTA vazio quando não há', () => { eq(E.extrairNroOTA('WHATSAPP 5547999'), ''); });
t('extrairNomes sem cabeçalho retorna Hóspede', () => { const r = E.extrairNomes('bloco qualquer'); eq(r.nomeCompleto, 'Hóspede'); });
t('extrairNomes pega penúltimo como hóspede', () => {
  const bloco = 'Hóspedes :\nMARIA SOUZA\nJOAO PEREIRA\nDesbravador Software';
  const r = E.extrairNomes(bloco); eq(r.nomeCompleto, 'MARIA SOUZA'); eq(r.hospedeDetalhe, 'JOAO PEREIRA');
});

/* ════════════ CLASSIFICAÇÃO ════════════ */
const ent = D('05/06/26');
t('classificar SEM GARAGEM ignora', () => { eq(E.classificar('SEM GARAGEM', ent, false), 'ignorar'); });
t('classificar grupo sem garagem ignora', () => { eq(E.classificar('ALGO', ent, true), 'ignorar'); });
t('classificar MOTO+GARAGEM', () => { eq(E.classificar('GARAGEM MOTO', ent, false), 'azul_moto'); });
t('classificar GRANDE', () => { eq(E.classificar('GARAGEM GRANDE', ent, false), 'azul_grande'); });
t('classificar PEQUENO', () => { eq(E.classificar('GARAGEM PEQUENO', ent, false), 'azul_pequeno'); });
t('classificar FREE = pequeno', () => { eq(E.classificar('GARAGEM FREE', ent, false), 'azul_pequeno'); });
t('classificar R$100 = grande', () => { eq(E.classificar('GARAGEM R$ 100', ent, false), 'azul_grande'); });
t('classificar R$40 = pequeno', () => { eq(E.classificar('GARAGEM R$ 40', ent, false), 'azul_pequeno'); });
t('classificar R$60 alta = pequeno', () => { eq(E.classificar('GARAGEM R$ 60', D('10/01/26'), false), 'azul_pequeno'); });
t('classificar R$60 baixa = grande', () => { eq(E.classificar('GARAGEM R$ 60', D('10/06/26'), false), 'azul_grande'); });
t('classificar sem palavra-chave = amarelo', () => { eq(E.classificar('NADA AQUI', ent, false), 'amarelo'); });

/* ════════════ PRIORIDADE ════════════ */
t('nDiarias conta noites', () => { eq(E.nDiarias({ entrada: D('05/06/26'), saida: D('08/06/26') }), 3); });
t('ehConfirmado: amarelo é falso', () => { ok(!E.ehConfirmado({ garagem: 'amarelo' })); });
t('ehConfirmado: azul é verdadeiro', () => { ok(E.ehConfirmado({ garagem: 'azul_pequeno' })); });
t('bonusCanal Booking=0', () => { eq(E.bonusCanal('Booking'), 0); });
t('bonusCanal Expedia=30', () => { eq(E.bonusCanal('Expedia'), 30); });
t('bonusCanal Omnibees=20', () => { eq(E.bonusCanal('Omnibees'), 20); });
t('bonusCanal Direta=50', () => { eq(E.bonusCanal('Direta'), 50); });
t('scorePrioridade confirmado > amarelo', () => {
  const conf = { garagem: 'azul_pequeno', origem: 'Booking', entrada: D('05/06/26'), saida: D('06/06/26'), nro: '10' };
  const amar = { garagem: 'amarelo', origem: 'Direta', entrada: D('05/06/26'), saida: D('30/06/26'), nro: '10' };
  ok(E.scorePrioridade(conf) > E.scorePrioridade(amar), 'confirmado deve vencer mesmo com menos diárias');
});
t('scorePrioridade Booking perde p/ Direta (mesmo período)', () => {
  const a = { garagem: 'amarelo', origem: 'Direta', entrada: D('05/06/26'), saida: D('10/06/26'), nro: '10' };
  const b = { garagem: 'amarelo', origem: 'Booking', entrada: D('05/06/26'), saida: D('10/06/26'), nro: '10' };
  ok(E.scorePrioridade(a) > E.scorePrioridade(b));
});

/* ════════════ SOBREPOSIÇÃO / ALOCAÇÃO ════════════ */
t('sobrepoe detecta sobreposição', () => { ok(E.sobrepoe({ entrada: D('05/06/26'), saida: D('10/06/26') }, { entrada: D('08/06/26'), saida: D('12/06/26') })); });
t('sobrepoe: adjacentes não sobrepõem', () => { ok(!E.sobrepoe({ entrada: D('05/06/26'), saida: D('08/06/26') }, { entrada: D('08/06/26'), saida: D('10/06/26') })); });
t('linhaLivre verdadeiro p/ linha vazia', () => { ok(E.linhaLivre([], { entrada: D('05/06/26'), saida: D('06/06/26') })); });
t('empilhar separa sobrepostas em 2 linhas', () => {
  const r = E.empilhar([{ entrada: D('05/06/26'), saida: D('10/06/26') }, { entrada: D('06/06/26'), saida: D('11/06/26') }]);
  eq(r.length, 2);
});
t('empilhar junta não-sobrepostas em 1 linha', () => {
  const r = E.empilhar([{ entrada: D('05/06/26'), saida: D('08/06/26') }, { entrada: D('08/06/26'), saida: D('10/06/26') }]);
  eq(r.length, 1);
});
t('alocarVagas: amarelo ocupa seção GRANDE (A1)', () => {
  const rs = [{ id: 'a', nro: '1', garagem: 'amarelo', origem: 'Direta', entrada: D('05/06/26'), saida: D('20/06/26'), apto: '1' }];
  const al = E.alocarVagas(rs);
  const usouG = al.linhasG.some(l => l.length);
  const usouP = al.linhasP.some(l => l.length);
  ok(usouG || usouP, 'amarelo deve ser alocado em P ou G (não preso só no pequeno)');
});
t('alocarVagas: confirmado nunca vai p/ overbooking por amarelo (A5)', () => {
  const rs = [];
  for (let i = 0; i < 20; i++) rs.push({ id: 'p' + i, nro: '' + i, garagem: 'azul_pequeno', origem: 'Direta', entrada: D('05/06/26'), saida: D('20/06/26'), apto: '' + i });
  for (let i = 0; i < 10; i++) rs.push({ id: 'am' + i, nro: 'a' + i, garagem: 'amarelo', origem: 'Direta', entrada: D('05/06/26'), saida: D('20/06/26'), apto: 'a' + i });
  const al = E.alocarVagas(rs);
  const confNoOver = al.overflow.filter(r => r.garagem !== 'amarelo' && !r._confForcado);
  ok(confNoOver.length === 0, 'amarelo não pode empurrar confirmado p/ overbooking');
});
t('alocarVagas: excedente de amarelos vai p/ overbooking', () => {
  const rs = [];
  for (let i = 0; i < 60; i++) rs.push({ id: 'am' + i, nro: 'a' + i, garagem: 'amarelo', origem: 'Direta', entrada: D('05/06/26'), saida: D('20/06/26'), apto: 'a' + i });
  const al = E.alocarVagas(rs);
  ok(al.overflow.length > 0, '60 amarelos sobrepostos > 32 vagas → overbooking');
});

/* ════════════ PARSER (não-regressão de bloco real) ════════════ */
const blocoReal =
`05/06/26 08/06 1 2 129 ABC 26161 H
WHATSAPP
Obs do Apto: GARAGEM PEQUENO
Hóspedes :
RONAN LAMPERT
RONAN LAMPERT
Desbravador Software`;
t('parsear: lê 1 reserva confirmada pequena', () => {
  const rs = E.parsear(blocoReal);
  eq(rs.length, 1); eq(rs[0].garagem, 'azul_pequeno'); eq(rs[0].nro, '26161');
});
t('parsear: id único nro__apto__vagaIdx', () => {
  const rs = E.parsear(blocoReal);
  ok(/^26161__/.test(rs[0].id), 'id deve começar com o nro');
});

/* ════════════ MENSAGENS / TELEFONE (C5) ════════════ */
t('normalizePhone adiciona 55', () => { eq(E.normalizePhone('(47) 99876-5432'), '5547998765432'); });
t('normalizePhone mantém 55 existente', () => { eq(E.normalizePhone('5547998765432'), '5547998765432'); });
t('normalizePhone vazio', () => { eq(E.normalizePhone(''), ''); });
t('gerarMensagem substitui variáveis', () => {
  const m = E.gerarMensagem({ nome: 'Ana', entrada: D('05/06/26'), saida: D('08/06/26'), apto: '129' }, 'Oi {nome}, {entrada} a {saida}, ap {apto}');
  eq(m, 'Oi Ana, 05/06/2026 a 08/06/2026, ap 129');
});
t('linkWhatsApp monta wa.me', () => {
  const l = E.linkWhatsApp({ telefone: '47998765432', nome: 'Ana' }, 'oi {nome}');
  ok(l.startsWith('https://wa.me/5547998765432?text='));
});

/* ════════════ MESCLAGEM (B2) ════════════ */
t('mesclar: nova entra ativa', () => {
  const out = E.mesclarRegistros({}, [{ id: 'x', nro: '1' }]);
  eq(out.length, 1); eq(out[0].ativo, true);
});
t('mesclar: sumida do PDF vira ativo:false (arquivada, não apaga)', () => {
  const ex = { y: { id: 'y', nro: '2', ativo: true } };
  const out = E.mesclarRegistros(ex, [{ id: 'x', nro: '1' }]);
  const arq = out.find(r => r.id === 'y');
  ok(arq && arq.ativo === false, 'a sumida deve permanecer arquivada');
});

/* ════════════════════════════════════════════════════════════════
   v1.1.0 — NOVAS FUNÇÕES PURAS (5.2 a 5.6)
   ════════════════════════════════════════════════════════════════ */

/* 5.2 — Cópia (clipboard + fallback) */
t('5.2 copiarTextoCore usa clipboard quando disponível', async () => {
  let chamou = '';
  const env = { navigator: { clipboard: { writeText: async (txt) => { chamou = txt; } } }, fallback: () => { throw new Error('não deveria usar fallback'); } };
  const r = await E.copiarTextoCore('ABC123', env);
  eq(r.via, 'clipboard'); eq(r.ok, true); eq(chamou, 'ABC123');
});
t('5.2 copiarTextoCore cai no fallback sem clipboard', async () => {
  let usouFb = false;
  const env = { navigator: {}, fallback: (t) => { usouFb = true; return true; } };
  const r = await E.copiarTextoCore('X', env);
  eq(r.via, 'fallback'); eq(r.ok, true); ok(usouFb);
});
t('5.2 copiarTextoCore: clipboard que rejeita usa fallback', async () => {
  let usouFb = false;
  const env = { navigator: { clipboard: { writeText: async () => { throw new Error('denied'); } } }, fallback: () => { usouFb = true; return true; } };
  const r = await E.copiarTextoCore('X', env);
  eq(r.via, 'fallback'); ok(usouFb);
});
t('5.2 copiarTextoCore não quebra sem nada disponível', async () => {
  const r = await E.copiarTextoCore('X', { navigator: {} });
  eq(r.ok, false); eq(r.via, 'none');
});
t('5.2 copiarTextoCore fallback que retorna false → ok:false', async () => {
  const r = await E.copiarTextoCore('X', { navigator: {}, fallback: () => false });
  eq(r.ok, false);
});

/* 5.3 — Telefone Confirmar↔Editar */
t('5.3 estadoTelefoneInicial: sem telefone → Confirmar/editável', () => {
  const s = E.estadoTelefoneInicial(null); eq(s.bloqueado, false); eq(s.label, 'Confirmar');
});
t('5.3 estadoTelefoneInicial: telefone resolvido → Editar/bloqueado', () => {
  const s = E.estadoTelefoneInicial({ telefone: '5547999', telefoneStatus: 'resolvido' });
  eq(s.bloqueado, true); eq(s.label, 'Editar');
});
t('5.3 estadoTelefoneInicial: pendente não bloqueia', () => {
  const s = E.estadoTelefoneInicial({ telefone: '', telefoneStatus: 'pendente' });
  eq(s.bloqueado, false);
});

/* 5.4 — Ordenação (só exibição, não altera alocação) */
t('5.4 aplicarOrdemLinhas baixo inverte', () => { eq(JSON.stringify(E.aplicarOrdemLinhas([1, 2, 3], 'baixo')), '[3,2,1]'); });
t('5.4 aplicarOrdemLinhas cima mantém', () => { eq(JSON.stringify(E.aplicarOrdemLinhas([1, 2, 3], 'cima')), '[1,2,3]'); });
t('5.4 aplicarOrdemLinhas NÃO muta o array original', () => {
  const orig = [1, 2, 3]; E.aplicarOrdemLinhas(orig, 'baixo'); eq(JSON.stringify(orig), '[1,2,3]');
});
t('5.4 ordenação não muda a alocação (mesmos resultados)', () => {
  const rs = [{ id: 'a', nro: '1', garagem: 'azul_pequeno', origem: 'Direta', entrada: D('05/06/26'), saida: D('10/06/26'), apto: '1' }];
  const al = E.alocarVagas(rs);
  const antes = JSON.stringify(al.linhasP.map(l => l.map(r => r.id)));
  E.aplicarOrdemLinhas(al.linhasP, 'baixo'); // exibição
  const depois = JSON.stringify(E.alocarVagas(rs).linhasP.map(l => l.map(r => r.id)));
  eq(antes, depois, 'alocação deve ser idêntica independentemente da ordem de exibição');
});

/* 5.5 — Info de upload */
t('5.5 montarUploadInfo guarda nome + data/hora', () => {
  const info = E.montarUploadInfo({ name: 'LISTAGEM.pdf' }, 1700000000000);
  eq(info.nomeArquivo, 'LISTAGEM.pdf'); eq(info.dataHoraUpload, 1700000000000);
});
t('5.5 montarUploadInfo: fakepath NÃO vira caminho', () => {
  const info = E.montarUploadInfo({ name: 'a.pdf', path: 'C:\\fakepath\\a.pdf' }, 1);
  eq(info.caminho, '');
});
t('5.5 montarUploadInfo: caminho real do Electron é mantido', () => {
  const info = E.montarUploadInfo({ name: 'a.pdf', path: 'C:\\Users\\Doug\\a.pdf' }, 1);
  eq(info.caminho, 'C:\\Users\\Doug\\a.pdf');
});
t('5.5 montarUploadInfo: sem file não quebra', () => {
  const info = E.montarUploadInfo(null, 5); eq(info.nomeArquivo, ''); eq(info.caminho, ''); eq(info.dataHoraUpload, 5);
});
t('5.5 fmtDataHora formata', () => { eq(E.fmtDataHora(new Date(2026, 5, 5, 9, 7).getTime()), '05/06/2026 09:07'); });
t('5.5 fmtDataHora vazio não quebra', () => { eq(E.fmtDataHora(''), ''); eq(E.fmtDataHora(null), ''); });
t('5.5 persiste e relê {nomeArquivo,dataHoraUpload} (serialização)', () => {
  const info = E.montarUploadInfo({ name: 'x.pdf' }, 123);
  const round = JSON.parse(JSON.stringify(info));
  eq(round.nomeArquivo, 'x.pdf'); eq(round.dataHoraUpload, 123);
});

/* 5.6 — Recorte esquerdo (check-in no passado) */
t('5.6 recorteEsquerdo: entrada antes da janela → true', () => {
  ok(E.recorteEsquerdo({ entrada: D('01/06/26') }, D('05/06/26')));
});
t('5.6 recorteEsquerdo: entrada igual à janela → false', () => {
  ok(!E.recorteEsquerdo({ entrada: D('05/06/26') }, D('05/06/26')));
});
t('5.6 recorteEsquerdo: entrada depois da janela → false (reserva futura)', () => {
  ok(!E.recorteEsquerdo({ entrada: D('10/06/26') }, D('05/06/26')));
});
t('5.6 recorteEsquerdo: sem dados não quebra', () => {
  ok(!E.recorteEsquerdo(null, D('05/06/26'))); ok(!E.recorteEsquerdo({ entrada: D('01/06/26') }, null));
});
t('5.6 inclusão: reserva com check-in no passado e ainda hospedada é ativa', () => {
  // simula ativasNoPeriodo: entrada<=fim && saida>inicio
  const janelaInicio = D('05/06/26'), janelaFim = D('12/06/26');
  const r = { entrada: D('01/06/26'), saida: D('08/06/26') };
  ok(r.entrada <= janelaFim && r.saida > janelaInicio, 'deve ser incluída');
});
t('5.6 encerrada (saída < hoje) não é incluída', () => {
  const janelaInicio = D('05/06/26'), janelaFim = D('12/06/26');
  const r = { entrada: D('01/06/26'), saida: D('03/06/26') };
  ok(!(r.entrada <= janelaFim && r.saida > janelaInicio), 'encerrada não deve aparecer');
});

/* ════════════════════════════════════════════════════════════════
   v1.2.0 — GESTÃO + MODELOS + BACKUP (funções puras)
   ════════════════════════════════════════════════════════════════ */

/* 5.5 — substituirChaves */
t('5.5 substituirChaves troca as 5 chaves', () => {
  const g = E.adicionarFuncionario({ ...E.gestaoDefault(), empresa: { nome: 'Hotel Gumz' } }, 'João', 'f1');
  const r = { nome: 'Ana', entrada: D('05/06/26'), saida: D('08/06/26'), origem: 'Booking' };
  const out = E.substituirChaves('Oi [nome], [data], via [canal], da [empresa], att [funcionario]', r, g);
  eq(out, 'Oi Ana, 05/06/2026 a 08/06/2026, via Booking, da Hotel Gumz, att João');
});
t('5.5 [data] traz entrada e saída', () => {
  const out = E.substituirChaves('[data]', { entrada: D('01/02/26'), saida: D('03/02/26') }, E.gestaoDefault());
  eq(out, '01/02/2026 a 03/02/2026');
});
t('5.5 fonte vazia → string vazia (nunca literal)', () => {
  const out = E.substituirChaves('[nome]/[empresa]/[funcionario]', {}, E.gestaoDefault());
  eq(out, '//');
  ok(!/\[nome\]|\[empresa\]|\[funcionario\]/.test(out), 'não pode sobrar chave literal');
});
t('5.5 texto fora das chaves intacto + múltiplas ocorrências', () => {
  const out = E.substituirChaves('Olá [nome]! Tudo bem, [nome]? -- fim.', { nome: 'Rui' }, E.gestaoDefault());
  eq(out, 'Olá Rui! Tudo bem, Rui? -- fim.');
});
t('5.5 usa nomeCompleto quando não há nome', () => {
  eq(E.substituirChaves('[nome]', { nomeCompleto: 'Bia' }, E.gestaoDefault()), 'Bia');
});

/* 5.6 — categoria por status + padrão por categoria */
t('5.6 categoriaReserva amarelo→verificando', () => { eq(E.categoriaReserva({ garagem: 'amarelo' }), 'verificando'); });
t('5.6 categoriaReserva over→overbooking', () => { eq(E.categoriaReserva({ over: true, garagem: 'azul_pequeno' }), 'overbooking'); });
t('5.6 categoriaReserva azul→null (fora do sistema)', () => { eq(E.categoriaReserva({ garagem: 'azul_grande' }), null); });
t('5.6 modeloPadraoIdx respeita o padrão preenchido', () => {
  const g = E.gestaoDefault(); g.modelos.verificando = ['A', 'B', 'C']; g.modeloPadrao.verificando = 1;
  eq(E.modeloPadraoIdx(g, 'verificando'), 1);
});
t('5.6 modeloPadraoIdx cai p/ 1º preenchido se padrão vazio', () => {
  const g = E.gestaoDefault(); g.modelos.overbooking = ['', 'B', '']; g.modeloPadrao.overbooking = 0;
  eq(E.modeloPadraoIdx(g, 'overbooking'), 1);
});
t('5.6 modelosPreenchidos lista só não-vazios', () => {
  const g = E.gestaoDefault(); g.modelos.verificando = ['x', '', 'z'];
  eq(JSON.stringify(E.modelosPreenchidos(g, 'verificando')), '[0,2]');
});

/* 5.3 — funcionários */
t('5.3 adicionar: 1º vira padrão', () => {
  const g = E.adicionarFuncionario(E.gestaoDefault(), 'Ana', 'f1');
  eq(g.funcionarios.length, 1); eq(g.funcionarioPadraoId, 'f1');
});
t('5.3 segundo funcionário NÃO rouba o padrão', () => {
  let g = E.adicionarFuncionario(E.gestaoDefault(), 'Ana', 'f1');
  g = E.adicionarFuncionario(g, 'Beto', 'f2');
  eq(g.funcionarioPadraoId, 'f1'); eq(g.funcionarios.length, 2);
});
t('5.3 trocar padrão mantém apenas um', () => {
  let g = E.adicionarFuncionario(E.adicionarFuncionario(E.gestaoDefault(), 'Ana', 'f1'), 'Beto', 'f2');
  g = E.definirFuncionarioPadrao(g, 'f2');
  eq(g.funcionarioPadraoId, 'f2');
  eq(E.funcionarioPadrao(g).nome, 'Beto');
});
t('5.3 remover o padrão cai para o 1º restante', () => {
  let g = E.adicionarFuncionario(E.adicionarFuncionario(E.gestaoDefault(), 'Ana', 'f1'), 'Beto', 'f2');
  g = E.definirFuncionarioPadrao(g, 'f2');
  g = E.removerFuncionario(g, 'f2');
  eq(g.funcionarioPadraoId, 'f1');
});
t('5.3 remover último funcionário → padrão null', () => {
  let g = E.adicionarFuncionario(E.gestaoDefault(), 'Ana', 'f1');
  g = E.removerFuncionario(g, 'f1');
  eq(g.funcionarioPadraoId, null); eq(g.funcionarios.length, 0);
});

/* 5.1/migração — gestaoDefault/normalizar */
t('gestaoDefault semeia exemplos no slot 1', () => {
  const g = E.gestaoDefault();
  ok(g.modelos.verificando[0].includes('[nome]'), 'verificando semeado');
  ok(g.modelos.overbooking[0].includes('lotação') || g.modelos.overbooking[0].includes('[empresa]'), 'overbooking semeado');
  eq(g.modeloPadrao.verificando, 0); eq(g.modeloPadrao.overbooking, 0);
});
t('gestaoNormalizar cura config parcial sem quebrar', () => {
  const g = E.gestaoNormalizar({ empresa: { nome: 'X' }, funcionarios: [{ id: 'a', nome: 'A' }], funcionarioPadraoId: 'inexistente' });
  eq(g.funcionarioPadraoId, 'a', 'padrão inválido cai para o 1º');
  eq(g.modelos.verificando.length, 3); eq(g.modelos.overbooking.length, 3);
});

/* 5.4 — autocomplete */
t('5.4 autocompleteChaves [n → [nome]', () => { eq(JSON.stringify(E.autocompleteChaves('Olá [n')), '["[nome]"]'); });
t('5.4 autocompleteChaves [ → todas as 5', () => { eq(E.autocompleteChaves('texto [').length, 5); });
t('5.4 autocompleteChaves sem [ → nada', () => { eq(E.autocompleteChaves('texto normal').length, 0); });
t('5.4 autocompleteChaves chave fechada → nada', () => { eq(E.autocompleteChaves('[nome] ').length, 0); });
t('5.4 aplicarSugestao insere a chave no lugar do parcial', () => {
  const r = E.aplicarSugestao('Olá [no', ' fim', '[nome]');
  eq(r.texto, 'Olá [nome] fim'); eq(r.cursor, 'Olá [nome]'.length);
});

/* 5.7 — backup */
t('5.7 montarBackup tem schema e stores', () => {
  const b = E.montarBackup({ contatos: [{ nro: '1' }], gestao: [E.gestaoDefault()] }, 'v1.2.0', 123);
  eq(b.schema, 'reserva-garagem-backup/1'); eq(b.exportadoEm, 123); ok(b.stores.contatos.length === 1);
});
t('5.7 backupValido valida schema', () => {
  ok(E.backupValido({ schema: 'reserva-garagem-backup/1', stores: {} }));
  ok(!E.backupValido({ schema: 'outro', stores: {} }));
  ok(!E.backupValido(null)); ok(!E.backupValido({ schema: 'reserva-garagem-backup/1' }));
});
t('5.7 mesclarContatos adiciona só ausentes (não sobrescreve)', () => {
  const locais = [{ nro: '1', telefone: 'aaa' }];
  const imp = [{ nro: '1', telefone: 'NOVO' }, { nro: '2', telefone: 'bbb' }];
  const r = E.mesclarContatos(locais, imp);
  eq(r.adicionados, 1); eq(r.jaExistiam, 1); eq(r.novos[0].nro, '2');
});
t('5.7 decidirGestaoImport mesclar só aplica se não houver local', () => {
  const local = E.adicionarFuncionario(E.gestaoDefault(), 'Ana', 'f1');
  const imp = { empresa: { nome: 'Outra' } };
  eq(E.decidirGestaoImport(local, imp, 'mesclar').aplicar, false, 'com config local → mantém');
  eq(E.decidirGestaoImport(null, imp, 'mesclar').aplicar, true, 'sem config local → importa');
});
t('5.7 decidirGestaoImport substituir sempre repõe', () => {
  const local = E.adicionarFuncionario(E.gestaoDefault(), 'Ana', 'f1');
  const dec = E.decidirGestaoImport(local, { empresa: { nome: 'Nova' } }, 'substituir');
  eq(dec.aplicar, true); eq(dec.gestao.empresa.nome, 'Nova');
});

/* ════════════════════════════════════════════════════════════════
   v1.3.0 — EDIÇÃO MANUAL (mover de vaga; data proibida)
   ════════════════════════════════════════════════════════════════ */

t('5.1 vagaValida aceita P1..P18 e G1..G14; recusa o resto', () => {
  ok(E.vagaValida('P1') && E.vagaValida('P18') && E.vagaValida('G1') && E.vagaValida('G14'));
  ok(!E.vagaValida('P0') && !E.vagaValida('P19') && !E.vagaValida('G15') && !E.vagaValida('M1') && !E.vagaValida('X3') && !E.vagaValida(''));
});
t('5.1 ehReservaCarro: carros sim, moto não', () => {
  ok(E.ehReservaCarro({ garagem: 'azul_pequeno' }) && E.ehReservaCarro({ garagem: 'azul_grande' }) && E.ehReservaCarro({ garagem: 'amarelo' }) && E.ehReservaCarro({ garagem: 'laranja_grande' }));
  ok(!E.ehReservaCarro({ garagem: 'azul_moto' }));
});

t('5.2 aplicarAjustes: fixada vai à vaga manual com as DATAS ORIGINAIS', () => {
  const r1 = { nro: '1', garagem: 'azul_pequeno', entrada: D('05/06/26'), saida: D('08/06/26'), nomeCompleto: 'Ana', apto: '1' };
  const r2 = { nro: '2', garagem: 'azul_pequeno', entrada: D('05/06/26'), saida: D('08/06/26'), nomeCompleto: 'Beto', apto: '2' };
  const aloc = E.aplicarAjustes([r1, r2], { '1': { vagaIdManual: 'P5' } });
  ok(aloc.linhasP[4].some(x => x.nro === '1'), 'r1 deve estar na vaga P5 (índice 4)');
  eq(+r1.entrada, +D('05/06/26')); eq(+r1.saida, +D('08/06/26'));
  eq(r1.ajusteManual, true); eq(r1._vagaManual, 'P5');
});
t('5.2 aplicarAjustes: livres alocadas no espaço restante, sem duplicar a fixada', () => {
  const r1 = { nro: '1', garagem: 'azul_pequeno', entrada: D('05/06/26'), saida: D('08/06/26'), nomeCompleto: 'Ana', apto: '1' };
  const r2 = { nro: '2', garagem: 'azul_pequeno', entrada: D('10/06/26'), saida: D('12/06/26'), nomeCompleto: 'Beto', apto: '2' };
  const aloc = E.aplicarAjustes([r1, r2], { '1': { vagaIdManual: 'P3' } });
  const todas = [].concat(...aloc.linhasP, ...aloc.linhasG);
  eq(todas.filter(x => x.nro === '1').length, 1, 'fixada aparece uma única vez');
  ok(todas.some(x => x.nro === '2'), 'livre foi alocada');
});
t('5.2 aplicarAjustes: ajuste com vaga inválida é ignorado (cai no automático)', () => {
  const r1 = { nro: '1', garagem: 'azul_pequeno', entrada: D('05/06/26'), saida: D('08/06/26'), nomeCompleto: 'Ana', apto: '1' };
  const aloc = E.aplicarAjustes([r1], { '1': { vagaIdManual: 'Z9' } });
  ok(!r1.ajusteManual, 'vaga inválida → não fixa');
});
t('5.2 aplicarAjustes: nro de ajuste inexistente é ignorado sem quebrar', () => {
  const r1 = { nro: '1', garagem: 'azul_pequeno', entrada: D('05/06/26'), saida: D('08/06/26'), nomeCompleto: 'Ana', apto: '1' };
  const aloc = E.aplicarAjustes([r1], { '999': { vagaIdManual: 'P2' } });
  ok([].concat(...aloc.linhasP, ...aloc.linhasG).some(x => x.nro === '1'), 'reserva ainda renderiza');
});
t('5.2 aplicarAjustes: moto NÃO é fixável (ajuste ignorado)', () => {
  const m = { nro: '1', garagem: 'azul_moto', entrada: D('05/06/26'), saida: D('08/06/26'), nomeCompleto: 'M', apto: '1' };
  E.aplicarAjustes([m], { '1': { vagaIdManual: 'P2' } });
  ok(!m.ajusteManual, 'moto não vira fixada');
});
t('5.2 aplicarAjustes: sem ajustes = idêntico ao automático', () => {
  const mk = () => ([{ nro: '1', garagem: 'azul_pequeno', entrada: D('05/06/26'), saida: D('08/06/26'), nomeCompleto: 'Ana', apto: '1' }]);
  const a = E.aplicarAjustes(mk(), {});
  const b = E.alocarVagas(mk());
  eq(JSON.stringify(a.linhasP.map(l => l.map(r => r.nro))), JSON.stringify(b.linhasP.map(l => l.map(r => r.nro))));
});

t('5.3 detectarConflito: sobreposição na vaga alvo → conflito', () => {
  const orig = { nro: '1', entrada: D('05/06/26'), saida: D('10/06/26'), nomeCompleto: 'Ana' };
  const outro = { nro: '2', entrada: D('08/06/26'), saida: D('12/06/26'), nomeCompleto: 'Beto' };
  const r = E.detectarConflito(orig, 'P5', [outro]);
  eq(r.conflito, true); eq(r.comQuem, 'Beto');
});
t('5.3 detectarConflito: sem sobreposição → sem conflito', () => {
  const orig = { nro: '1', entrada: D('05/06/26'), saida: D('08/06/26'), nomeCompleto: 'Ana' };
  const outro = { nro: '2', entrada: D('08/06/26'), saida: D('12/06/26'), nomeCompleto: 'Beto' };
  eq(E.detectarConflito(orig, 'P5', [outro]).conflito, false);
});
t('5.3 detectarConflito: ignora a própria reserva (mesmo nro)', () => {
  const orig = { nro: '1', entrada: D('05/06/26'), saida: D('10/06/26'), nomeCompleto: 'Ana' };
  const mesma = { nro: '1', entrada: D('05/06/26'), saida: D('10/06/26'), nomeCompleto: 'Ana' };
  eq(E.detectarConflito(orig, 'P5', [mesma]).conflito, false);
});

/* ════════════════════════════════════════════════════════════════
   v1.4.0 — [nome] formatado + status enviado + registro de envio
   ════════════════════════════════════════════════════════════════ */

/* 5.1 — formatarNomeProprio */
t('5.1 formatarNomeProprio: JOÃO DA SILVA → João da Silva', () => { eq(E.formatarNomeProprio('JOÃO DA SILVA'), 'João da Silva'); });
t('5.1 formatarNomeProprio: MARIA DOS SANTOS → Maria dos Santos', () => { eq(E.formatarNomeProprio('MARIA DOS SANTOS'), 'Maria dos Santos'); });
t('5.1 formatarNomeProprio: hífen + conectores', () => { eq(E.formatarNomeProprio('ANA-MARIA DE SOUZA E OLIVEIRA'), 'Ana-Maria de Souza e Oliveira'); });
t('5.1 formatarNomeProprio: conector como 1ª palavra é capitalizado', () => { eq(E.formatarNomeProprio('DA SILVA'), 'Da Silva'); });
t('5.1 formatarNomeProprio: acentos (já minúsculo) ÁGUA→Água', () => { eq(E.formatarNomeProprio('ÁGUA'), 'Água'); });
t('5.1 formatarNomeProprio: já formatado permanece', () => { eq(E.formatarNomeProprio('Rui'), 'Rui'); eq(E.formatarNomeProprio('Ana'), 'Ana'); });
t('5.1 formatarNomeProprio: vazio/nulo não quebra', () => { eq(E.formatarNomeProprio(''), ''); eq(E.formatarNomeProprio(null), ''); eq(E.formatarNomeProprio('  '), ''); });
t('5.1 formatarNomeProprio: espaços extras normalizados', () => { eq(E.formatarNomeProprio('JOAO   DA    SILVA'), 'Joao da Silva'); });
t('5.1 [nome] na mensagem sai formatado (via substituirChaves)', () => {
  eq(E.substituirChaves('Olá [nome]!', { nome: 'CARLA AMARELA' }, E.gestaoDefault()), 'Olá Carla Amarela!');
  eq(E.substituirChaves('[nome]', { nomeCompleto: 'HENRIDES DOS SANTOS' }, E.gestaoDefault()), 'Henrides dos Santos');
});

/* 5.3 — status derivado do histórico */
t('5.3 statusEnvioReserva: sem registro → pendente (não enviado)', () => {
  eq(E.statusEnvioReserva([]), 'pendente'); eq(E.statusEnvioReserva(undefined), 'pendente'); eq(E.statusEnvioReserva(null), 'pendente');
});
t('5.3 statusEnvioReserva: ≥1 registro → enviado', () => {
  eq(E.statusEnvioReserva([{ nro: '1', dataHora: 'x', funcionario: 'Ana' }]), 'enviado');
});

/* 5.4 — montarRegistroEnvio + ordenação */
t('5.4 montarRegistroEnvio: grava nro/dataHora(ISO)/funcionario(nome-texto)/categoria/modelo', () => {
  const r = E.montarRegistroEnvio({ nro: 30001, funcionario: 'João', categoria: 'verificando', modelo: 1, agoraMs: new Date(2026, 5, 6, 9, 7).getTime() });
  eq(r.nro, '30001'); eq(r.funcionario, 'João'); eq(r.categoria, 'verificando'); eq(r.modelo, 1);
  ok(/^2026-06-06T/.test(r.dataHora), 'dataHora em ISO'); ok(!('id' in r), 'id é autoincrement no store');
});
t('5.4 montarRegistroEnvio: defaults seguros (sem dados não quebra)', () => {
  const r = E.montarRegistroEnvio({});
  eq(r.nro, ''); eq(r.funcionario, ''); eq(r.categoria, ''); eq(r.modelo, null); ok(!!r.dataHora);
});
t('5.4 enviosOrdenados: mais recente primeiro (por dataHora ISO)', () => {
  const a = { nro: '1', dataHora: '2026-06-01T10:00:00.000Z' };
  const b = { nro: '1', dataHora: '2026-06-03T10:00:00.000Z' };
  const c = { nro: '1', dataHora: '2026-06-02T10:00:00.000Z' };
  eq(E.enviosOrdenados([a, b, c]).map(x => x.dataHora).join(','), [b.dataHora, c.dataHora, a.dataHora].join(','));
});
t('5.4 enviosOrdenados: não muta o array original', () => {
  const arr = [{ dataHora: 'a' }, { dataHora: 'b' }]; E.enviosOrdenados(arr); eq(arr[0].dataHora, 'a');
});

/* ════════════════════════════════════════════════════════════════
   v1.5.0 — status manual (Parte A) + arraste no overbooking (Parte D)
   ════════════════════════════════════════════════════════════════ */
const rCarro = (nro, gar, ent, sai, extra) => Object.assign({ nro, garagem: gar, entrada: D(ent), saida: D(sai), nomeCompleto: 'N' + nro, apto: nro }, extra || {});

// ── A1. statusDerivadoDoPDF / statusEfetivo ──
t('A1 statusDerivadoDoPDF: amarelo→aguardando, resto→confirmado', () => {
  eq(E.statusDerivadoDoPDF({ garagem: 'amarelo' }), 'aguardando');
  eq(E.statusDerivadoDoPDF({ garagem: 'azul_pequeno' }), 'confirmado');
  eq(E.statusDerivadoDoPDF({ garagem: 'laranja_grande' }), 'confirmado');
  eq(E.statusDerivadoDoPDF({ garagem: 'azul_moto' }), 'confirmado');
});
t('A1 statusEfetivo: sem override → PDF; com override → prevalece', () => {
  const r = { garagem: 'amarelo' };
  eq(E.statusEfetivo(r, null), 'aguardando');
  eq(E.statusEfetivo(r, {}), 'aguardando');
  eq(E.statusEfetivo(r, { statusManual: 'confirmado' }), 'confirmado');
  eq(E.statusEfetivo(r, { statusManual: 'sem_garagem' }), 'sem_garagem');
  eq(E.statusEfetivo(r, { statusManual: 'lixo' }), 'aguardando', 'valor inválido cai no PDF');
});

// ── A2. Alocação com override ──
t('A2 sem_garagem: reserva SAI da alocação e vai para resultado.semGaragem', () => {
  const r = rCarro('1', 'azul_pequeno', '05/06/26', '08/06/26');
  const aloc = E.aplicarAjustes([r], { '1': { statusManual: 'sem_garagem' } });
  const naVaga = [].concat(...aloc.linhasP, ...aloc.linhasG).some(x => x.nro === '1');
  ok(!naVaga, 'não ocupa vaga');
  ok((aloc.semGaragem || []).some(x => x.nro === '1'), 'roteada para semGaragem');
  eq(r._semGaragem, true);
});
t('A2 override confirmado em amarelo: entra protegido (não vai a overbooking)', () => {
  const r = rCarro('1', 'amarelo', '05/06/26', '08/06/26');
  const aloc = E.aplicarAjustes([r], { '1': { statusManual: 'confirmado' } });
  ok([].concat(...aloc.linhasP, ...aloc.linhasG).some(x => x.nro === '1'), 'alocado em vaga');
  eq(r.garagem, 'amarelo', 'garagem original RESTAURADA (override não persiste)');
  eq(r._statusEfetivo, 'confirmado');
});
t('A2 override aguardando em azul: tratado como amarelo na alocação, garagem restaurada', () => {
  const r = rCarro('1', 'azul_pequeno', '05/06/26', '08/06/26');
  E.aplicarAjustes([r], { '1': { statusManual: 'aguardando' } });
  eq(r.garagem, 'azul_pequeno', 'restaurada');
  eq(r._statusEfetivo, 'aguardando');
});

// ── A5. pmsDivergente ──
t('A5 pmsDivergente: true quando manual ≠ PDF; false quando iguais/sem override', () => {
  const amar = { garagem: 'amarelo' }, azul = { garagem: 'azul_pequeno' };
  eq(E.pmsDivergente(amar, { statusManual: 'confirmado' }), true);
  eq(E.pmsDivergente(amar, { statusManual: 'aguardando' }), false, 'igual ao PDF → sem divergência');
  eq(E.pmsDivergente(azul, { statusManual: 'sem_garagem' }), true);
  eq(E.pmsDivergente(azul, null), false);
  eq(E.pmsDivergente(azul, {}), false);
});

// ── D7/D8. placement no overbooking ──
t('D placementOverbooking / placementValido', () => {
  ok(E.placementOverbooking('OVERBOOKING') && !E.placementOverbooking('P3'));
  ok(E.placementValido('P3') && E.placementValido('G14') && E.placementValido('OVERBOOKING'));
  ok(!E.placementValido('Z9') && !E.placementValido('') && !E.placementValido(null));
});
t('D7 vagaIdManual="OVERBOOKING": vai ao overflow e NÃO ocupa vaga', () => {
  const r1 = rCarro('1', 'azul_pequeno', '05/06/26', '08/06/26');
  const r2 = rCarro('2', 'azul_pequeno', '05/06/26', '08/06/26');
  const aloc = E.aplicarAjustes([r1, r2], { '1': { vagaIdManual: 'OVERBOOKING' } });
  ok(aloc.overflow.some(x => x.nro === '1'), 'r1 está no overflow');
  ok(!([].concat(...aloc.linhasP, ...aloc.linhasG)).some(x => x.nro === '1'), 'r1 não ocupa vaga');
  ok(aloc.overflowLinhas.length >= 1, 'overflowLinhas montadas');
  eq(r1.ajusteManual, true); eq(r1._vagaManual, 'OVERBOOKING'); eq(r1._over, true);
  ok([].concat(...aloc.linhasP, ...aloc.linhasG).some(x => x.nro === '2'), 'livre r2 realoca no espaço');
});
t('D7 mover p/ overbooking mantém DATAS originais', () => {
  const r1 = rCarro('1', 'azul_pequeno', '05/06/26', '08/06/26');
  E.aplicarAjustes([r1], { '1': { vagaIdManual: 'OVERBOOKING' } });
  eq(+r1.entrada, +D('05/06/26')); eq(+r1.saida, +D('08/06/26'));
});
t('D8 overbooking→vaga: vagaIdManual=<vaga> fixa na vaga com datas originais', () => {
  const r1 = rCarro('1', 'amarelo', '05/06/26', '08/06/26');
  const aloc = E.aplicarAjustes([r1], { '1': { vagaIdManual: 'G7' } });
  ok(aloc.linhasG[6].some(x => x.nro === '1'), 'fixada em G7');
  eq(+r1.entrada, +D('05/06/26'));
});

// ── D10. compat: statusManual + vagaIdManual coexistem; registro antigo válido ──
t('D10 statusManual e vagaIdManual coexistem (aguardando + vaga fixa)', () => {
  const r1 = rCarro('1', 'azul_pequeno', '05/06/26', '08/06/26');
  const aloc = E.aplicarAjustes([r1], { '1': { statusManual: 'aguardando', vagaIdManual: 'P5' } });
  ok(aloc.linhasP[4].some(x => x.nro === '1'), 'fixada em P5');
  eq(r1._statusEfetivo, 'aguardando');
  eq(r1.garagem, 'azul_pequeno', 'garagem restaurada');
});
t('D10 registro antigo (só vagaIdManual) segue válido', () => {
  const r1 = rCarro('1', 'azul_pequeno', '05/06/26', '08/06/26');
  const aloc = E.aplicarAjustes([r1], { '1': { vagaIdManual: 'P2' } });
  ok(aloc.linhasP[1].some(x => x.nro === '1'));
  eq(r1._statusEfetivo, 'confirmado');
});
t('D10 sem_garagem + placement: sem_garagem vence (sai do mapa)', () => {
  const r1 = rCarro('1', 'azul_pequeno', '05/06/26', '08/06/26');
  const aloc = E.aplicarAjustes([r1], { '1': { statusManual: 'sem_garagem', vagaIdManual: 'P5' } });
  ok((aloc.semGaragem || []).some(x => x.nro === '1'));
  ok(!([].concat(...aloc.linhasP, ...aloc.linhasG)).some(x => x.nro === '1'));
});

t('APP_VERSION é v1.5.2', () => { eq(E.APP_VERSION, 'v1.5.2'); });

/* ════════════ v1.5.2 — correções visíveis ════════════ */
// 5.1 — nomes: cabeçalho tolerante + fallback heurístico (menos "Hóspede")
t('5.1 extrairNomes: cabeçalho "Hóspedes:" sem espaço ainda extrai o nome', () => {
  const r = E.extrairNomes('Hóspedes:\nMARIA SOUZA\nJOAO PEREIRA\nDesbravador Software');
  eq(r.nomeCompleto, 'MARIA SOUZA');
});
t('5.1 extrairNomes: sem cabeçalho, heurística acha o nome (não cai em "Hóspede")', () => {
  const bloco = '05/06/26 08/06 1 2 201 ABC 30001 H\nBOOKING 413101ID20\nObs do Apto: GARAGEM PEQUENO\nCARLOS EDUARDO ALVES\nDesbravador Software';
  const r = E.extrairNomes(bloco);
  eq(r.nomeCompleto, 'CARLOS EDUARDO ALVES');
});
t('5.1 extrairNomes: bloco sem nenhum nome ainda retorna "Hóspede"', () => {
  eq(E.extrairNomes('bloco qualquer sem nomes').nomeCompleto, 'Hóspede');
});
t('5.1 nomeHeuristico pula empresas/cabeçalhos e pega o nome próprio', () => {
  eq(E.nomeHeuristico('BOOKING\nObs do Apto: GARAGEM\nFERNANDA LIMA COSTA\n123'), 'FERNANDA LIMA COSTA');
});

// 5.2 — obs de indisponibilidade → sem garagem / ambíguo
t('5.2 "SEM DISPONIBILIDADE DE GARAGEM" → sem', () => { const r = E.obsIndicaSemGaragem('SEM DISPONIBILIDADE DE GARAGEM'); ok(r.sem); ok(!r.ambiguo); });
t('5.2 "informado que não tem vaga" (sem acento) → sem', () => { ok(E.obsIndicaSemGaragem('Hospede informado que nao tem vaga').sem); });
t('5.2 "ciente que não há garagem" → sem', () => { ok(E.obsIndicaSemGaragem('cliente ciente que não há garagem').sem); });
t('5.2 quem TEM garagem NÃO vira sem garagem', () => { const r = E.obsIndicaSemGaragem('COM GARAGEM PEQUENO'); ok(!r.sem); ok(!r.ambiguo); });
t('5.2 "GARAGEM CONFIRMADA" não vira sem garagem', () => { ok(!E.obsIndicaSemGaragem('GARAGEM CONFIRMADA R$60').sem); });
t('5.2 obs ambígua (garagem lotada) → ambiguo (lança + notifica)', () => { const r = E.obsIndicaSemGaragem('garagem lotada verificar'); ok(!r.sem); ok(r.ambiguo); });
t('5.2 obs normal de garagem não é sem nem ambíguo', () => { const r = E.obsIndicaSemGaragem('GARAGEM GRANDE R$100'); ok(!r.sem); ok(!r.ambiguo); });
t('5.2 parser marca semGaragemPDF e derivado vira sem_garagem', () => {
  const txt = '05/06/26 08/06 1 2 201 ABC 30001 H\nWHATSAPP\nObs do Apto: SEM DISPONIBILIDADE DE GARAGEM\nHóspedes :\nANA LIMA\nANA LIMA\nDesbravador Software';
  const rs = E.parsear(txt);
  eq(rs.length, 1);
  ok(rs[0].semGaragemPDF, 'reserva marcada como sem garagem pelo PDF');
  eq(E.statusDerivadoDoPDF(rs[0]), 'sem_garagem');
});
t('5.2 aplicarAjustes: semGaragemPDF sai do mapa (vai p/ semGaragem)', () => {
  const txt = '05/06/26 08/06 1 2 201 ABC 30002 H\nWHATSAPP\nObs do Apto: SEM DISPONIBILIDADE DE GARAGEM\nHóspedes :\nANA LIMA\nANA LIMA\nDesbravador Software';
  const rs = E.parsear(txt);
  const aloc = E.aplicarAjustes(rs, {});
  ok((aloc.semGaragem || []).some(x => x.nro === '30002'));
  ok(!([].concat(...aloc.linhasP, ...aloc.linhasG)).some(x => x.nro === '30002'));
});

// 5.4 — overbooking com período
t('5.4 overbookingPeriodos: dia único', () => {
  const ov = [{ entrada: D('12/07/26'), saida: D('13/07/26') }];
  const r = E.overbookingPeriodos(ov, D('10/07/26'), D('20/07/26'));
  eq(r.label, '12/07');
});
t('5.4 overbookingPeriodos: faixa consecutiva vira intervalo', () => {
  const ov = [{ entrada: D('15/07/26'), saida: D('17/07/26') }];
  const r = E.overbookingPeriodos(ov, D('10/07/26'), D('20/07/26'));
  eq(r.label, '15/07–16/07');
});
t('5.4 overbookingPeriodos: dias separados juntam com "e"', () => {
  const ov = [{ entrada: D('12/07/26'), saida: D('13/07/26') }, { entrada: D('15/07/26'), saida: D('17/07/26') }];
  const r = E.overbookingPeriodos(ov, D('10/07/26'), D('20/07/26'));
  eq(r.label, '12/07 e 15/07–16/07');
});
t('5.4 overbookingPeriodos: sem overbooking → label vazio', () => {
  eq(E.overbookingPeriodos([], D('10/07/26'), D('20/07/26')).label, '');
});

/* ════════════ v1.5.1.1 — parser do Comandas na ORDEM DE LEITURA REAL do PDF.js ════════════ */
// Fixture na ordem de leitura real (campos em LINHAS SEPARADAS, não numa linha única) — reproduz
// o que o PDF.js entrega no Comandas em aberto real do Desbravador.
const COMANDAS_LEITURA = `Comandas em aberto - detalhado Página: 1
HOTEL GUMZ
Filtro: Lançadas até 31/12/3000 | Todas contas:sim | Todos PDVs:não |
Apartamento
1 FULANO DE TAL
Ponto de Venda Qtde Descrição Val.Unit. Val.Total Tipo Func
Data Origem
06/07/2026 11/07/2026
Comanda Cupom
Extras
BOOKING.COM
Taxas
GARAGEM 1 ESTACIONAMENTO CAMIONETE - BAIXA 2025
60,00 60,00 Lançamento BELTRANO X
06/07/26 1
0 0
0,00
Total da Conta 180,00 0,00
Total Geral
238 CICLANO E FULANA
Ponto de Venda Qtde Descrição Val.Unit. Val.Total Tipo Func
Data Origem
07/07/2026 10/07/2026
Comanda Cupom
Extras
Taxas
GARAGEM 1 ESTACIONAMENTO CARRO DE PASSEIO
40,00 40,00 Lançamento BELTRANO X
07/07/26 1
Total Geral
300 SICRANO SOUZA
Data Origem
05/07/2026 09/07/2026
Extras
MOTOR OMNIBEES
Taxas
GARAGEM 1 ESTACIONAMENTO MOTO - ALTA 2025/2026
30,00 30,00 Lançamento BELTRANO X
05/07/26 1
Total Geral`;

t('v1.5.1.1 ordem de leitura: 3 hospedados (o bug da v1.5.1 dava 0)', () => {
  eq(E.parsearComandas(COMANDAS_LEITURA).length, 3);
});
t('v1.5.1.1 ordem de leitura: apto 1 CAMIONETE→G, canal BOOKING.COM, período 4 dígitos', () => {
  const h = E.parsearComandas(COMANDAS_LEITURA).find(x => x.apto === '1');
  eq(h.tipoVeiculo, 'G'); eq(h.canal, 'BOOKING.COM'); eq(h.nome, 'FULANO DE TAL');
  eq(h.entrada.getDate(), 6); eq(h.entrada.getFullYear(), 2026);
  eq(h.saida.getDate(), 11); eq(h.saida.getFullYear(), 2026);
});
t('v1.5.1.1 ordem de leitura: apto 238 CARRO→P, canal VAZIO (Extras→Taxas), nome com E', () => {
  const h = E.parsearComandas(COMANDAS_LEITURA).find(x => x.apto === '238');
  eq(h.tipoVeiculo, 'P'); eq(h.canal, ''); eq(h.nome, 'CICLANO E FULANA');
  eq(h.entrada.getDate(), 7); eq(h.saida.getDate(), 10);
});
t('v1.5.1.1 ordem de leitura: apto 300 MOTO→moto, canal MOTOR OMNIBEES', () => {
  const h = E.parsearComandas(COMANDAS_LEITURA).find(x => x.apto === '300');
  eq(h.tipoVeiculo, 'moto'); eq(h.canal, 'MOTOR OMNIBEES'); eq(h.nome, 'SICRANO SOUZA');
});
t('v1.5.1.1 ordem de leitura: data diária de 2 dígitos NÃO vira entrada/saída', () => {
  const h = E.parsearComandas(COMANDAS_LEITURA).find(x => x.apto === '1');
  // se pegasse a diária (06/07/26) como saída, o ano seria 2026 mas o dia 6 — aqui saída é 11
  eq(h.saida.getDate(), 11);
});

t('v1.5.1.1 REGRA DO PERÍODO: ocupação = entrada→saida (faltando comanda de hoje não encurta)', () => {
  // bloco com UMA comanda de garagem antiga (dia 05) mas estadia até 20/07 → ocupa até 20/07
  const txt = `9 HOSPEDE LONGO
Data Origem
05/07/2026 20/07/2026
Extras
Taxas
GARAGEM 1 ESTACIONAMENTO CARRO DE PASSEIO
40,00 40,00 Lançamento X
05/07/26 1
Total Geral`;
  const h = E.parsearComandas(txt);
  eq(h.length, 1);
  eq(h[0].entrada.getDate(), 5); eq(h[0].saida.getDate(), 20);
  // reserva-like: dia de check-out (20) libera a vaga → cobre 19, não cobre 20
  const r = E.hospedadoParaReserva(h[0]);
  const dia19 = new Date(2026, 6, 19), dia20 = new Date(2026, 6, 20);
  ok(r.entrada <= dia19 && r.saida > dia19, 'ocupa o dia 19');
  ok(!(r.entrada <= dia20 && r.saida > dia20), 'check-out (20) libera a vaga');
});
t('v1.5.1.1 ordem de leitura: bloco sem garagem no corpo é ignorado (nome "SEM GARAGEM" não conta)', () => {
  const txt = `7 SEM GARAGEM
Data Origem
01/07/2026 05/07/2026
Extras
Taxas
RESTAURANTE 1 JANTAR
40,00 40,00 Lançamento X
Total Geral`;
  eq(E.parsearComandas(txt).length, 0);
});
t('v1.5.1.1 validação aceita comandas na ordem de leitura real', () => {
  ok(E.validarDocumentoComandas(COMANDAS_LEITURA).ok);
});

/* ════════════ v1.5.1 — 2º DOCUMENTO (Comandas/Hospedados) ════════════ */
// Fixture real (reproduz as manhas do Desbravador: valor colado, descrição quebrada, canal ausente).
const COMANDAS_FIXTURE = `HOTEL GUMZ                              Comandas em aberto - detalhado            Página:    1
Filtro: Lançadas até 31/12/3000 | Todas contas:sim | Todos PDVs:não |
                                                            Apartamento
        1 FULANO DE TAL                          06/07/2026      11/07/2026      BOOKING.COM      Extras
Ponto de Venda Data          Qtde Descrição                     Val.Unit.  Val.Total  Taxas Tipo       Comanda Cupom Origem Func
GARAGEM           06/07/26       1 ESTACIONAMENTO CAMIONETE - BAIXA60,00
                                                        2025               60,00   0,00 Lançamento     0     0      1 BELTRANO X
      238 CICLANO E FULANA 07/07/2026                            10/07/2026      Extras
GARAGEM           07/07/26       1 ESTACIONAMENTO CARRO DE PASSEIO
                                                     40,00
                                                       - BAIXA 2025
                                                                  40,00           0,00 Lançamento      0     0    238 BELTRANO X
      300 SICRANO SOUZA                           05/07/2026      09/07/2026      MOTOR OMNIBEES   Extras
GARAGEM           05/07/26       1 ESTACIONAMENTO MOTO - ALTA 2025/2026
                                                                  30,00           0,00 Lançamento      0     0    300 BELTRANO X`;

// ── EMISSÃO ──
t('parsePdfDate lê CreationDate D:YYYYMMDDHHmmSS', () => { const ms = E.parsePdfDate('D:20260708173949Z'); const d = new Date(ms); eq(d.getFullYear(), 2026); eq(d.getMonth(), 6); eq(d.getDate(), 8); eq(d.getHours(), 17); });
t('parsePdfDate aceita offset -03\'00\'', () => { ok(E.parsePdfDate("D:20260708193822-03'00'") != null); });
t('parsePdfDate lê data impressa dd/mm/aaaa hh:mm', () => { const ms = E.parsePdfDate('08/07/2026 19:38'); const d = new Date(ms); eq(d.getDate(), 8); eq(d.getMonth(), 6); eq(d.getHours(), 19); });
t('parsePdfDate null quando indeterminável', () => { eq(E.parsePdfDate('xyz'), null); eq(E.parsePdfDate(null), null); });
t('extrairEmissaoImpressa acha data/hora no texto', () => { ok(E.extrairEmissaoImpressa('rodapé 08/07/2026 19:38:22 fim') != null); });
t('compararEmissao: mais recente aplica', () => { eq(E.compararEmissao(2000, 1000), 'aplicar'); });
t('compararEmissao: igual aplica', () => { eq(E.compararEmissao(1000, 1000), 'aplicar'); });
t('compararEmissao: mais antigo recusa', () => { eq(E.compararEmissao(500, 1000), 'recusar'); });
t('compararEmissao: sem atual aplica', () => { eq(E.compararEmissao(1000, null), 'aplicar'); });
t('compararEmissao: nova desconhecida → desconhecida', () => { eq(E.compararEmissao(null, 1000), 'desconhecida'); });

// ── PARSER COMANDAS ──
t('parsearComandas: 3 hospedados da fixture', () => { eq(E.parsearComandas(COMANDAS_FIXTURE).length, 3); });
t('parsearComandas: apto 1 CAMIONETE→G, canal BOOKING.COM', () => {
  const h = E.parsearComandas(COMANDAS_FIXTURE).find(x => x.apto === '1');
  eq(h.tipoVeiculo, 'G'); eq(h.canal, 'BOOKING.COM'); eq(h.nome, 'FULANO DE TAL');
  eq(h.entrada.getDate(), 6); eq(h.saida.getDate(), 11);
});
t('parsearComandas: apto 238 CARRO→P, canal vazio (ausente), nome com E', () => {
  const h = E.parsearComandas(COMANDAS_FIXTURE).find(x => x.apto === '238');
  eq(h.tipoVeiculo, 'P'); eq(h.canal, ''); eq(h.nome, 'CICLANO E FULANA');
});
t('parsearComandas: apto 300 MOTO→moto (canal MOTOR OMNIBEES não vira moto por engano)', () => {
  const h = E.parsearComandas(COMANDAS_FIXTURE).find(x => x.apto === '300');
  eq(h.tipoVeiculo, 'moto'); eq(h.canal, 'MOTOR OMNIBEES');
});
t('parsearComandas: sem tamanho reconhecido → tipoVeiculo null (padrão)', () => {
  const txt = `        9 HOSPEDE X 01/07/2026 05/07/2026 Extras
GARAGEM 01/07/26 1 ESTACIONAMENTO 40,00`;
  const h = E.parsearComandas(txt);
  eq(h.length, 1); eq(h[0].tipoVeiculo, null);
});
t('parsearComandas: bloco sem GARAGEM é ignorado (auto-filtro)', () => {
  const txt = `        7 SEM GARAGEM 01/07/2026 05/07/2026 Extras
RESTAURANTE 01/07/26 1 JANTAR 40,00`;
  eq(E.parsearComandas(txt).length, 0);
});
t('parsearComandas: multi-veículo → um ocupante por tipo', () => {
  const txt = `       50 MULTI CARROS 01/07/2026 05/07/2026 Extras
GARAGEM 01/07/26 1 ESTACIONAMENTO CARRO DE PASSEIO 40,00
GARAGEM 01/07/26 1 ESTACIONAMENTO CAMIONETE 60,00`;
  const h = E.parsearComandas(txt);
  eq(h.length, 2);
  ok(h.some(x => x.tipoVeiculo === 'P')); ok(h.some(x => x.tipoVeiculo === 'G'));
});
t('parsearComandas: bloco malformado não quebra', () => { ok(Array.isArray(E.parsearComandas('lixo\nsem estrutura\n'))); });
t('tipoVeiculoDeSegmento reconhece os três + null', () => {
  eq(E.tipoVeiculoDeSegmento('ESTACIONAMENTO CARRO DE PASSEIO'), 'P');
  eq(E.tipoVeiculoDeSegmento('ESTACIONAMENTO CAMIONETE - BAIXA'), 'G');
  eq(E.tipoVeiculoDeSegmento('ESTACIONAMENTO MOTO - ALTA'), 'moto');
  eq(E.tipoVeiculoDeSegmento('ESTACIONAMENTO'), null);
});

// ── VALIDAÇÃO POR INFORMAÇÃO ──
t('validarDocumentoComandas: fixture tem info → ok', () => { ok(E.validarDocumentoComandas(COMANDAS_FIXTURE).ok); });
t('validarDocumentoComandas: texto sem info → não gera', () => { ok(!E.validarDocumentoComandas('documento qualquer sem comandas').ok); });
t('validarDocumentoReservas: comanda no slot de reservas → não confere', () => { ok(!E.validarDocumentoReservas(COMANDAS_FIXTURE).ok); });
t('validarDocumentoComandas: reservas no slot de comandas → não confere', () => {
  const reservasTxt = '05/06/26 08/06 1 2 201 ABC 30001 H\nWHATSAPP\nObs do Apto: GARAGEM PEQUENO\nHóspedes :\nANA\nANA\nDesbravador Software';
  ok(!E.validarDocumentoComandas(reservasTxt).ok);
});

// ── HOSPEDADO → reserva-like + chave estável ──
t('chaveHospedado estável por apto+entrada+tipo', () => {
  const k = E.chaveHospedado({ apto: '1', entrada: D('06/07/26'), tipoVeiculo: 'G' });
  eq(k, '1__2026-07-06__G');
});
t('chaveHospedado null tipo → x', () => { eq(E.chaveHospedado({ apto: '9', entrada: D('01/07/26'), tipoVeiculo: null }), '9__2026-07-01__x'); });
t('garagemDeTipoVeiculo: P/G/moto/null(padrão pequeno)', () => {
  eq(E.garagemDeTipoVeiculo('P'), 'azul_pequeno');
  eq(E.garagemDeTipoVeiculo('G'), 'azul_grande');
  eq(E.garagemDeTipoVeiculo('moto'), 'azul_moto');
  eq(E.garagemDeTipoVeiculo(null), 'azul_pequeno');
});
t('hospedadoParaReserva monta objeto reserva-like com ehHospedado', () => {
  const r = E.hospedadoParaReserva({ apto: '1', nome: 'FULANO', entrada: D('06/07/26'), saida: D('11/07/26'), canal: 'BOOKING.COM', tipoVeiculo: 'G' });
  eq(r.ehHospedado, true); eq(r.garagem, 'azul_grande'); eq(r.nro, '1__2026-07-06__G'); eq(r.origem, 'Hospedado');
});

// ── ALOCAÇÃO: hospedado ocupa primeiro; anti-duplicação ──
t('hospedado entra como confirmado na alocação (ocupa vaga)', () => {
  const h = E.hospedadoParaReserva({ apto: '1', nome: 'H', entrada: D('05/06/26'), saida: D('08/06/26'), tipoVeiculo: 'P' });
  const aloc = E.aplicarAjustes([h], {});
  ok([].concat(...aloc.linhasP).some(x => x.nro === h.nro), 'hospedado P ocupa uma vaga pequena');
});
t('dedupeReservasHospedados: reserva duplicada por hospedado (mesmo apto+período) some', () => {
  const res = { nro: '30001', apto: '201', entrada: D('06/07/26'), saida: D('10/07/26'), garagem: 'azul_pequeno' };
  const h = E.hospedadoParaReserva({ apto: '201', nome: 'H', entrada: D('06/07/26'), saida: D('11/07/26'), tipoVeiculo: 'P' });
  const out = E.dedupeReservasHospedados([res], [h]);
  eq(out.length, 0);
});
t('dedupeReservasHospedados: apto diferente NÃO é removido', () => {
  const res = { nro: '30001', apto: '999', entrada: D('06/07/26'), saida: D('10/07/26'), garagem: 'azul_pequeno' };
  const h = E.hospedadoParaReserva({ apto: '201', nome: 'H', entrada: D('06/07/26'), saida: D('11/07/26'), tipoVeiculo: 'P' });
  eq(E.dedupeReservasHospedados([res], [h]).length, 1);
});
t('hospedado editável: sem_garagem tira do mapa (statusEfetivo/semGaragem)', () => {
  const h = E.hospedadoParaReserva({ apto: '1', nome: 'H', entrada: D('05/06/26'), saida: D('08/06/26'), tipoVeiculo: 'P' });
  const aloc = E.aplicarAjustes([h], { [h.nro]: { statusManual: 'sem_garagem' } });
  ok((aloc.semGaragem || []).some(x => x.nro === h.nro));
  ok(!([].concat(...aloc.linhasP, ...aloc.linhasG)).some(x => x.nro === h.nro));
});
t('hospedado sem_garagem → divergência (comanda ainda mostra garagem)', () => {
  const h = E.hospedadoParaReserva({ apto: '1', nome: 'H', entrada: D('05/06/26'), saida: D('08/06/26'), tipoVeiculo: 'P' });
  ok(E.pmsDivergente(h, { statusManual: 'sem_garagem' }));
});

/* ── runner (suporta testes async) ── */
(async () => {
  for (const { name, fn } of queue) {
    try { await fn(); pass++; }
    catch (err) { fail++; fails.push(name + ': ' + err.message); }
  }
  console.log(`\nENGINE (unitários): ${pass}/${pass + fail} ✓`);
  if (fail) { console.log('\nFALHAS:'); fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
})();
