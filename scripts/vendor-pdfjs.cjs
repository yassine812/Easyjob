const fs = require('node:fs');
const path = require('node:path');
const sourceCandidates = [
  path.resolve(__dirname, '../node_modules/pdfjs-dist'),
  path.resolve(__dirname, '../web/node_modules/pdfjs-dist'),
];
const target = path.join(__dirname, '../public/pdfjs');
fs.mkdirSync(target, { recursive: true });
const sourceDir = sourceCandidates.find(candidate =>
  fs.existsSync(path.join(candidate, 'build/pdf.worker.min.mjs')) ||
  fs.existsSync(path.join(candidate, 'pdf.worker.min.mjs')),
);
if (!sourceDir) throw new Error('Missing pdfjs package assets');
const worker = [
  path.join(sourceDir, 'build/pdf.worker.min.mjs'),
  path.join(sourceDir, 'pdf.worker.min.mjs'),
].find(candidate => fs.existsSync(candidate));
if (!worker) throw new Error('Missing pdfjs worker asset');
fs.copyFileSync(worker, path.join(target, 'pdf.worker.min.mjs'));
for (const name of ['cmaps', 'standard_fonts', 'wasm']) {
  const sourcePath = path.join(sourceDir, name);
  if (fs.existsSync(sourcePath)) {
    fs.cpSync(sourcePath, path.join(target, name), { recursive: true });
  }
}
