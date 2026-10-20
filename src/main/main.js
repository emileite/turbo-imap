'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, Menu } = require('electron');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const { TurboDatabase } = require('./database');
const { Executor } = require('./executor');
const { getTool, getPublicTools, buildArgs, redactArgs } = require('../shared/tools');
const { normalizeLanguage, loadLocale, createI18n, translateDeep, format } = require('../shared/i18n');

const SPLASH_DURATION_MS = 4000;
const MAX_LOG_READ_BYTES = 1024 * 1024;
const PROJECT_REPO_URL = 'https://github.com/emileite/turbo-imap';

const isDev = !app.isPackaged;
const projectRoot = app.getAppPath();
const perlCommand = resolvePerlCommand();
const perlBinDir = path.isAbsolute(perlCommand) ? path.dirname(perlCommand) : null;
const dataRoot = isDev ? projectRoot : app.getPath('userData');
const logsDir = path.join(dataRoot, 'logs');
const progressDir = path.join(dataRoot, 'progress');
const scriptsDir = isDev
  ? path.join(projectRoot, 'scripts')
  : path.join(process.resourcesPath, 'scripts');
const dbPath = path.join(dataRoot, 'turbo-imap.db');

let mainWindow = null;
let splashWindow = null;
let db = null;
let executor = null;
let activeRun = null;
let perlInfoPromise = null;
let detectedLocale = 'en';
let activeLanguage = 'en';
let i18n = null;

function resolvePerlCommand() {
  if (process.env.TURBO_IMAP_PERL) return process.env.TURBO_IMAP_PERL;

  if (process.platform === 'win32') {
    const bundled = app.isPackaged
      ? path.join(process.resourcesPath, 'strawberry', 'perl', 'bin', 'perl.exe')
      : path.join(projectRoot, 'vendor', 'strawberry', 'perl', 'bin', 'perl.exe');

    if (fs.existsSync(bundled)) return bundled;
  }

  return 'perl';
}

function perlRuntimeEnv() {
  if (!perlBinDir) return {};
  const parts = [perlBinDir];
  if (process.env.PATH) parts.push(process.env.PATH);
  const env = { PATH: parts.join(path.delimiter) };
  if (process.platform === 'win32' && !process.env.OS) env.OS = 'Windows_NT';
  return env;
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function sendToRenderer(event) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.webContents.isDestroyed()) return;
  mainWindow.webContents.send('run:event', event);
}

function probePerl() {
  if (!perlInfoPromise) {
    perlInfoPromise = new Promise((resolve) => {
      execFile(
        perlCommand,
        ['-e', 'print $^V'],
        {
          timeout: 5000,
          windowsHide: true,
          env: { ...process.env, ...perlRuntimeEnv() }
        },
        (error, stdout, stderr) => {
          if (error) {
            resolve({
              found: false,
              command: perlCommand,
              version: '',
              error:
                error.code === 'ENOENT'
                  ? (i18n ? i18n.t('main.perlNotFound') : 'Perl not found in PATH.')
                  : error.message
            });
            return;
          }
          resolve({
            found: true,
            command: perlCommand,
            version: (stdout || stderr || '').trim(),
            error: ''
          });
        }
      );
    });
  }
  return perlInfoPromise;
}

function resolveWithin(baseDir, requestedPath) {
  if (!requestedPath) return null;
  const resolved = path.resolve(baseDir, path.basename(String(requestedPath)));
  const base = path.resolve(baseDir) + path.sep;
  return resolved.startsWith(base) ? resolved : null;
}

function readLogTail(logFile) {
  const resolved = resolveWithin(logsDir, logFile);
  if (!resolved || !fs.existsSync(resolved)) return null;

  const stat = fs.statSync(resolved);
  if (stat.size <= MAX_LOG_READ_BYTES) {
    return fs.readFileSync(resolved, 'utf8');
  }

  const start = stat.size - MAX_LOG_READ_BYTES;
  const buffer = Buffer.alloc(MAX_LOG_READ_BYTES);
  const fd = fs.openSync(resolved, 'r');
  try {
    fs.readSync(fd, buffer, 0, MAX_LOG_READ_BYTES, start);
  } finally {
    fs.closeSync(fd);
  }
  return '[... trecho final do log ...]\n' + buffer.toString('utf8');
}

function sanitizeOptions(tool, options, resume) {
  const source = options && typeof options === 'object' ? options : {};
  const sanitized = {};

  for (const field of tool.fields) {
    const raw = source[field.key];
    if (field.type === 'checkbox') {
      sanitized[field.key] = raw === true;
    } else if (raw !== undefined && raw !== null) {
      sanitized[field.key] = String(raw);
    } else {
      sanitized[field.key] = '';
    }
  }

  sanitized.__resume = Boolean(resume);
  return sanitized;
}

function normalizeAccount(account) {
  return {
    host: String((account && account.host) || '').trim(),
    user: String((account && account.user) || '').trim(),
    pass: account && typeof account.pass === 'string' ? account.pass : ''
  };
}

function createUsersFile(scriptName, content) {
  ensureDirectory(progressDir);
  const token = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const file = path.join(progressDir, `.users_${scriptName}_${token}.txt`);
  fs.writeFileSync(file, content, { encoding: 'utf8', mode: 0o600 });
  return file;
}

function writeThunderbirdGuide(options) {
  const outputDir = String((options && options.outputDir) || '').trim();
  if (!outputDir) return;

  const targetDir = path.isAbsolute(outputDir) ? outputDir : path.resolve(dataRoot, outputDir);
  fs.mkdirSync(targetDir, { recursive: true });

  const prefix = String((options && options.filePrefix) || 'TurboIMAP-');
  const from = String((options && options.dateFrom) || '').trim();
  const to = String((options && options.dateTo) || '').trim();
  const noLimit = i18n ? i18n.t('guide.noLimit') : 'no limit';
  const range =
    from || to
      ? `${from || noLimit} - ${to || noLimit}`
      : (i18n ? i18n.t('guide.allMessages') : 'all messages');

  const template =
    i18n && i18n.thunderbirdGuide
      ? i18n.thunderbirdGuide
      : 'Turbo IMAP - Thunderbird backup\n\nPrefix: {prefix}\nDate range: {range}\n';
  const guide = format(template, { prefix, range });
  const guideFile = path.join(targetDir, i18n ? i18n.guideFile : 'LEIA-ME-THUNDERBIRD.txt');
  fs.writeFileSync(guideFile, '\uFEFF' + guide, 'utf8');
}

function cleanupFiles(files) {
  for (const file of files || []) {
    try {
      fs.unlinkSync(file);
    } catch {
      // The file may already have been removed.
    }
  }
}

async function startRun(scriptName, values) {
  if (!executor) throw new Error(i18n ? i18n.t('main.executorNotReady') : 'Executor not initialized yet.');
  if (executor.isRunning) {
    throw new Error(i18n ? i18n.t('main.alreadyRunning') : 'An execution is already running.');
  }

  const tool = getTool(scriptName);
  if (!tool) throw new Error(i18n ? i18n.t('main.unknownTool') : 'Unknown tool.');

  const source = normalizeAccount(values && values.source);
  const destination = normalizeAccount(values && values.destination);
  const resume = Boolean(values && values.resume);
  const options = sanitizeOptions(tool, values && values.options, resume);
  const scriptPath = path.join(scriptsDir, tool.script);
  const runOptions = { ...options };
  const tempFiles = [];

  if (!fs.existsSync(scriptPath)) {
    throw new Error(
      i18n ? i18n.t('main.scriptNotFound', { name: tool.script }) : `Script not found: ${tool.script}`
    );
  }

  try {
    if (tool.guide === 'thunderbird') {
      try {
        writeThunderbirdGuide(options);
      } catch (error) {
        console.error('Falha ao gravar o guia do Thunderbird:', error);
      }
    }

    if (tool.special === 'migrateIMAP') {
      const tempFile = createUsersFile(
        scriptName,
        `${source.user}:${source.pass}:${destination.user}:${destination.pass}\n`
      );
      tempFiles.push(tempFile);
      runOptions.__usersFile = tempFile;
    } else if (tool.special === 'maildirToIMAP') {
      const maildir = String(options.maildir || '').trim();
      if (!maildir) {
        throw new Error(i18n ? i18n.t('main.maildir') : 'Fill in the local Maildir directory.');
      }
      const tempFile = createUsersFile(
        scriptName,
        `${maildir},${destination.user},${destination.pass}\n`
      );
      tempFiles.push(tempFile);
      runOptions.__usersFile = tempFile;
    }

    const args = [
      scriptPath,
      ...buildArgs(scriptName, {
        source,
        destination,
        options: runOptions,
        resume
      }, i18n)
    ];
    const displayArgs = [scriptPath, ...redactArgs(args.slice(1), { source, destination })];

    await db.saveConfiguration(scriptName, {
      source,
      destination,
      options
    });

    const startedAt = new Date().toISOString();
    const logFile = executor.buildLogFile(scriptName);
    const runId = await db.createRun({
      scriptName,
      startedAt,
      options,
      logFile
    });

    await db.setStatus(scriptName, 'Em execução', startedAt);

    activeRun = {
      runId,
      scriptName,
      startedAt,
      logFile,
      tempFiles
    };

    const snapshot = await executor.start({
      scriptName,
      args,
      cwd: dataRoot,
      env: {
        TURBO_IMAP_DATA_DIR: dataRoot,
        ...perlRuntimeEnv()
      },
      secrets: [source.pass, destination.pass],
      displayArgs,
      logFile
    });

    return { runId, snapshot };
  } catch (error) {
    cleanupFiles(tempFiles);
    if (activeRun && activeRun.tempFiles === tempFiles) activeRun = null;
    throw error;
  }
}

async function handleDirectory() {
  ensureDirectory(logsDir);
  ensureDirectory(progressDir);

  for (const file of fs.readdirSync(progressDir)) {
    if (file.startsWith('.users_')) {
      try {
        fs.unlinkSync(path.join(progressDir, file));
      } catch {
        // Ignore stale temp files that cannot be removed.
      }
    }
  }
}

async function createWindows() {
  const splashPath = path.join(projectRoot, 'assets', 'splash.html');

  splashWindow = new BrowserWindow({
    width: 460,
    height: 380,
    frame: false,
    resizable: false,
    movable: true,
    show: false,
    alwaysOnTop: true,
    backgroundColor: '#0b1f33',
    icon: path.join(projectRoot, 'assets', 'logo.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  splashWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.show();
  });
  await splashWindow.loadFile(splashPath);

  if (i18n) {
    const splashText = {
      lang: activeLanguage,
      subtitle: i18n.t('splash.subtitle'),
      message: i18n.t('splash.message'),
      footer: i18n.t('splash.footer')
    };
    try {
      await splashWindow.webContents.executeJavaScript(`
        document.documentElement.lang = ${JSON.stringify(activeLanguage)};
        document.querySelector('.subtitle').textContent = ${JSON.stringify(splashText.subtitle)};
        document.querySelector('.message').textContent = ${JSON.stringify(splashText.message)};
        document.querySelector('.footer').textContent = ${JSON.stringify(splashText.footer)};
      `);
    } catch {
      // Splash text is cosmetic; continue if execution is blocked.
    }
  }

  const startupStarted = Date.now();

  db = new TurboDatabase();
  await db.init(dbPath, { safeStorage });
  await db.resetInterruptedConfigurations();

  executor = new Executor({ logsDir, progressDir, perlCommand, i18n });

  executor.on('event', (event) => {
    if (event.type !== 'done') {
      sendToRenderer(event);
      return;
    }

    const current = activeRun;
    activeRun = null;

    (async () => {
      if (current) {
        try {
          await db.finishRun({
            runId: current.runId,
            status: event.status,
            exitCode: event.exitCode,
            finishedAt: event.finishedAt
          });
          await db.setStatus(event.scriptName, event.status, event.finishedAt);
        } catch (error) {
          console.error('Falha ao registrar o fim da execução:', error);
        }
        cleanupFiles(current.tempFiles);
      }
      sendToRenderer(event);
    })();
  });

  const elapsed = Date.now() - startupStarted;
  const wait = Math.max(0, SPLASH_DURATION_MS - elapsed);

  setTimeout(() => {
    showMainWindow();
  }, wait);
}

function showMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#f4f7fb',
    autoHideMenuBar: true,
    title: 'Turbo IMAP',
    icon: path.join(projectRoot, 'assets', 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

function registerIpc() {
  ipcMain.handle('tools:list', () => {
    const tools = getPublicTools();
    return i18n ? translateDeep(tools, i18n.trText) : tools;
  });

  ipcMain.handle('i18n:get', () => {
    if (!i18n) {
      return {
        language: 'en',
        messages: { strings: {}, patterns: {}, aboutHtml: '', thunderbirdHtml: '' }
      };
    }
    return {
      language: i18n.language,
      messages: {
        strings: i18n.strings,
        patterns: i18n.patterns,
        aboutHtml: i18n.aboutHtml,
        thunderbirdHtml: i18n.thunderbirdHtml
      }
    };
  });

  ipcMain.handle('system:info', async () => {
    const perl = await probePerl();
    const availableScripts = fs.existsSync(scriptsDir)
      ? fs.readdirSync(scriptsDir).filter((file) => file.endsWith('.pl')).length
      : 0;
    return {
      appVersion: app.getVersion(),
      language: activeLanguage,
      locale: detectedLocale,
      versions: {
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node
      },
      platform: process.platform,
      isPackaged: app.isPackaged,
      dataRoot,
      logsDir,
      progressDir,
      scriptsDir,
      availableScripts,
      perl,
      safeStorageAvailable: safeStorage.isEncryptionAvailable()
    };
  });

  ipcMain.handle('config:get', async (event, scriptName) => {
    if (!getTool(scriptName)) throw new Error('Ferramenta desconhecida.');
    return db.getConfiguration(scriptName);
  });

  ipcMain.handle('config:save', async (event, scriptName, values) => {
    const tool = getTool(scriptName);
    if (!tool) throw new Error('Ferramenta desconhecida.');

    const source = normalizeAccount(values && values.source);
    const destination = normalizeAccount(values && values.destination);
    const options = sanitizeOptions(tool, values && values.options, values && values.resume);

    await db.saveConfiguration(scriptName, { source, destination, options });
    return { saved: true };
  });

  ipcMain.handle('run:start', async (event, payload) => {
    const scriptName = payload && payload.scriptName;
    return startRun(scriptName, payload && payload.values);
  });

  ipcMain.handle('run:stop', () => {
    if (!executor || !executor.isRunning) return { stopped: false };
    return { stopped: executor.stop() };
  });

  ipcMain.handle('run:active', () => (executor ? executor.getSnapshot() : null));

  ipcMain.handle('run:history', async (event, scriptName) => {
    if (!getTool(scriptName)) throw new Error('Ferramenta desconhecida.');
    return db.getHistory(scriptName, 8);
  });

  ipcMain.handle('progress:get', async (event, scriptName) => {
    if (!getTool(scriptName)) throw new Error('Ferramenta desconhecida.');
    const progressPath = path.join(progressDir, `${scriptName}.json`);
    if (!fs.existsSync(progressPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(progressPath, 'utf8'));
    } catch {
      return null;
    }
  });

  ipcMain.handle('log:read', (event, logFile) => {
    try {
      return { content: readLogTail(logFile) };
    } catch (error) {
      return { content: null, error: error.message };
    }
  });

  ipcMain.handle('log:open', async (event, logFile) => {
    const resolved = resolveWithin(logsDir, logFile);
    if (!resolved || !fs.existsSync(resolved)) {
      return { ok: false, error: i18n ? i18n.t('main.logNotFound') : 'Log file not found.' };
    }
    const error = await shell.openPath(resolved);
    return { ok: !error, error };
  });

  ipcMain.handle('logs:open-folder', async () => {
    const error = await shell.openPath(logsDir);
    return { ok: !error, error };
  });

  ipcMain.handle('external:open-repository', async () => {
    try {
      await shell.openExternal(PROJECT_REPO_URL);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    app.setAppUserModelId('com.turboimap.app');

    const systemLocale = typeof app.getSystemLocale === 'function' ? app.getSystemLocale() : app.getLocale();
    detectedLocale = process.env.TURBO_IMAP_LANG || systemLocale;
    activeLanguage = normalizeLanguage(detectedLocale);
    i18n = createI18n(activeLanguage, loadLocale(activeLanguage));

    try {
      await handleDirectory();
      await createWindows();
      registerIpc();
    } catch (error) {
      dialog.showErrorBox(
        'Turbo IMAP',
        i18n
          ? i18n.t('main.initError', { message: error.message })
          : `Could not initialize the application.\n\n${error.message}`
      );
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      showMainWindow();
    }
  });

  app.on('before-quit', () => {
    if (executor && executor.isRunning) executor.stop();
    if (activeRun) cleanupFiles(activeRun.tempFiles);
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('will-quit', () => {
    if (db) {
      db.close().catch(() => {});
      db = null;
    }
  });
}
