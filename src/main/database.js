'use strict';

const path = require('node:path');
const fs = require('node:fs');
const sqlite3 = require('sqlite3').verbose();

class TurboDatabase {
  constructor() {
    this.db = null;
    this.safeStorage = null;
  }

  async init(dbPath, options = {}) {
    this.safeStorage = options.safeStorage || null;
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    await new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    await this.exec('PRAGMA journal_mode = WAL;');
    await this.exec('PRAGMA foreign_keys = ON;');
    await this.exec(`
      CREATE TABLE IF NOT EXISTS configurations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        script_name TEXT NOT NULL UNIQUE,
        source_host TEXT NOT NULL DEFAULT '',
        source_user TEXT NOT NULL DEFAULT '',
        source_pass TEXT NOT NULL DEFAULT '',
        dest_host TEXT NOT NULL DEFAULT '',
        dest_user TEXT NOT NULL DEFAULT '',
        dest_pass TEXT NOT NULL DEFAULT '',
        options TEXT NOT NULL DEFAULT '{}',
        last_status TEXT NOT NULL DEFAULT '',
        last_run_date TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await this.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        script_name TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'Em execução',
        exit_code INTEGER,
        log_file TEXT NOT NULL DEFAULT '',
        options TEXT NOT NULL DEFAULT '{}'
      );
    `);
    await this.exec(
      'CREATE INDEX IF NOT EXISTS idx_runs_script ON runs (script_name, id DESC);'
    );
  }

  exec(sql) {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function onRun(error) {
        if (error) reject(error);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (error, row) => {
        if (error) reject(error);
        else resolve(row || null);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (error, rows) => {
        if (error) reject(error);
        else resolve(rows || []);
      });
    });
  }

  encrypt(value) {
    const text = typeof value === 'string' ? value : '';
    if (!text) return '';

    try {
      if (this.safeStorage && this.safeStorage.isEncryptionAvailable()) {
        return 'safe:' + this.safeStorage.encryptString(text).toString('base64');
      }
    } catch {
      // Fall back to local obfuscation below.
    }

    return 'b64:' + Buffer.from(text, 'utf8').toString('base64');
  }

  decrypt(value) {
    if (!value) return '';

    try {
      if (value.startsWith('safe:')) {
        if (!this.safeStorage) return '';
        return this.safeStorage.decryptString(Buffer.from(value.slice(5), 'base64'));
      }
      if (value.startsWith('b64:')) {
        return Buffer.from(value.slice(4), 'base64').toString('utf8');
      }
    } catch {
      return '';
    }

    return value;
  }

  parseOptions(value) {
    if (!value) return {};
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  async getConfiguration(scriptName) {
    const row = await this.get(
      'SELECT * FROM configurations WHERE script_name = ?',
      [scriptName]
    );

    if (!row) {
      return {
        scriptName,
        source: { host: '', user: '', pass: '' },
        destination: { host: '', user: '', pass: '' },
        options: {},
        lastStatus: '',
        lastRunDate: ''
      };
    }

    return {
      scriptName: row.script_name,
      source: {
        host: row.source_host || '',
        user: row.source_user || '',
        pass: this.decrypt(row.source_pass)
      },
      destination: {
        host: row.dest_host || '',
        user: row.dest_user || '',
        pass: this.decrypt(row.dest_pass)
      },
      options: this.parseOptions(row.options),
      lastStatus: row.last_status || '',
      lastRunDate: row.last_run_date || ''
    };
  }

  async saveConfiguration(scriptName, config = {}) {
    const source = config.source || {};
    const destination = config.destination || {};
    const options = config.options || {};
    const json = JSON.stringify(options);

    await this.run(
      `
        INSERT INTO configurations (
          script_name, source_host, source_user, source_pass,
          dest_host, dest_user, dest_pass, options, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(script_name) DO UPDATE SET
          source_host = excluded.source_host,
          source_user = excluded.source_user,
          source_pass = excluded.source_pass,
          dest_host = excluded.dest_host,
          dest_user = excluded.dest_user,
          dest_pass = excluded.dest_pass,
          options = excluded.options,
          updated_at = CURRENT_TIMESTAMP
      `,
      [
        scriptName,
        String(source.host || ''),
        String(source.user || ''),
        this.encrypt(source.pass),
        String(destination.host || ''),
        String(destination.user || ''),
        this.encrypt(destination.pass),
        json
      ]
    );
  }

  async setStatus(scriptName, status, runDate) {
    await this.run(
      `
        UPDATE configurations
        SET last_status = ?, last_run_date = ?, updated_at = CURRENT_TIMESTAMP
        WHERE script_name = ?
      `,
      [status, runDate || '', scriptName]
    );
  }

  async resetInterruptedConfigurations() {
    await this.run(
      `
        UPDATE configurations
        SET last_status = 'Interrompido'
        WHERE last_status IN ('Em execução', 'Em execucao')
      `
    );
    await this.run(
      `
        UPDATE runs
        SET status = 'Interrompido', finished_at = datetime('now')
        WHERE status IN ('Em execução', 'Em execucao')
      `
    );
  }

  async createRun({ scriptName, startedAt, options, logFile }) {
    const result = await this.run(
      `
        INSERT INTO runs (script_name, started_at, status, log_file, options)
        VALUES (?, ?, 'Em execução', ?, ?)
      `,
      [scriptName, startedAt, logFile || '', JSON.stringify(options || {})]
    );
    return result.lastID;
  }

  async finishRun({ runId, status, exitCode, finishedAt }) {
    await this.run(
      `
        UPDATE runs
        SET status = ?, exit_code = ?, finished_at = ?
        WHERE id = ?
      `,
      [status, Number.isInteger(exitCode) ? exitCode : null, finishedAt, runId]
    );
  }

  async getHistory(scriptName, limit = 8) {
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 8));
    return this.all(
      `
        SELECT id, script_name, started_at, finished_at, status, exit_code, log_file
        FROM runs
        WHERE script_name = ?
        ORDER BY id DESC
        LIMIT ${safeLimit}
      `,
      [scriptName]
    );
  }

  async close() {
    if (!this.db) return;
    await new Promise((resolve) => {
      this.db.close(() => resolve());
    });
    this.db = null;
  }
}

module.exports = { TurboDatabase };
