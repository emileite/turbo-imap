'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { Readable } = require('node:stream');
const unzipper = require('unzipper');

const ROOT = path.join(__dirname, '..');
const VENDOR_DIR = path.join(ROOT, 'vendor');
const TARGET_DIR = path.join(VENDOR_DIR, 'strawberry');
const PERL_DIR = path.join(TARGET_DIR, 'perl');
const PERL_EXE = path.join(PERL_DIR, 'bin', 'perl.exe');
const MARKER = path.join(TARGET_DIR, '.perl-version');

const PERL_VERSION = '5.42.3.1';
const DOWNLOAD_URL =
  'https://github.com/StrawberryPerl/Perl-Dist-Strawberry/releases/download/SP_54231_64bit/strawberry-perl-5.42.3.1-64bit-portable.zip';
const EXPECTED_SHA256 =
  '6a081a811781c30aca51dbc036afd93092af91e3297901f02c17043795a10690';

const EXTRA_TOP_LEVEL = new Set([
  'README.txt',
  'DISTRIBUTIONS.txt',
  'portable.perl',
  'portableshell.bat'
]);

const EXTRA_DLLS = new Map([
  [
    'c/bin/libcrypto-3-x64__.dll',
    [
      'perl/bin/libcrypto-3-x64__.dll',
      'perl/vendor/lib/auto/Net/SSLeay/libcrypto-3-x64__.dll',
      'perl/vendor/lib/auto/Crypt/SSLeay/libcrypto-3-x64__.dll'
    ]
  ],
  [
    'c/bin/libssl-3-x64__.dll',
    [
      'perl/bin/libssl-3-x64__.dll',
      'perl/vendor/lib/auto/Net/SSLeay/libssl-3-x64__.dll',
      'perl/vendor/lib/auto/Crypt/SSLeay/libssl-3-x64__.dll'
    ]
  ],
  [
    'c/bin/zlib1__.dll',
    [
      'perl/bin/zlib1__.dll',
      'perl/vendor/lib/auto/Net/SSLeay/zlib1__.dll',
      'perl/vendor/lib/auto/Crypt/SSLeay/zlib1__.dll'
    ]
  ]
]);

function log(message) {
  console.log(`[prepare-perl] ${message}`);
}

function isPrepared() {
  if (!fs.existsSync(PERL_EXE) || !fs.existsSync(MARKER)) return false;
  try {
    return fs.readFileSync(MARKER, 'utf8').trim() === PERL_VERSION;
  } catch {
    return false;
  }
}

async function fileSha256(file) {
  const hash = crypto.createHash('sha256');
  await pipeline(fs.createReadStream(file), hash);
  return hash.digest('hex');
}

async function downloadZip(destination) {
  log(`baixando Strawberry Perl ${PERL_VERSION}...`);
  const response = await fetch(DOWNLOAD_URL, { redirect: 'follow' });
  if (!response.ok || !response.body) {
    throw new Error(`Download falhou: HTTP ${response.status}`);
  }

  const total = Number(response.headers.get('content-length')) || 0;
  let received = 0;
  let lastLogged = 0;
  const counter = new TransformStream({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (received - lastLogged >= 20 * 1024 * 1024) {
        lastLogged = received;
        const percent = total ? Math.round((received / total) * 100) : 0;
        log(`download ${percent}% (${(received / 1048576).toFixed(0)} MB)`);
      }
      controller.enqueue(chunk);
    }
  });

  await pipeline(
    Readable.fromWeb(response.body.pipeThrough(counter)),
    fs.createWriteStream(destination)
  );
  log('download concluido');
}

async function extractZip(zipFile) {
  log('extraindo apenas o runtime do Perl e os DLLs necessarios...');
  fs.rmSync(TARGET_DIR, { recursive: true, force: true });

  const directory = await unzipper.Open.file(zipFile);
  let extracted = 0;

  for (const entry of directory.files) {
    if (entry.type === 'Directory') continue;

    const entryPath = entry.path.replace(/\\/g, '/');
    let targets = [];

    if (entryPath.startsWith('perl/')) {
      targets = [entryPath];
    } else if (entryPath.startsWith('licenses/')) {
      targets = [entryPath];
    } else if (EXTRA_TOP_LEVEL.has(entryPath)) {
      targets = [entryPath];
    } else if (EXTRA_DLLS.has(entryPath)) {
      targets = EXTRA_DLLS.get(entryPath);
    }

    if (!targets.length) continue;

    for (const targetRelative of targets) {
      const target = path.join(TARGET_DIR, targetRelative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      await pipeline(entry.stream(), fs.createWriteStream(target));
      extracted += 1;
    }
  }

  fs.writeFileSync(MARKER, `${PERL_VERSION}\n`, 'utf8');
  log(`extraidos ${extracted} arquivos para ${path.relative(ROOT, TARGET_DIR)}`);
}

async function main() {
  if (isPrepared()) {
    log(`runtime ${PERL_VERSION} ja esta em vendor/strawberry`);
    return;
  }

  fs.mkdirSync(VENDOR_DIR, { recursive: true });

  const cachedZip = process.env.STRAWBERRY_ZIP
    ? path.resolve(process.env.STRAWBERRY_ZIP)
    : path.join(VENDOR_DIR, 'strawberry-perl.zip');

  if (!fs.existsSync(cachedZip)) {
    await downloadZip(cachedZip);
  } else {
    log(`usando zip em cache: ${cachedZip}`);
  }

  const digest = await fileSha256(cachedZip);
  if (digest !== EXPECTED_SHA256) {
    throw new Error(
      `SHA256 inesperado para ${cachedZip}.\nEsperado: ${EXPECTED_SHA256}\nObtido:   ${digest}`
    );
  }

  await extractZip(cachedZip);

  if (!fs.existsSync(PERL_EXE)) {
    throw new Error('perl.exe nao foi encontrado apos a extracao.');
  }

  if (!process.env.STRAWBERRY_ZIP) {
    fs.rmSync(cachedZip, { force: true });
  }

  log('runtime do Perl pronto para empacotamento');
}

main().catch((error) => {
  console.error(`[prepare-perl] ERRO: ${error.message}`);
  process.exit(1);
});
