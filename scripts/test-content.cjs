'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { loadQuestionBank } = require('../electron/content.cjs');

(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-real-content-'));
  const packaged = path.join(directory, 'packaged');
  const data = path.join(directory, 'user-data');
  const content = path.join(data, 'content');
  try {
    await fs.mkdir(packaged, { recursive: true });
    await fs.writeFile(path.join(packaged, 'questions.json'), JSON.stringify({ mode: 'demo', questions: [{ id: 'demo' }] }));
    assert.equal((await loadQuestionBank(data, packaged)).mode, 'demo');
    await fs.mkdir(path.join(content, 'images'), { recursive: true });
    await fs.writeFile(path.join(content, 'images', 'real image.jpg'), 'test-image-content');
    await fs.writeFile(path.join(content, 'images', 'ai.png'), 'test-image-content');
    const external = {
      mode: 'production', questions: [{ id: 'final-1', image: 'images/real image.jpg', decoyImage: 'images/ai.png', answer: 'real' }],
    };
    const bankFile = path.join(content, 'questions.json');
    const save = async (bank) => fs.writeFile(bankFile, JSON.stringify(bank));
    await save(external);
    const loaded = await loadQuestionBank(data, packaged);
    assert.equal(loaded.mode, 'production');
    assert.equal(fileURLToPath(loaded.questions[0].image), await fs.realpath(path.join(content, 'images', 'real image.jpg')));
    assert.equal(fileURLToPath(loaded.questions[0].decoyImage), await fs.realpath(path.join(content, 'images', 'ai.png')));
    await save({ ...external, questions: [{ ...external.questions[0], image: '../outside.jpg' }] });
    await assert.rejects(loadQuestionBank(data, packaged), /relative local image/);
    await save({ ...external, questions: [{ ...external.questions[0], image: 'https://example.com/a.jpg' }] });
    await assert.rejects(loadQuestionBank(data, packaged), /relative local image/);
    await save({ ...external, questions: [{ ...external.questions[0], image: 'images/missing.jpg' }] });
    await assert.rejects(loadQuestionBank(data, packaged), /could not be found/);
    await fs.writeFile(bankFile, '{invalid json');
    await assert.rejects(loadQuestionBank(data, packaged));
    await fs.rm(bankFile);
    assert.equal((await loadQuestionBank(data, packaged)).mode, 'demo');
    console.log('Content checks passed: built-in fallback, external override, local image URLs, traversal/remote/missing-image rejection and invalid-bank errors.');
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
