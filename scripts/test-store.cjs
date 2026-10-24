'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { GameStore } = require('../electron/store.cjs');

const settings = {
  questionsPerRound: 10, questionTimeLimitSeconds: 30,
  baseCorrectPoints: 1000, maxSpeedBonus: 90, feedbackDurationMs: 1500,
  idleTimeoutSeconds: 90, resultsTimeoutSeconds: 30, eventName: 'AI or Real',
};
function result(id) {
  return {
    id, player: { name: 'Test Agent', email: 'test@example.com' },
    answers: [{ questionId: 'q1', selected: 'real', correct: true, elapsedMs: 1234, points: 1086 }],
    score: 1086, correctCount: 1, correctTimeMs: 1234, totalTimeMs: 1234,
    completedAt: '2026-10-24T12:00:00.000Z', settings, isDemo: true,
  };
}
(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-real-store-'));
  try {
    const store = new GameStore(directory);
    assert.deepEqual((await store.load()).results, []);
    await store.saveSettings(settings);
    // Concurrent writes must serialize without losing either completed round.
    await Promise.all([store.saveResult(result('one')), store.saveResult(result('two'))]);
    assert.equal((await store.load()).results.length, 2);
    await store.saveResult(result('two'));
    assert.equal((await store.load()).results.length, 2, 'Retrying a save must be idempotent');
    const restored = new GameStore(directory);
    assert.equal((await restored.load()).results.length, 2);
    assert.equal((await restored.load()).settings.eventName, settings.eventName);
    await fs.writeFile(store.filename, '{ damaged json', 'utf8');
    const recovered = await store.load();
    assert.ok(recovered.results.length >= 1);
    assert.match(recovered.warning, /backup/);
    assert.ok((await fs.readdir(directory)).some((name) => name.includes('.corrupt-')));
    await store.saveResult(result('three'));
    assert.ok((await store.load()).results.some((row) => row.id === 'three'));
    await assert.rejects(async () => store.saveResult({ ...result('bad'), score: NaN }), /Invalid/);
    await store.clearResults();
    const cleared = await store.load();
    assert.equal(cleared.results.length, 0);
    assert.equal(cleared.settings.eventName, settings.eventName);
    console.log('Persistence checks passed: restart, concurrent writes, retries, corrupt-file recovery, validation and clearing.');
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
