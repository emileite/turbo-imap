'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const source = path.join(root, 'node_modules', 'bulma', 'css', 'bulma.min.css');
const targetDir = path.join(root, 'src', 'renderer', 'vendor');
const target = path.join(targetDir, 'bulma.min.css');

if (!fs.existsSync(source)) {
  console.warn('[turbo-imap] bulma.min.css nao encontrado. Execute npm install primeiro.');
  process.exit(0);
}

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(source, target);
console.log('[turbo-imap] Bulma copiado para src/renderer/vendor/bulma.min.css');
