import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'public');
const imagesRoot = await realpath(path.join(publicRoot, 'images'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function localImagePath(value, label) {
  assert(typeof value === 'string' && value.length > 0 && value.length < 500, `${label}: missing image path.`);
  let decoded;
  try { decoded = decodeURIComponent(value); }
  catch { throw new Error(`${label}: invalid URL encoding.`); }
  assert(!/[\\:\u0000-\u001f\u007f?#]/.test(decoded) && !/%[a-f0-9]{2}/i.test(decoded), `${label}: unsafe image path.`);
  assert(decoded.startsWith('images/') && decoded.split('/').every(part => part && part !== '.' && part !== '..'), `${label}: image must remain under public/images.`);
  assert(/\.(?:jpe?g|png|webp|avif)$/i.test(decoded), `${label}: unsupported image format.`);
  return decoded;
}

async function sha1(filename) {
  const hash = createHash('sha1');
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}

try {
  const bank = JSON.parse(await readFile(path.join(publicRoot, 'questions.json'), 'utf8'));
  const manifest = JSON.parse(await readFile(path.join(imagesRoot, 'office-sources.json'), 'utf8'));
  assert(bank.version === 1 && bank.mode === 'production', 'The bank must be production version 1.');
  assert(Array.isArray(bank.questions) && bank.questions.length === 50, 'The production bank must contain exactly 50 questions.');
  assert(Array.isArray(manifest.assets) && manifest.assets.length === 100, 'The source manifest must contain exactly 100 original images.');
  const sourceByFile = new Map();
  const sourceSets = new Map();
  for (const source of manifest.assets) {
    const file = localImagePath(source.file, 'Source manifest');
    assert(!sourceByFile.has(file.toLowerCase()), `Source manifest repeats ${file}.`);
    assert(source.label === 'real' || source.label === 'ai', `${file}: invalid source label.`);
    assert(Number.isInteger(source.set) && source.set >= 1 && source.set <= 50, `${file}: invalid source set.`);
    assert(typeof source.hash === 'string' && /^[0-9a-f]{40}$/i.test(source.hash), `${file}: invalid original SHA-1.`);
    assert(typeof source.nodeId === 'string' && /^\d+:\d+$/.test(source.nodeId), `${file}: missing original Figma node.`);
    sourceByFile.set(file.toLowerCase(), source);
    const labels = sourceSets.get(source.set) ?? new Set();
    assert(!labels.has(source.label), `Source set ${source.set} repeats its ${source.label} label.`);
    labels.add(source.label);
    sourceSets.set(source.set, labels);
  }
  assert(sourceSets.size === 50 && [...sourceSets.values()].every(labels => labels.size === 2), 'Each original set must have one real image and one AI image.');

  const ids = new Set();
  const pairs = new Set();
  const usedImages = new Set();
  const usedSets = new Set();
  for (const [index, question] of bank.questions.entries()) {
    const label = `Question ${index + 1}`;
    assert(typeof question.id === 'string' && question.id.trim() && !ids.has(question.id), `${label}: empty or duplicate ID.`);
    ids.add(question.id);
    assert(question.answer === 'real' && question.demo === false, `${label}: production answer/demo labels are invalid.`);
    const real = localImagePath(question.image, `${label} real image`);
    const ai = localImagePath(question.decoyImage, `${label} AI image`);
    const realSource = sourceByFile.get(real.toLowerCase());
    const aiSource = sourceByFile.get(ai.toLowerCase());
    assert(realSource?.label === 'real', `${label}: real image does not match the source label.`);
    assert(aiSource?.label === 'ai', `${label}: AI image does not match the source label.`);
    assert(realSource.set === aiSource.set, `${label}: real and AI images belong to different original sets.`);
    assert(!usedSets.has(realSource.set), `${label}: original image set ${realSource.set} is repeated.`);
    usedSets.add(realSource.set);
    const pair = JSON.stringify([real.toLowerCase(), ai.toLowerCase()].sort());
    assert(!pairs.has(pair), `${label}: duplicate image pair.`);
    pairs.add(pair);
    for (const file of [real, ai]) {
      assert(!usedImages.has(file.toLowerCase()), `${label}: image ${file} is repeated.`);
      usedImages.add(file.toLowerCase());
    }
  }
  assert(usedImages.size === 100 && usedSets.size === 50, 'The bank must use all 100 original images exactly once.');

  let totalBytes = 0;
  for (const [file, source] of sourceByFile) {
    assert(usedImages.has(file), `Manifest asset ${file} is not used by the bank.`);
    const actual = await realpath(path.join(publicRoot, localImagePath(source.file, 'Asset')));
    assert(actual.startsWith(`${imagesRoot}${path.sep}`), `${source.file}: asset resolves outside public/images.`);
    const info = await stat(actual);
    assert(info.isFile() && info.size > 0, `${source.file}: image is missing or empty.`);
    assert(info.size === source.bytes, `${source.file}: size differs from original manifest (${info.size} vs ${source.bytes}).`);
    assert(await sha1(actual) === source.hash.toLowerCase(), `${source.file}: SHA-1 differs from the Figma original.`);
    totalBytes += info.size;
  }
  console.log(`PASS: 50 unique production questions; 100 non-empty local images; all real/AI pair labels match their original Figma sets; all 100 SHA-1 hashes and byte sizes match the originals (${totalBytes.toLocaleString('en-US')} bytes).`);
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
