import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS, createResult, createRound, exportResultsCsv, formatTime,
  makeAnswer, normalizeSettings, parseQuestionBank, rankResults, scoreAnswer, validatePlayer,
  type Question,
} from '../src/core';

const settings = normalizeSettings();
const questions: Question[] = Array.from({ length: 50 }, (_, index) => ({
  id: `q-${index}`, image: `/images/${index}.jpg`, answer: index % 2 ? 'ai' : 'real',
  title: `Image ${index}`, explanation: 'A test image.',
}));
const player = { name: 'Alex', email: 'alex@example.com' };

describe('registration validation', () => {
  it('accepts ordinary names, accents, company domains and plus addresses', () => {
    expect(validatePlayer({ name: ' Zoë Al Rashid ', email: 'alex+event@company.co.uk' })).toEqual({});
  });
  it.each(['', 'a@', 'a@example', 'a b@example.com', '.a@example.com', 'a..b@example.com', 'a@-example.com', 'a@example..com', 'a@example.com\nBcc:foo@bar.com'])('rejects malformed email %s', email => {
    expect(validatePlayer({ ...player, email }).email).toBeTruthy();
  });
  it('suggests a common typo without claiming deliverability or blocking the address', () => {
    expect(validatePlayer({ ...player, email: 'Alex@gmial.com' })).toEqual({ suggestion: 'Alex@gmail.com' });
    expect(validatePlayer({ ...player, email: 'alex@newcompany.example' })).toEqual({});
  });
  it('checks name length and controls', () => {
    expect(validatePlayer({ ...player, name: ' ' }).name).toBeTruthy();
    expect(validatePlayer({ ...player, name: 'A'.repeat(61) }).name).toBeTruthy();
    expect(validatePlayer({ ...player, name: 'Alex\u0001' }).name).toBeTruthy();
  });
});

describe('question bank validation', () => {
  const pairedQuestion = { id: 'pair-1', image: 'images/real.jpg', decoyImage: 'images/ai.png', answer: 'real' };
  const bank = { version: 1, mode: 'demo', questions: [pairedQuestion] };

  it('accepts local paired images, adds defaults and forces demo labels without mutating input', () => {
    const parsed = parseQuestionBank(bank);
    expect(parsed).toMatchObject({ version: 1, mode: 'demo', description: '', questions: [{ ...pairedQuestion, title: 'Image 1', explanation: '', demo: true }] });
    expect('demo' in pairedQuestion).toBe(false);
    expect(parsed.questions[0]).not.toBe(pairedQuestion);
  });
  it('accepts URL-encoded filenames and desktop-resolved file URLs', () => {
    const parsed = parseQuestionBank({ ...bank, mode: 'production', questions: [{ ...pairedQuestion, image: './images/My%20Photo.JPEG', decoyImage: 'file:///C:/Users/Event/content/images/AI%20Image.avif', demo: false }] });
    expect(parsed.questions[0]).toMatchObject({ image: 'images/My%20Photo.JPEG', demo: false });
  });
  it.each([
    null, [], { ...bank, version: 2 }, { ...bank, mode: 'other' }, { ...bank, questions: [] },
    { ...bank, questions: Array.from({ length: 501 }, () => pairedQuestion) },
    { ...bank, questions: [{ ...pairedQuestion, answer: 'ai' }] },
    { ...bank, questions: [{ ...pairedQuestion, id: '' }] },
    { ...bank, questions: [{ ...pairedQuestion, decoyImage: undefined }] },
    { ...bank, questions: [{ ...pairedQuestion, title: 42 }] },
    { ...bank, questions: [{ ...pairedQuestion, demo: 'false' }] },
  ])('rejects invalid structure or metadata %#', input => {
    expect(() => parseQuestionBank(input)).toThrow();
  });
  it.each([
    'https://example.com/photo.jpg', '//example.com/photo.jpg', '/images/photo.jpg',
    '../photo.jpg', 'images/../photo.jpg', 'images/%2e%2e/photo.jpg', 'images/%252e%252e/photo.jpg',
    'images/a%2fb.jpg', 'images\\photo.jpg', 'images/photo.jpg?x=1', 'images/photo.jpg#fragment',
    'images/photo.svg', 'images/photo.gif', 'images/%00photo.jpg', 'images/%ZZphoto.jpg',
    'file://server/share/photo.jpg', 'file:////server/share/photo.jpg', 'file:///C:/images/../photo.jpg',
    'file:///C:/images/%2e%2e/photo.jpg', 'data:image/png;base64,abc',
  ])('rejects unsafe image path %s', image => {
    expect(() => parseQuestionBank({ ...bank, questions: [{ ...pairedQuestion, image }] })).toThrow();
  });
  it('rejects duplicate IDs, image aliases in a pair, and repeated or swapped pairs', () => {
    expect(() => parseQuestionBank({ ...bank, questions: [pairedQuestion, { ...pairedQuestion, image: 'images/other.jpg' }] })).toThrow(/unique ID/);
    expect(() => parseQuestionBank({ ...bank, questions: [{ ...pairedQuestion, image: 'images/AI.png' }] })).toThrow(/different/);
    expect(() => parseQuestionBank({ ...bank, questions: [{ ...pairedQuestion, image: 'images/%61i.png' }] })).toThrow(/different/);
    expect(() => parseQuestionBank({ ...bank, questions: [pairedQuestion, { ...pairedQuestion, id: 'pair-2' }] })).toThrow(/repeats an image pair/);
    expect(() => parseQuestionBank({ ...bank, questions: [pairedQuestion, { ...pairedQuestion, id: 'pair-2', image: pairedQuestion.decoyImage, decoyImage: pairedQuestion.image }] })).toThrow(/repeats an image pair/);
  });
});

describe('round sampling', () => {
  it('draws 10 unique images without changing the bank', () => {
    const before = [...questions];
    const round = createRound(questions, 10, () => 0.3);
    expect(round).toHaveLength(10);
    expect(new Set(round.map(q => q.id)).size).toBe(10);
    expect(questions).toEqual(before);
    expect(round.map(q => q.id)).not.toEqual(questions.slice(0, 10).map(q => q.id));
  });
  it('ignores duplicate IDs and refuses to silently shorten a round', () => {
    expect(createRound([...questions, questions[0]], 50)).toHaveLength(50);
    expect(() => createRound([questions[0], questions[0]], 2)).toThrow(/unique/);
    expect(() => createRound(questions, 0)).toThrow();
    expect(() => createRound(questions, 2, () => 1)).toThrow(/random/);
  });
});

describe('scoring', () => {
  it('gives base points and a decreasing speed bonus for correct answers only', () => {
    expect(scoreAnswer(true, 0, settings)).toBe(1090);
    expect(scoreAnswer(true, 15_000, settings)).toBe(1045);
    expect(scoreAnswer(true, 29_999, settings)).toBe(1000);
    expect(scoreAnswer(true, 29_999.9, settings)).toBe(1000);
    expect(scoreAnswer(false, 0, settings)).toBe(0);
  });
  it('treats the deadline, nonfinite time and no selection as incorrect', () => {
    expect(scoreAnswer(true, 30_000, settings)).toBe(0);
    expect(scoreAnswer(true, Number.NaN, settings)).toBe(0);
    expect(makeAnswer(questions[0], 'real', 30_001, settings)).toMatchObject({ correct: false, points: 0, elapsedMs: 30_000 });
    expect(makeAnswer(questions[0], null, 1_000, settings)).toMatchObject({ correct: false, points: 0 });
    expect(makeAnswer(questions[0], 'ai', 1_000, settings)).toMatchObject({ correct: false, points: 0 });
  });
  it('makes one extra correct answer beat every possible speed bonus', () => {
    for (let count = 1; count <= 50; count += 1) {
      const custom = normalizeSettings({ questionsPerRound: count, maxSpeedBonus: 100_000 });
      for (let correct = 1; correct <= count; correct += 1) {
        expect(correct * custom.baseCorrectPoints).toBeGreaterThan((correct - 1) * scoreAnswer(true, 0, custom));
      }
    }
  });
  it('normalizes invalid settings and never mutates defaults', () => {
    const custom = normalizeSettings({ questionsPerRound: 500, questionTimeLimitSeconds: -1, baseCorrectPoints: 100, maxSpeedBonus: 999, feedbackDurationMs: Number.NaN, eventName: '  Event  ' });
    expect(custom).toMatchObject({ questionsPerRound: 50, questionTimeLimitSeconds: 5, baseCorrectPoints: 100, maxSpeedBonus: 1, eventName: 'Event', feedbackDurationMs: 1800 });
    expect(normalizeSettings({ eventName: ' ' }).eventName).toBe(DEFAULT_SETTINGS.eventName);
    expect(DEFAULT_SETTINGS.questionsPerRound).toBe(10);
    expect(Object.isFrozen(DEFAULT_SETTINGS)).toBe(true);
  });
});

describe('results and exports', () => {
  it('counts only correct answer time and recomputes untrusted points', () => {
    const answers = [makeAnswer(questions[0], 'real', 1_000, settings), makeAnswer(questions[1], 'real', 7_000, settings)];
    answers[0].points = 999_999;
    const result = createResult({ name: ' Alex ', email: ' ALEX@EXAMPLE.COM ' }, answers, settings, true);
    expect(result).toMatchObject({ score: 1087, correctCount: 1, correctTimeMs: 1000, totalTimeMs: 8000, isDemo: true, player });
    expect(result.id).toBeTruthy();
    expect(Number.isFinite(Date.parse(result.completedAt))).toBe(true);
    expect(answers[0].points).toBe(999_999);
  });
  it('sorts by points, then correct answer time, then completion date', () => {
    const base = createResult(player, [], settings, false);
    const rows = [
      { ...base, id: 'slow', score: 2000, correctTimeMs: 3000 },
      { ...base, id: 'less', score: 1000, correctTimeMs: 0 },
      { ...base, id: 'later', score: 2000, correctTimeMs: 1000, completedAt: '2026-10-24T12:00:00Z' },
      { ...base, id: 'winner', score: 2000, correctTimeMs: 1000, completedAt: '2026-10-24T11:00:00Z' },
    ];
    expect(rankResults(rows).map(row => row.id)).toEqual(['winner', 'later', 'slow', 'less']);
    expect(rows[0].id).toBe('slow');
  });
  it('escapes quotes and newlines and prevents spreadsheet formula injection', () => {
    const row = createResult({ name: '=HYPERLINK("bad")', email: 'safe@example.com' }, [], settings, false);
    const csv = exportResultsCsv([row]);
    expect(csv.startsWith('\ufeff')).toBe(true);
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"safe@example.com"');
    expect(csv).toContain('\r\n');
  });
  it('formats elapsed time consistently', () => {
    expect(formatTime(1234)).toBe('1.2s');
    expect(formatTime(-1)).toBe('0.0s');
    expect(formatTime(Number.NaN)).toBe('0.0s');
  });
});
