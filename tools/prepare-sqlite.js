'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const targetPlatform = process.argv[2] || process.platform;
const targetArch = process.argv[3] || process.arch;
const sqliteDir = path.dirname(require.resolve('sqlite3/package.json'));
const prebuildBin = require.resolve('prebuild-install/bin.js');
const binary = path.join(sqliteDir, 'build', 'Release', 'node_sqlite3.node');

console.log(
  `[prepare-sqlite] installing sqlite3 prebuild for ${targetPlatform}/${targetArch}...`
);

execFileSync(
  process.execPath,
  [
    prebuildBin,
    '-r',
    'napi',
    '--platform',
    targetPlatform,
    '--arch',
    targetArch,
    '--force'
  ],
  {
    cwd: sqliteDir,
    stdio: 'inherit'
  }
);

if (!fs.existsSync(binary)) {
  throw new Error('node_sqlite3.node was not found after the prebuild step.');
}

const header = fs.readFileSync(binary).subarray(0, 4);
const isWindows = header[0] === 0x4d && header[1] === 0x5a;
const isLinux =
  header[0] === 0x7f && header[1] === 0x45 && header[2] === 0x4c && header[3] === 0x46;
const isMachO = [
  0xfeedface,
  0xfeedfacf,
  0xcefaedfe,
  0xcffaedfe,
  0xcafebabe,
  0xbebafeca
].includes(header.readUInt32BE(0));

const valid =
  (targetPlatform === 'win32' && isWindows) ||
  (targetPlatform === 'linux' && isLinux) ||
  ((targetPlatform === 'darwin' || targetPlatform === 'mac') && isMachO);

if (!valid) {
  throw new Error(
    `The sqlite3 binary does not match the target ${targetPlatform}/${targetArch}.`
  );
}

console.log(`[prepare-sqlite] sqlite3 ready for ${targetPlatform}/${targetArch}`);
