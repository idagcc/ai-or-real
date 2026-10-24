'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_RESULTS = 50000;
const MAX_STORE_BYTES = 64 * 1024 * 1024;
const SETTINGS_KEYS = [
  'questionsPerRound', 'questionTimeLimitSeconds', 'baseCorrectPoints',
  'maxSpeedBonus', 'feedbackDurationMs', 'idleTimeoutSeconds',
  'resultsTimeoutSeconds', 'eventName',
];

function finite(value, min, max, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Invalid ${label}.`);
  }
  return value;
}

function text(value, max, label) {
  if (typeof value !== 'string' || value.length > max) throw new Error(`Invalid ${label}.`);
  return value;
}

function sanitizeSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid game settings.');
  const clean = {};
  for (const key of SETTINGS_KEYS) {
    if (key === 'eventName') clean[key] = text(value[key], 120, 'event name');
    else clean[key] = finite(value[key], 0, 1000000, key);
  }
  finite(clean.questionsPerRound, 1, 50, 'questions per round');
  finite(clean.questionTimeLimitSeconds, 1, 300, 'question time limit');
  if (!Number.isInteger(clean.questionsPerRound)) throw new Error('Question count must be a whole number.');
  return clean;
}

function sanitizeResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid game result.');
  if (!value.player || !Array.isArray(value.answers) || value.answers.length > 50) throw new Error('Invalid result details.');
  const completedAt = text(value.completedAt, 64, 'completion date');
  if (!Number.isFinite(Date.parse(completedAt))) throw new Error('Invalid completion date.');
  const answers = value.answers.map((answer) => {
    if (!answer || !['real', 'ai', null].includes(answer.selected) || typeof answer.correct !== 'boolean') {
      throw new Error('Invalid answer.');
    }
    return {
      questionId: text(answer.questionId, 120, 'question ID'),
      selected: answer.selected,
      correct: answer.correct,
      elapsedMs: finite(answer.elapsedMs, 0, 86400000, 'answer time'),
      points: finite(answer.points, 0, 100000000, 'answer points'),
    };
  });
  return {
    id: text(value.id, 120, 'result ID'),
    player: { name: text(value.player.name, 120, 'agent name'), email: text(value.player.email, 254, 'email') },
    answers,
    score: finite(value.score, 0, 100000000, 'score'),
    correctCount: finite(value.correctCount, 0, 50, 'correct answer count'),
    correctTimeMs: finite(value.correctTimeMs, 0, 86400000, 'correct answer time'),
    totalTimeMs: finite(value.totalTimeMs, 0, 86400000, 'round time'),
    completedAt,
    settings: sanitizeSettings(value.settings),
    isDemo: Boolean(value.isDemo),
  };
}

function sanitizeStore(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.results) || value.results.length > MAX_RESULTS) {
    throw new Error('Invalid saved leaderboard.');
  }
  return {
    version: 1,
    results: value.results.map(sanitizeResult),
    settings: value.settings === null ? null : sanitizeSettings(value.settings),
  };
}

class GameStore {
  constructor(directory) {
    this.directory = directory;
    this.filename = path.join(directory, 'ai-or-real-data.json');
    this.backup = `${this.filename}.backup`;
    this.queue = Promise.resolve();
    this.warning = null;
  }

  async readFile(filename) {
    const stat = await fs.stat(filename);
    if (stat.size > MAX_STORE_BYTES) throw new Error('Saved data exceeds the supported file size.');
    return sanitizeStore(JSON.parse(await fs.readFile(filename, 'utf8')));
  }

  async read() {
    await fs.mkdir(this.directory, { recursive: true });
    try {
      return await this.readFile(this.filename);
    } catch (error) {
      if (error.code === 'ENOENT') {
        try {
          const recovered = await this.readFile(this.backup);
          this.warning = 'Recovered the leaderboard from its most recent backup.';
          return recovered;
        } catch (backupError) {
          if (backupError.code !== 'ENOENT') throw new Error('The leaderboard backup could not be read. Keep the data files and contact the operator.');
          return { version: 1, results: [], settings: null };
        }
      }
      if (error.code && !['ENOENT'].includes(error.code)) {
        throw new Error(`Could not read the saved leaderboard: ${error.message}`);
      }
      // Preserve the damaged file before attempting backup recovery.
      const preserved = `${this.filename}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      await fs.copyFile(this.filename, preserved);
      try {
        const recovered = await this.readFile(this.backup);
        this.warning = 'A damaged data file was preserved. The latest backup was recovered; the last write may be missing.';
        return recovered;
      } catch (backupError) {
        throw new Error('The saved leaderboard is damaged. Its original file has been preserved; operator recovery is required.');
      }
    }
  }

  async write(value) {
    const safe = sanitizeStore(value);
    const serialized = JSON.stringify(safe, null, 2);
    if (Buffer.byteLength(serialized) > MAX_STORE_BYTES) throw new Error('Leaderboard storage is full. Export and clear the leaderboard before continuing.');
    await fs.mkdir(this.directory, { recursive: true });
    const temporary = `${this.filename}.${crypto.randomUUID()}.tmp`;
    try {
      const handle = await fs.open(temporary, 'wx', 0o600);
      try {
        await handle.writeFile(serialized, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      try {
        // Never replace a good backup with a corrupt main file.
        await this.readFile(this.filename);
        await fs.copyFile(this.filename, this.backup);
      } catch (error) {
        if (error.code && error.code !== 'ENOENT') throw error;
      }
      await fs.rename(temporary, this.filename);
    } finally {
      await fs.rm(temporary, { force: true }).catch(() => {});
    }
  }

  transaction(change, afterWrite) {
    const operation = this.queue.then(async () => {
      const current = await this.read();
      const next = await change(current);
      await this.write(next);
      if (afterWrite) await afterWrite();
    });
    this.queue = operation.catch(() => {});
    return operation;
  }

  async load() {
    await this.queue;
    const data = await this.read();
    return { results: data.results, settings: data.settings, warning: this.warning, storagePath: this.filename };
  }

  saveResult(value) {
    const result = sanitizeResult(value);
    return this.transaction((store) => {
      const existing = store.results.findIndex((item) => item.id === result.id);
      if (existing >= 0) store.results[existing] = result;
      else {
        if (store.results.length >= MAX_RESULTS) throw new Error('The leaderboard is full. Export it before clearing old results.');
        store.results.push(result);
      }
      return store;
    });
  }

  saveSettings(value) {
    const settings = sanitizeSettings(value);
    return this.transaction((store) => ({ ...store, settings }));
  }

  clearResults() {
    return this.transaction(
      (store) => ({ ...store, results: [] }),
      () => fs.copyFile(this.filename, this.backup),
    );
  }
}

module.exports = { GameStore, sanitizeResult, sanitizeSettings, sanitizeStore };
