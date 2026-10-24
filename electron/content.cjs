'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MAX_BANK_BYTES = 2 * 1024 * 1024;

async function readBank(filename) {
  const stat = await fs.stat(filename);
  if (stat.size > MAX_BANK_BYTES) throw new Error('The question bank is too large (maximum 2 MB).');
  const bank = JSON.parse(await fs.readFile(filename, 'utf8'));
  if (!bank || typeof bank !== 'object' || !Array.isArray(bank.questions) || bank.questions.length < 1 || bank.questions.length > 1000) {
    throw new Error('The question bank needs a questions array containing 1 to 1,000 questions.');
  }
  return bank;
}

async function localImageUrl(directory, image, label) {
  if (typeof image !== 'string' || image.length > 500) throw new Error(`${label} needs a local image path.`);
  const relative = image.replace(/^\.\//, '');
  if (!relative || path.isAbsolute(relative) || relative.includes('\\') || relative.includes(':') ||
    relative.split('/').some((part) => !part || part === '.' || part === '..') ||
    !/\.(?:png|jpe?g|webp|avif|gif|svg)$/i.test(relative)) {
    throw new Error(`${label} must use a relative local image path such as images/photo-01.jpg.`);
  }
  const realDirectory = await fs.realpath(directory);
  const target = await fs.realpath(path.resolve(directory, relative)).catch(() => {
    throw new Error(`${label} could not be found: ${relative}`);
  });
  if (!target.startsWith(`${realDirectory}${path.sep}`)) throw new Error(`${label} must stay inside the content folder.`);
  const stat = await fs.stat(target);
  if (!stat.isFile() || stat.size === 0 || stat.size > 40 * 1024 * 1024) throw new Error(`${label} must be a non-empty image under 40 MB.`);
  return pathToFileURL(target).href;
}

async function loadQuestionBank(userData, packagedContentDirectory) {
  const contentDirectory = path.join(userData, 'content');
  const externalFile = path.join(contentDirectory, 'questions.json');
  let external = false;
  try { await fs.access(externalFile); external = true; }
  catch (error) { if (error.code !== 'ENOENT') throw new Error(`Cannot access the external question bank: ${error.message}`); }
  if (!external) return readBank(path.join(packagedContentDirectory, 'questions.json'));
  const bank = await readBank(externalFile);
  const questions = [];
  for (let index = 0; index < bank.questions.length; index += 1) {
    const question = bank.questions[index];
    const label = `Question ${index + 1}`;
    if (!question || typeof question !== 'object' || !['real', 'ai'].includes(question.answer)) {
      throw new Error(`${label} needs an answer of real or ai.`);
    }
    const next = { ...question, image: await localImageUrl(contentDirectory, question.image, `${label} image`) };
    if (question.decoyImage) next.decoyImage = await localImageUrl(contentDirectory, question.decoyImage, `${label} second image`);
    questions.push(next);
  }
  return { ...bank, questions };
}

module.exports = { loadQuestionBank };
