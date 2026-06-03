/**
 * build-standalone.js — gera o controle-garagem-standalone.html (abre direto no Chrome)
 * a partir do index.html, embutindo o PDF.js inline (sem precisar da pasta ./pdfjs).
 *
 * Pré-requisito: rode "node setup.js" antes (baixa pdfjs/pdf.min.js e pdf.worker.min.js).
 * Uso: node build-standalone.js
 *
 * Como funciona:
 *  - Substitui <script src="./pdfjs/pdf.min.js"></script> pela biblioteca inline.
 *  - Embute o worker como Blob base64 e define window.PDFJS_WORKER_SRC (o index.html já
 *    lê window.PDFJS_WORKER_SRC || './pdfjs/pdf.worker.min.js', então tudo funciona offline).
 */
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const indexHtml = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const libJs = fs.readFileSync(path.join(DIR, 'pdfjs', 'pdf.min.js'), 'utf8');
const workerJs = fs.readFileSync(path.join(DIR, 'pdfjs', 'pdf.worker.min.js'));

const TAG = '<script src="./pdfjs/pdf.min.js"></script>';
if (!indexHtml.includes(TAG)) {
  console.error('Tag do PDF.js não encontrada no index.html — abortando.');
  process.exit(1);
}

const workerB64 = workerJs.toString('base64');
const libBlock = '<script>' + libJs + '</script>';
const workerBlock =
  '<script>\n' +
  'const __workerBlob=new Blob([atob("' + workerB64 + '")],{type:"application/javascript"});' +
  'window.PDFJS_WORKER_SRC=URL.createObjectURL(__workerBlob);\n' +
  '</script>';

const out = indexHtml.replace(TAG, libBlock + '\n' + workerBlock);
fs.writeFileSync(path.join(DIR, 'controle-garagem-standalone.html'), out);
console.log('✅ controle-garagem-standalone.html gerado (' + (out.length / 1024 / 1024).toFixed(2) + ' MB)');
