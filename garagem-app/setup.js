/**
 * setup.js — baixa o PDF.js automaticamente do CDN e salva local
 * Rode uma vez: node setup.js
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const PDFJS_VERSION = '3.11.174';
const BASE_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;
const OUT_DIR = path.join(__dirname, 'pdfjs');

const FILES = [
  'pdf.min.js',
  'pdf.worker.min.js',
];

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

let done = 0;

FILES.forEach(file => {
  const url = `${BASE_URL}/${file}`;
  const dest = path.join(OUT_DIR, file);

  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
    console.log(`✓ ${file} já existe, pulando.`);
    done++;
    if (done === FILES.length) console.log('\n✅ Setup concluído! Agora rode: npm run build');
    return;
  }

  console.log(`⬇  Baixando ${file}...`);
  const out = fs.createWriteStream(dest);
  https.get(url, res => {
    res.pipe(out);
    out.on('finish', () => {
      out.close();
      const size = fs.statSync(dest).size;
      console.log(`✓ ${file} (${(size/1024).toFixed(0)} KB)`);
      done++;
      if (done === FILES.length) {
        console.log('\n✅ Setup concluído! Agora rode: npm run build');
      }
    });
  }).on('error', err => {
    fs.unlink(dest, () => {});
    console.error(`✗ Erro ao baixar ${file}:`, err.message);
  });
});
