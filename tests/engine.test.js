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
  'copiarTextoCore','estadoTelefoneInicial','aplicarOrdemLinhas','montarUploadInfo','fmtDataHora','recorteEsquerdo'
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

t('APP_VERSION é v1.1.0', () => { eq(E.APP_VERSION, 'v1.1.0'); });

/* ── runner (suporta testes async) ── */
(async () => {
  for (const { name, fn } of queue) {
    try { await fn(); pass++; }
    catch (err) { fail++; fails.push(name + ': ' + err.message); }
  }
  console.log(`\nENGINE (unitários): ${pass}/${pass + fail} ✓`);
  if (fail) { console.log('\nFALHAS:'); fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
})();
