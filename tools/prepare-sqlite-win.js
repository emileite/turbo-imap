'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const sqliteDir = path.dirname(require.resolve('sqlite3/package.json'));
const prebuildBin = require.resolve('prebuild-install/bin.js');
const binary = path.join(sqliteDir, 'build', 'Release', 'node_sqlite3.node');

console.log('[prepare-sqlite-win] baixando/instalando prebuild do sqlite3 para Windows x64...');

execFileSync(
  process.execPath,
  [prebuildBin, '-r', 'napi', '--platform', 'win32', '--arch', 'x64', '--force'],
  {
    cwd: sqliteDir,
    stdio: 'inherit'
  }
);

if (!fs.existsSync(binary)) {
  throw new Error('node_sqlite3.node nao foi encontrado apos o prebuild.');
}

const header = fs.readFileSync(binary).subarray(0, 2);
if (header[0] !== 0x4d || header[1] !== 0x5a) {
  throw new Error('O binario do sqlite3 nao parece ser um executavel Windows (assinatura MZ ausente).');
}

console.log('[prepare-sqlite-win] sqlite3 Windows x64 pronto');
