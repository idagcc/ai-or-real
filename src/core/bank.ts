import type { Question } from './index';

export interface QuestionBank {
  version: 1;
  mode: 'demo' | 'production';
  description: string;
  questions: Question[];
}

type RecordValue = Record<string, unknown>;

function object(value: unknown, label: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as RecordValue;
}

function text(value: unknown, label: string, maximum: number, fallback?: string): string {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string' || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    throw new Error(`${label} must be text containing at most ${maximum} characters.`);
  }
  return value.trim();
}

/**
 * Accept only offline raster assets. Electron validates file existence and containment
 * before passing resolved file:/// URLs through its preload bridge.
 */
function imagePath(value: unknown, label: string): { value: string; key: string } {
  if (typeof value !== 'string' || !value || value !== value.trim() || value.length > 2_000
    || /[\u0000-\u001f\u007f\\?#]/.test(value)) {
    throw new Error(`${label} needs a safe local image path, such as images/photo-01.jpg.`);
  }
  let decoded: string;
  try { decoded = decodeURIComponent(value); }
  catch { throw new Error(`${label} contains invalid URL encoding.`); }
  // A second encoding layer or an encoded separator can hide traversal or aliases.
  if (/%[0-9a-f]{2}/i.test(decoded) || /[\u0000-\u001f\u007f\\]/.test(decoded)
    || /%(?:2f|5c)/i.test(value)) {
    throw new Error(`${label} contains unsafe URL encoding.`);
  }

  let canonical: string;
  let output = value.replace(/^\.\//, '');
  if (value.startsWith('file:///')) {
    const rawPath = decoded.slice('file:///'.length);
    if (rawPath.split('/').some(part => part === '.' || part === '..')) {
      throw new Error(`${label} must not contain path traversal.`);
    }
    let url: URL;
    try { url = new URL(value); }
    catch { throw new Error(`${label} is not a valid local file URL.`); }
    if (url.protocol !== 'file:' || url.hostname || url.username || url.password || url.search || url.hash
      || !url.pathname || url.pathname.startsWith('//')) {
      throw new Error(`${label} must use a local file:/// URL without a network host.`);
    }
    canonical = decodeURIComponent(url.pathname);
    // Windows drive prefixes are valid; colons in later path components are not.
    if (canonical.replace(/^\/[a-z]:/i, '').includes(':')) throw new Error(`${label} contains an invalid file path.`);
    output = url.href;
  } else {
    canonical = decoded.replace(/^\.\//, '');
    if (!canonical || canonical.startsWith('/') || canonical.includes(':')
      || canonical.split('/').some(part => !part || part === '.' || part === '..')) {
      throw new Error(`${label} must stay inside the local images folder; remote URLs and traversal are not allowed.`);
    }
  }
  if (/[<>"|*]/.test(canonical) || !/\.(?:jpe?g|png|webp|avif)$/i.test(canonical)) {
    throw new Error(`${label} must be a JPG, JPEG, PNG, WebP or AVIF image.`);
  }
  return { value: output, key: canonical.normalize('NFC').toLowerCase() };
}

function optionalText(value: unknown, label: string, maximum: number): string | undefined {
  return value === undefined ? undefined : text(value, label, maximum);
}

function position(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  const result = text(value, label, 80);
  const components = result.split(/\s+/);
  if (components.length < 1 || components.length > 2 || !components.every(part =>
    ['left', 'right', 'top', 'bottom', 'center'].includes(part)
    || (/^\d+(?:\.\d+)?%$/.test(part) && Number.parseFloat(part) <= 100))) {
    throw new Error(`${label} must contain a position such as center or 50% 50%.`);
  }
  return result;
}

/** Validate and copy an imported bank before it can become an active round. */
export function parseQuestionBank(input: unknown): QuestionBank {
  const bank = object(input, 'The question bank');
  if (bank.version !== 1) throw new Error('The question bank must use version 1.');
  if (bank.mode !== 'demo' && bank.mode !== 'production') throw new Error('The question bank mode must be demo or production.');
  if (!Array.isArray(bank.questions) || bank.questions.length < 1 || bank.questions.length > 500) {
    throw new Error('The question bank needs between 1 and 500 paired questions.');
  }
  const ids = new Set<string>();
  const pairs = new Set<string>();
  const mode = bank.mode;
  const questions = bank.questions.map((value, index): Question => {
    const label = `Question ${index + 1}`;
    const question = object(value, label);
    const id = text(question.id, `${label} ID`, 120);
    if (!id) throw new Error(`${label} needs a non-empty ID.`);
    if (ids.has(id)) throw new Error(`${label} repeats question ID ${id}. Every question needs a unique ID.`);
    ids.add(id);
    if (question.answer !== 'real') throw new Error(`${label} must identify the real photograph with answer: real.`);
    const real = imagePath(question.image, `${label} real image`);
    const decoy = imagePath(question.decoyImage, `${label} AI image`);
    if (real.key === decoy.key) throw new Error(`${label} must use different real and AI images.`);
    // Sorting also rejects a duplicate pair with the two images swapped.
    const pairKey = JSON.stringify([real.key, decoy.key].sort());
    if (pairs.has(pairKey)) throw new Error(`${label} repeats an image pair already in the bank.`);
    pairs.add(pairKey);
    if (question.demo !== undefined && typeof question.demo !== 'boolean') throw new Error(`${label} demo must be true or false.`);
    return {
      id,
      image: real.value,
      decoyImage: decoy.value,
      answer: 'real',
      title: text(question.title, `${label} title`, 200, `Image ${index + 1}`),
      explanation: text(question.explanation, `${label} explanation`, 4_000, ''),
      source: optionalText(question.source, `${label} source`, 2_000),
      credit: optionalText(question.credit, `${label} credit`, 500),
      demo: mode === 'demo' || question.demo === true,
      imagePosition: position(question.imagePosition, `${label} image position`),
      decoyImagePosition: position(question.decoyImagePosition, `${label} AI image position`),
    };
  });
  return { version: 1, mode, description: text(bank.description, 'The bank description', 4_000, ''), questions };
}
