import { DEFAULT_SETTINGS, normalizeSettings, type GameSettings, type Result } from './core';

export interface StoredState {
  results: Result[];
  settings: GameSettings;
  warning?: string;
  storagePath?: string;
}

interface NativeStore extends Omit<StoredState, 'settings'> { settings: GameSettings | null }
interface KioskBridge {
  loadStore(): Promise<NativeStore>;
  loadQuestionBank(): Promise<unknown>;
  saveResult(result: Result): Promise<void>;
  saveSettings(settings: GameSettings): Promise<void>;
  clearResults(): Promise<void>;
  exportResults(csv: string): Promise<boolean>;
  setFullscreen(enabled: boolean): Promise<void>;
  onAdminRequested(callback: () => void): () => void;
}

declare global { interface Window { kiosk?: KioskBridge } }

const STORAGE_KEY = 'ai-or-real.store.v1';
const MAX_RESULTS = 50000;

function normalizeStoredSettings(settings: Partial<GameSettings> = {}): GameSettings {
  // Upgrade the previous two-minute default on existing installations too.
  return normalizeSettings({
    ...settings,
    idleTimeoutSeconds: settings.idleTimeoutSeconds === 120
      ? DEFAULT_SETTINGS.idleTimeoutSeconds : settings.idleTimeoutSeconds,
  });
}

function browserStore(): StoredState {
  let raw: string | null;
  try { raw = window.localStorage.getItem(STORAGE_KEY); }
  catch { throw new Error('This browser cannot read local game data. Enable local storage or use the Windows app.'); }
  if (!raw) return { results: [], settings: { ...DEFAULT_SETTINGS } };
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') throw new Error('Invalid store.');
    const state = value as { results?: unknown; settings?: Partial<GameSettings> };
    if (!Array.isArray(state.results) || state.results.length > MAX_RESULTS) throw new Error('Invalid leaderboard.');
    const results = state.results as Result[];
    for (const result of results) {
      if (!result || typeof result.id !== 'string' || !result.player || typeof result.player.name !== 'string' ||
        typeof result.player.email !== 'string' || !Array.isArray(result.answers) || !Number.isFinite(result.score) ||
        !Number.isFinite(result.correctTimeMs) || !Number.isFinite(result.totalTimeMs) ||
        !Number.isFinite(result.correctCount) || !Number.isFinite(Date.parse(result.completedAt))) {
        throw new Error('Invalid result.');
      }
    }
    return { results, settings: normalizeStoredSettings(state.settings || {}) };
  } catch {
    throw new Error('The saved browser leaderboard could not be read. Its data has been preserved; contact the operator.');
  }
}

function writeBrowserStore(state: StoredState): void {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ results: state.results, settings: state.settings })); }
  catch { throw new Error('The result could not be saved. Local storage may be full or disabled. Ask the operator to export the leaderboard and free space, then retry.'); }
}

export async function loadStore(): Promise<StoredState> {
  if (window.kiosk) {
    const loaded = await window.kiosk.loadStore();
    return { ...loaded, settings: normalizeStoredSettings(loaded.settings || {}) };
  }
  return browserStore();
}

export async function saveResult(result: Result): Promise<void> {
  if (window.kiosk) return window.kiosk.saveResult(result);
  const state = browserStore();
  const existing = state.results.findIndex((item) => item.id === result.id);
  if (existing >= 0) state.results[existing] = result;
  else {
    if (state.results.length >= MAX_RESULTS) throw new Error('The leaderboard is full. Ask the operator to export and clear it.');
    state.results.push(result);
  }
  writeBrowserStore(state);
}

export async function saveSettings(settings: GameSettings): Promise<void> {
  const normalized = normalizeSettings(settings);
  if (window.kiosk) return window.kiosk.saveSettings(normalized);
  writeBrowserStore({ ...browserStore(), settings: normalized });
}

export async function clearResults(): Promise<void> {
  if (window.kiosk) return window.kiosk.clearResults();
  writeBrowserStore({ ...browserStore(), results: [] });
}

export async function exportResults(csv: string): Promise<boolean> {
  if (window.kiosk) return window.kiosk.exportResults(csv);
  const url = URL.createObjectURL(new Blob([csv.startsWith('\uFEFF') ? csv : '\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `AI-or-Real-results-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export async function setFullscreen(enabled: boolean): Promise<void> {
  if (window.kiosk) return window.kiosk.setFullscreen(enabled);
  if (enabled && !document.fullscreenElement) {
    if (!document.documentElement.requestFullscreen) throw new Error('Fullscreen is unavailable in this browser.');
    await document.documentElement.requestFullscreen();
  } else if (!enabled && document.fullscreenElement) await document.exitFullscreen();
}

export function onAdminRequested(callback: () => void): () => void {
  if (window.kiosk) return window.kiosk.onAdminRequested(callback);
  const handler = (event: KeyboardEvent) => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      callback();
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}

/** Windows allows an external content/questions.json override beside its saved data. */
export async function loadQuestionBank(): Promise<unknown> {
  if (window.kiosk) return window.kiosk.loadQuestionBank();
  const response = await fetch('./questions.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('The question bank could not be loaded. Ask the operator to check questions.json.');
  const text = await response.text();
  if (text.length > 2 * 1024 * 1024) throw new Error('The question bank is too large (maximum 2 MB).');
  try { return JSON.parse(text); }
  catch { throw new Error('The question bank is not valid JSON. Ask the operator to check questions.json.'); }
}
