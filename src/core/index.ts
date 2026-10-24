export type ImageAnswer = 'real' | 'ai';

export { parseQuestionBank, type QuestionBank } from './bank';

export interface GameSettings {
  questionsPerRound: number;
  questionTimeLimitSeconds: number;
  baseCorrectPoints: number;
  maxSpeedBonus: number;
  feedbackDurationMs: number;
  idleTimeoutSeconds: number;
  resultsTimeoutSeconds: number;
  eventName: string;
}

export interface Question {
  id: string;
  image: string;
  answer: ImageAnswer;
  title: string;
  explanation: string;
  source?: string;
  credit?: string;
  demo?: boolean;
  imagePosition?: string;
  /** In paired-image mode, image is the real photo and decoyImage is its AI option. */
  decoyImage?: string;
  decoyImagePosition?: string;
}

export interface Player {
  name: string;
  email: string;
}

export interface Answer {
  questionId: string;
  selected: ImageAnswer | null;
  correct: boolean;
  elapsedMs: number;
  points: number;
}

export interface Result {
  id: string;
  player: Player;
  answers: Answer[];
  score: number;
  correctCount: number;
  correctTimeMs: number;
  totalTimeMs: number;
  completedAt: string;
  settings: GameSettings;
  isDemo: boolean;
}

/** A full round's speed bonuses are worth less than one correct answer. */
export const DEFAULT_SETTINGS: Readonly<GameSettings> = Object.freeze({
  questionsPerRound: 10,
  questionTimeLimitSeconds: 30,
  baseCorrectPoints: 1_000,
  maxSpeedBonus: 90,
  feedbackDurationMs: 1_800,
  idleTimeoutSeconds: 120,
  resultsTimeoutSeconds: 30,
  eventName: 'AI OR REAL',
});

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}

export function normalizeSettings(partial: Partial<GameSettings> = {}): GameSettings {
  const questionsPerRound = boundedInteger(partial.questionsPerRound, DEFAULT_SETTINGS.questionsPerRound, 1, 50);
  const baseCorrectPoints = boundedInteger(partial.baseCorrectPoints, DEFAULT_SETTINGS.baseCorrectPoints, 100, 100_000);
  const speedCap = Math.floor(baseCorrectPoints / (questionsPerRound + 1));
  return {
    questionsPerRound,
    questionTimeLimitSeconds: boundedInteger(partial.questionTimeLimitSeconds, DEFAULT_SETTINGS.questionTimeLimitSeconds, 5, 120),
    baseCorrectPoints,
    maxSpeedBonus: boundedInteger(partial.maxSpeedBonus, Math.min(DEFAULT_SETTINGS.maxSpeedBonus, speedCap), 0, speedCap),
    feedbackDurationMs: boundedInteger(partial.feedbackDurationMs, DEFAULT_SETTINGS.feedbackDurationMs, 500, 10_000),
    idleTimeoutSeconds: boundedInteger(partial.idleTimeoutSeconds, DEFAULT_SETTINGS.idleTimeoutSeconds, 30, 900),
    resultsTimeoutSeconds: boundedInteger(partial.resultsTimeoutSeconds, DEFAULT_SETTINGS.resultsTimeoutSeconds, 5, 300),
    eventName: typeof partial.eventName === 'string' && partial.eventName.trim()
      ? partial.eventName.trim().slice(0, 60)
      : DEFAULT_SETTINGS.eventName,
  };
}

const DOMAIN_CORRECTIONS: Readonly<Record<string, string>> = {
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outllook.com': 'outlook.com',
  'outlook.con': 'outlook.com',
  'icloud.con': 'icloud.com',
};

export interface PlayerValidation {
  name?: string;
  email?: string;
  /** A helpful suggestion, not a validation error or a deliverability claim. */
  suggestion?: string;
}

export function validatePlayer(player: Player): PlayerValidation {
  const errors: PlayerValidation = {};
  const name = player.name.trim();
  const email = player.email.trim();
  if (name.length < 2) errors.name = 'Please enter your name (at least 2 characters).';
  else if (name.length > 60) errors.name = 'Please use 60 characters or fewer.';
  else if (/[\u0000-\u001f\u007f]/.test(name)) errors.name = 'Please enter a valid name.';

  const parts = email.split('@');
  const local = parts[0] ?? '';
  const domain = (parts[1] ?? '').toLowerCase();
  const labels = domain.split('.');
  const validLocal = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)
    && local.length <= 64 && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..');
  const validDomain = labels.length >= 2
    && labels.every(label => label.length >= 1 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))
    && /^[a-z]{2,63}$/i.test(labels[labels.length - 1] ?? '');
  if (!email || email.length > 254 || parts.length !== 2 || !validLocal || !validDomain) {
    errors.email = 'Please enter a valid email address, such as name@example.com.';
  } else if (DOMAIN_CORRECTIONS[domain]) {
    errors.suggestion = `${local}@${DOMAIN_CORRECTIONS[domain]}`;
  }
  return errors;
}

/** Sample without replacement; duplicate IDs in an imported bank count only once. */
export function createRound(questions: readonly Question[], count = 10, rng: () => number = Math.random): Question[] {
  if (!Number.isInteger(count) || count < 1) throw new RangeError('The round must contain at least one question.');
  const unique = [...new Map(questions.map(question => [question.id, question])).values()];
  if (unique.length < count) throw new RangeError(`The question bank needs at least ${count} unique images; it currently has ${unique.length}.`);
  for (let i = unique.length - 1; i > 0; i -= 1) {
    const random = rng();
    if (!Number.isFinite(random) || random < 0 || random >= 1) throw new RangeError('The random generator must return a number from 0 up to (but not including) 1.');
    const j = Math.floor(random * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }
  return unique.slice(0, count);
}

function safeElapsed(elapsedMs: number): number {
  return Number.isFinite(elapsedMs) ? Math.max(0, Math.floor(elapsedMs)) : Number.MAX_SAFE_INTEGER;
}

/** Wrong answers and answers at/after the deadline earn zero. */
export function scoreAnswer(correct: boolean, elapsedMs: number, rawSettings: GameSettings): number {
  const settings = normalizeSettings(rawSettings);
  const elapsed = safeElapsed(elapsedMs);
  const limit = settings.questionTimeLimitSeconds * 1_000;
  if (!correct || elapsed >= limit) return 0;
  const speedBonus = Math.round(settings.maxSpeedBonus * (1 - elapsed / limit));
  return settings.baseCorrectPoints + speedBonus;
}

export function makeAnswer(question: Question, selected: ImageAnswer | null, elapsedMs: number, rawSettings: GameSettings): Answer {
  const settings = normalizeSettings(rawSettings);
  const elapsed = Math.min(safeElapsed(elapsedMs), settings.questionTimeLimitSeconds * 1_000);
  const correct = selected !== null && selected === question.answer && elapsed < settings.questionTimeLimitSeconds * 1_000;
  return {
    questionId: question.id,
    selected,
    correct,
    elapsedMs: elapsed,
    points: scoreAnswer(correct, elapsed, settings),
  };
}

function resultId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function createResult(player: Player, answers: readonly Answer[], rawSettings: GameSettings, isDemo: boolean): Result {
  const settings = normalizeSettings(rawSettings);
  // Recalculate points from the round's frozen rules; callers cannot inflate stored points.
  const normalizedAnswers = answers.map(answer => {
    const elapsedMs = Math.min(safeElapsed(answer.elapsedMs), settings.questionTimeLimitSeconds * 1_000);
    const correct = answer.correct && answer.selected !== null && elapsedMs < settings.questionTimeLimitSeconds * 1_000;
    return { ...answer, elapsedMs, correct, points: scoreAnswer(correct, elapsedMs, settings) };
  });
  return {
    id: resultId(),
    player: { name: player.name.trim(), email: player.email.trim().toLowerCase() },
    answers: normalizedAnswers,
    score: normalizedAnswers.reduce((sum, answer) => sum + answer.points, 0),
    correctCount: normalizedAnswers.filter(answer => answer.correct).length,
    correctTimeMs: normalizedAnswers.filter(answer => answer.correct).reduce((sum, answer) => sum + answer.elapsedMs, 0),
    totalTimeMs: normalizedAnswers.reduce((sum, answer) => sum + answer.elapsedMs, 0),
    completedAt: new Date().toISOString(),
    settings,
    isDemo,
  };
}

export function rankResults(results: readonly Result[]): Result[] {
  return [...results].sort((a, b) => b.score - a.score
    || a.correctTimeMs - b.correctTimeMs
    || a.completedAt.localeCompare(b.completedAt)
    || a.id.localeCompare(b.id));
}

export function formatTime(ms: number): string {
  const seconds = Math.max(0, Number.isFinite(ms) ? ms / 1_000 : 0);
  return `${seconds.toFixed(1)}s`;
}

function csvCell(value: string | number): string {
  let text = String(value);
  // Spreadsheet apps can interpret formula prefixes after whitespace or controls.
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function exportResultsCsv(results: readonly Result[]): string {
  const rows: (string | number)[][] = [
    ['Rank', 'Agent name', 'Agent email', 'Score', 'Correct answers', 'Questions', 'Correct answer time (seconds)', 'Total time (seconds)', 'Completed at (UTC)', 'Demo', 'Base correct points', 'Maximum speed bonus', 'Question time limit (seconds)'],
    ...rankResults(results).map((result, index) => [
      index + 1, result.player.name, result.player.email, result.score, result.correctCount,
      result.answers.length, (result.correctTimeMs / 1_000).toFixed(3), (result.totalTimeMs / 1_000).toFixed(3),
      result.completedAt, result.isDemo ? 'Yes' : 'No', result.settings.baseCorrectPoints,
      result.settings.maxSpeedBonus, result.settings.questionTimeLimitSeconds,
    ]),
  ];
  return `\ufeff${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
