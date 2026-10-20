'use strict';

const { spawn } = require('node:child_process');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const ANSI_PATTERN = /\u001b\[[0-9;]*[A-Za-z]/g;
const MAX_RECENT_LOGS = 2000;

const PROGRESS_RULES = [
  {
    pattern: /copied\s+(\d+)\s+of\s+(\d+)\s+(?:messages|msgs)/i,
    apply: (match, setProgress) => setProgress(Number(match[1]), Number(match[2]))
  },
  {
    pattern: /(\d+)\s+of\s+(\d+)\s+(?:messages|msgs)/i,
    apply: (match, setProgress) => setProgress(Number(match[1]), Number(match[2]))
  },
  {
    pattern: /source\s+.*?\s+has\s+(\d+)\s+messages/i,
    apply: (match, setProgress, setStage) => {
      setProgress(0, Number(match[1]));
      setStage('progress.analyzingFolder', { count: match[1] }, `Analisando pasta com ${match[1]} mensagens`);
    }
  },
  {
    pattern: /there are\s+(\d+)\s+messages\s+in/i,
    apply: (match, setProgress, setStage) => {
      setProgress(0, Number(match[1]));
      setStage('progress.folderMessages', { count: match[1] }, `Pasta com ${match[1]} mensagens`);
    }
  },
  {
    pattern: /added\s+(\d+)\s+msgs/i,
    apply: (match, setProgress) => setProgress(Number(match[1]), null)
  },
  {
    pattern: /inserting message/i,
    apply: (match, setProgress) => setProgress(null, null, 1)
  },
  {
    pattern: /number of mailboxes to process:\s*(\d+)/i,
    apply: (match, setProgress, setStage) =>
      setStage('progress.processingFolders', { count: match[1] }, `Processando ${match[1]} pasta(s)`)
  },
  {
    pattern: /there are\s+(\d+)\s+mailboxes\s+to\s+(?:sync|process)/i,
    apply: (match, setProgress, setStage) =>
      setStage('progress.syncingFolders', { count: match[1] }, `Sincronizando ${match[1]} pasta(s)`)
  },
  {
    pattern: /checking mailbox\s+(.+)/i,
    apply: (match, setProgress, setStage) =>
      setStage('progress.checkingFolder', { folder: match[1].trim() }, `Verificando pasta ${match[1].trim()}`)
  },
  {
    pattern: /purging mailbox\s+(.+)/i,
    apply: (match, setProgress, setStage) =>
      setStage('progress.purgingFolder', { folder: match[1].trim() }, `Limpando pasta ${match[1].trim()}`)
  },
  {
    pattern: /copying\s+(\d+)\s+messages\s+in\s+(.+)/i,
    apply: (match, setProgress, setStage) => {
      setProgress(0, Number(match[1]));
      setStage('progress.copyingMessages', { count: match[1], folder: match[2].trim() }, `Copiando ${match[1]} mensagens de ${match[2].trim()}`);
    }
  },
  {
    pattern: /connecting to\s+(.+)/i,
    apply: (match, setProgress, setStage) =>
      setStage('progress.connecting', { host: match[1].trim() }, `Conectando a ${match[1].trim()}`)
  },
  {
    pattern: /logged in as\s+(.+)/i,
    apply: (match, setProgress, setStage) =>
      setStage('progress.authenticated', { user: match[1].trim() }, `Autenticado como ${match[1].trim()}`)
  },
  {
    pattern: /total messages purged\s+(\d+)/i,
    apply: (match, setProgress, setStage) => {
      setProgress(Number(match[1]), Number(match[1]));
      setStage('progress.purged', { count: match[1] }, `${match[1]} mensagens purgadas`);
    }
  },
  {
    pattern: /^summary/i,
    apply: (match, setProgress, setStage) =>
      setStage('progress.summary', {}, 'Finalizando e gerando resumo')
  }
];

function timestampForFile(date = new Date()) {
  const pad = (value, size = 2) => String(value).padStart(size, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '_',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
    pad(date.getMilliseconds(), 3)
  ].join('');
}

class Executor extends EventEmitter {
  constructor({ logsDir, progressDir, perlCommand = 'perl', i18n = null }) {
    super();
    this.logsDir = logsDir;
    this.progressDir = progressDir;
    this.perlCommand = perlCommand;
    this.i18n = i18n;
    this.child = null;
    this.state = null;
    this.progressTimer = null;
    this.killTimer = null;
  }

  t(key, params, fallback) {
    return this.i18n ? this.i18n.t(key, params) : fallback;
  }

  statusLabel(status) {
    const keys = {
      'Sucesso': 'status.success',
      'Falha': 'status.failure',
      'Interrompido': 'status.interrupted',
      'Em execução': 'status.running'
    };
    const key = keys[status];
    return key && this.i18n ? this.i18n.t(key) : status;
  }

  get isRunning() {
    return Boolean(this.state && !this.state.finished);
  }

  getSnapshot() {
    if (!this.state) return null;
    return {
      running: !this.state.finished,
      scriptName: this.state.scriptName,
      startedAt: this.state.startedAt,
      logFile: this.state.logFile,
      stopping: this.state.stopping,
      progress: { ...this.state.progress },
      recentLogs: this.state.recentLogs.slice()
    };
  }

  buildLogFile(scriptName) {
    const safeName = scriptName.replace(/[^a-z0-9_-]/gi, '_');
    return path.join(this.logsDir, `${safeName}_${timestampForFile()}.log`);
  }

  async start({ scriptName, args, cwd, env, secrets = [], displayArgs = null, logFile }) {
    if (this.isRunning) {
      throw new Error(this.t('main.alreadyRunning', {}, 'Já existe uma execução em andamento.'));
    }

    fs.mkdirSync(this.logsDir, { recursive: true });
    fs.mkdirSync(this.progressDir, { recursive: true });

    const startedAt = new Date().toISOString();
    const resolvedLogFile = logFile || this.buildLogFile(scriptName);
    const logStream = fs.createWriteStream(resolvedLogFile, { flags: 'a' });

    this.state = {
      scriptName,
      startedAt,
      logFile: resolvedLogFile,
      logStream,
      stopping: false,
      finished: false,
      progress: {
        current: 0,
        total: 0,
        percent: null,
        message: this.t('progress.init', {}, 'Iniciando execução...')
      },
      recentLogs: [],
      secrets: secrets.filter((secret) => typeof secret === 'string' && secret.length > 0),
      exitCode: null
    };

    const commandLine = [this.perlCommand, ...(displayArgs || args)].join(' ');

    this.emit('event', {
      type: 'started',
      scriptName,
      startedAt,
      logFile: resolvedLogFile,
      progress: { ...this.state.progress }
    });
    this.writeProgressFile(true);

    this.logLine(this.t('executor.header', { script: scriptName }, `=== Turbo IMAP - ${scriptName} ===`));
    this.logLine(this.t('executor.start', { date: startedAt }, `Início: ${startedAt}`));
    this.logLine(this.t('executor.command', { command: commandLine }, `Comando: ${commandLine}`));
    this.logLine(this.t('executor.cwd', { cwd }, `Diretório de trabalho: ${cwd}`));
    this.logLine('');

    const childEnv = {
      ...process.env,
      ...env,
      NO_COLOR: '1',
      TERM: 'dumb',
      PERL_UNICODE: 'S'
    };

    let child;
    try {
      child = spawn(this.perlCommand, args, {
        cwd,
        env: childEnv,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
    } catch (error) {
      await this.finish({ error, code: null, signal: null });
      throw error;
    }

    this.child = child;

    child.once('error', (error) => {
      this.logLine(this.t('executor.spawnError', { message: error.message }, `Erro ao iniciar o processo: ${error.message}`));
      this.finish({ error, code: null, signal: null });
    });

    child.once('close', (code, signal) => {
      this.finish({ error: null, code, signal });
    });

    if (child.stdout) {
      const stdout = readline.createInterface({ input: child.stdout });
      stdout.on('line', (line) => this.handleLine(line, 'stdout'));
    }

    if (child.stderr) {
      const stderr = readline.createInterface({ input: child.stderr });
      stderr.on('line', (line) => this.handleLine(line, 'stderr'));
    }

    return this.getSnapshot();
  }

  redact(text) {
    if (!this.state) return text;
    let result = String(text);
    for (const secret of this.state.secrets) {
      result = result.split(secret).join('********');
    }
    return result;
  }

  logLine(line) {
    if (!this.state) return;
    const cleanLine = this.redact(String(line).replace(ANSI_PATTERN, '').replace(/\r$/, ''));
    this.state.logStream.write(cleanLine + '\n');
    this.state.recentLogs.push(cleanLine);
    if (this.state.recentLogs.length > MAX_RECENT_LOGS) {
      this.state.recentLogs.splice(0, this.state.recentLogs.length - MAX_RECENT_LOGS);
    }
    this.emit('event', { type: 'log', line: cleanLine });
  }

  handleLine(rawLine, stream) {
    if (!this.state) return;

    const line = this.redact(String(rawLine).replace(ANSI_PATTERN, '').replace(/\r$/, ''));
    if (stream === 'stderr' && line.trim() === '') return;

    this.logLine(line);

    if (stream !== 'stdout') return;

    const setProgress = (current, total, increment) => {
      const progress = this.state.progress;
      if (typeof current === 'number' && Number.isFinite(current)) {
        progress.current = Math.max(0, current);
      } else if (increment) {
        progress.current += increment;
      }
      if (typeof total === 'number' && Number.isFinite(total) && total > 0) {
        progress.total = total;
      }
      this.emitProgress();
    };

    const setStage = (key, params, fallback) => {
      const message = this.t(key, params, fallback);
      this.state.progress.message = message;
      this.emit('event', { type: 'status', message });
      this.emitProgress(false);
    };

    for (const rule of PROGRESS_RULES) {
      const match = line.match(rule.pattern);
      if (!match) continue;
      rule.apply(match, setProgress, setStage);
      break;
    }
  }

  emitProgress(writeFile = true) {
    if (!this.state) return;
    const progress = this.state.progress;
    progress.percent =
      progress.total > 0
        ? Math.min(100, Math.round((progress.current / progress.total) * 100))
        : null;
    progress.message =
      progress.total > 0
        ? this.t(
            'progress.count',
            {
              current: progress.current,
              total: progress.total,
              percent: progress.percent
            },
            `${progress.current} de ${progress.total} - ${progress.percent}%`
          )
        : progress.message;

    this.emit('event', {
      type: 'progress',
      progress: { ...progress }
    });

    if (writeFile) this.writeProgressFile(false);
  }

  writeProgressFile(force) {
    if (!this.state) return;

    if (!force && this.progressTimer) return;
    if (!force) {
      this.progressTimer = setTimeout(() => {
        this.progressTimer = null;
        this.writeProgressFile(true);
      }, 500);
      return;
    }

    const progressPath = path.join(this.progressDir, `${this.state.scriptName}.json`);
    const payload = {
      scriptName: this.state.scriptName,
      status: this.state.finished ? this.state.finalStatus : 'Em execução',
      startedAt: this.state.startedAt,
      updatedAt: new Date().toISOString(),
      current: this.state.progress.current,
      total: this.state.progress.total,
      percent: this.state.progress.percent,
      message: this.state.progress.message,
      logFile: this.state.logFile
    };

    try {
      fs.writeFileSync(progressPath, JSON.stringify(payload, null, 2), 'utf8');
    } catch {
      // Progress persistence is best effort; the UI still receives events.
    }
  }

  stop() {
    if (!this.isRunning || !this.child) return false;

    this.state.stopping = true;
    this.logLine('Solicitacao de interrupcao recebida. Encerrando processo...');
    this.state.progress.message = 'Interrompendo...';
    this.emit('event', { type: 'status', message: 'Interrompendo...' });
    this.writeProgressFile(true);

    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/pid', String(this.child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore'
      });
      killer.on('error', () => {
        if (this.child) this.child.kill();
      });
    } else {
      this.child.kill('SIGTERM');
      this.killTimer = setTimeout(() => {
        if (this.child && this.isRunning) this.child.kill('SIGKILL');
      }, 5000);
    }

    return true;
  }

  async finish({ error, code, signal }) {
    if (!this.state || this.state.finished) return;

    this.state.finished = true;
    this.state.exitCode = code;
    if (this.progressTimer) {
      clearTimeout(this.progressTimer);
      this.progressTimer = null;
    }
    if (this.killTimer) {
      clearTimeout(this.killTimer);
      this.killTimer = null;
    }

    const criticalOutput = this.state.recentLogs.some((line) => {
      return /Usage: perl \[switches\]|Login failed|Authentication failed|Error connecting to|\bFatal\b/i.test(
        line
      );
    });

    const status =
      this.state.stopping
        ? 'Interrompido'
        : error || (typeof code === 'number' && code !== 0) || criticalOutput
          ? 'Falha'
          : 'Sucesso';

    this.state.finalStatus = status;

    if (criticalOutput && !error && code === 0) {
      this.logLine(this.t('executor.critical', {}, 'Erro crítico detectado na saída do script.'));
    }

    if (error) {
      this.logLine(this.t('executor.spawnError', { message: error.message }, `Falha ao executar: ${error.message}`));
    } else if (signal) {
      this.logLine(this.t('executor.finishedSignal', { signal }, `Processo finalizado pelo sinal ${signal}.`));
    } else {
      this.logLine(this.t('executor.finishedCode', { code }, `Processo finalizado com código ${code}.`));
    }
    this.logLine(this.t('executor.end', { date: new Date().toISOString() }, `Fim: ${new Date().toISOString()}`));
    this.logLine(this.t('executor.status', { status: this.statusLabel(status) }, `Status: ${status}`));

    if (status === 'Sucesso') {
      this.state.progress.current = this.state.progress.total || this.state.progress.current;
      this.state.progress.percent = 100;
      this.state.progress.message = this.t('progress.done', {}, 'Concluído com sucesso');
    } else if (this.state.progress.message === this.t('progress.init', {}, 'Iniciando execução...')) {
      this.state.progress.message = this.t(
        status === 'Interrompido' ? 'progress.interrupted' : 'progress.failed',
        {},
        status
      );
    }

    this.writeProgressFile(true);

    const finishedAt = new Date().toISOString();
    const donePayload = {
      type: 'done',
      scriptName: this.state.scriptName,
      status,
      exitCode: typeof code === 'number' ? code : null,
      signal: signal || null,
      startedAt: this.state.startedAt,
      finishedAt,
      logFile: this.state.logFile,
      progress: { ...this.state.progress }
    };

    const stream = this.state.logStream;
    await new Promise((resolve) => {
      if (!stream) return resolve();
      stream.end(resolve);
    });

    this.emit('event', donePayload);
    this.child = null;
    this.state = null;
  }
}

module.exports = { Executor, timestampForFile };
