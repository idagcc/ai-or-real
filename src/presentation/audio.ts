import { useEffect, useSyncExternalStore } from 'react';

export interface AudioPreferences { enabled: boolean; musicVolume: number; effectsVolume: number }
export type AudioPreferenceUpdate = Partial<AudioPreferences> | ((previous: AudioPreferences) => AudioPreferences);
export const DEFAULT_AUDIO_PREFERENCES: Readonly<AudioPreferences> = Object.freeze({ enabled: true, musicVolume: 0.18, effectsVolume: 0.45 });
const STORAGE_KEY = 'ai-or-real.audio.v1';
const listeners = new Set<() => void>();
let preferences: AudioPreferences = { ...DEFAULT_AUDIO_PREFERENCES };
let preferencesLoaded = false;
let music: HTMLAudioElement | null = null;
let context: AudioContext | null = null;
let effectsGain: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;
let unlocked = false;
let unlockPromise: Promise<void> | null = null;
let owners = 0;
let lastTap = -Infinity;
let duckTimer: ReturnType<typeof setTimeout> | undefined;
let ducked = false;
const voices = new Set<AudioScheduledSourceNode>();

const boundedVolume = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
export function normalizeAudioPreferences(value: Partial<AudioPreferences> = {}): AudioPreferences {
  return { enabled: typeof value.enabled === 'boolean' ? value.enabled : true, musicVolume: boundedVolume(value.musicVolume, 0.18), effectsVolume: boundedVolume(value.effectsVolume, 0.45) };
}
function loadPreferences(): void {
  if (preferencesLoaded || typeof window === 'undefined') return;
  preferencesLoaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') preferences = normalizeAudioPreferences(parsed as Partial<AudioPreferences>);
  } catch { /* Audio settings are optional; storage restrictions must not stop the game. */ }
}
function snapshot(): AudioPreferences { loadPreferences(); return preferences; }
function subscribe(callback: () => void): () => void { listeners.add(callback); return () => listeners.delete(callback); }
const serverSnapshot = () => DEFAULT_AUDIO_PREFERENCES as AudioPreferences;

export function setAudioPreferences(update: AudioPreferenceUpdate): void {
  loadPreferences();
  preferences = normalizeAudioPreferences(typeof update === 'function' ? update(preferences) : { ...preferences, ...update });
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch { /* Noncritical preference persistence. */ }
  }
  applyPreferences();
  listeners.forEach(callback => callback());
}
export function useAudioPreferences(): [AudioPreferences, (update: AudioPreferenceUpdate) => void] {
  return [useSyncExternalStore(subscribe, snapshot, serverSnapshot), setAudioPreferences];
}
function ensureMusic(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  if (!music) {
    music = new Audio(new URL('media/music-loop.ogg', document.baseURI).href);
    music.loop = true;
    music.preload = 'auto';
    music.volume = preferences.enabled ? preferences.musicVolume : 0;
  }
  return music;
}
function visible(): boolean { return typeof document !== 'undefined' && !document.hidden; }
function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!context) {
    try {
      const Constructor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Constructor) return null;
      context = new Constructor({ latencyHint: 'interactive' });
      effectsGain = context.createGain();
      effectsGain.gain.value = preferences.enabled ? preferences.effectsVolume * 0.45 : 0;
      compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 16;
      compressor.ratio.value = 6;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.12;
      effectsGain.connect(compressor);
      compressor.connect(context.destination);
    } catch { context = null; effectsGain = null; }
  }
  return context;
}
function stopEffects(): void {
  voices.forEach(voice => { try { voice.stop(); } catch { /* Already ended. */ } });
  voices.clear();
  if (duckTimer) clearTimeout(duckTimer);
  duckTimer = undefined;
  ducked = false;
}
function updateMusicVolume(): void { if (music) music.volume = preferences.enabled ? preferences.musicVolume * (ducked ? 0.65 : 1) : 0; }
function playMusic(): void {
  const audio = ensureMusic();
  if (!audio || !preferences.enabled || !visible() || owners === 0) return;
  if (audio.error) audio.load();
  updateMusicVolume();
  void audio.play().catch(() => { /* Browsers retry after the first interaction; unavailable audio stays silent. */ });
}
function applyPreferences(): void {
  if (effectsGain && context) {
    effectsGain.gain.cancelScheduledValues(context.currentTime);
    effectsGain.gain.setValueAtTime(preferences.enabled ? preferences.effectsVolume * 0.45 : 0, context.currentTime);
  }
  if (!preferences.enabled) { music?.pause(); stopEffects(); }
  else { updateMusicVolume(); if (unlocked) playMusic(); }
}
async function unlock(): Promise<void> {
  loadPreferences();
  if (!preferences.enabled || !visible()) return;
  if (unlockPromise) return unlockPromise;
  unlockPromise = (async () => {
    const audioContext = ensureContext();
    if (audioContext?.state === 'suspended') {
      try { await audioContext.resume(); } catch { /* Retry from a later interaction. */ }
    }
    unlocked = audioContext?.state === 'running';
    playMusic();
  })().finally(() => { unlockPromise = null; });
  return unlockPromise;
}
function readyContext(): AudioContext | null {
  loadPreferences();
  return preferences.enabled && preferences.effectsVolume > 0 && visible() && context?.state === 'running' && effectsGain ? context : null;
}
function track(voice: AudioScheduledSourceNode, nodes: AudioNode[]): void {
  voices.add(voice);
  voice.onended = () => { voices.delete(voice); nodes.forEach(node => node.disconnect()); };
}
function tone(frequency: number, delay: number, duration: number, peak = 0.22, endFrequency = frequency, type: OscillatorType = 'sine'): void {
  const audioContext = readyContext();
  if (!audioContext || !effectsGain) return;
  const at = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, at);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), at + duration);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + Math.min(0.012, duration / 4));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(gain); gain.connect(effectsGain);
  track(oscillator, [oscillator, gain]);
  oscillator.start(at); oscillator.stop(at + duration + 0.02);
}
function duck(duration = 650): void {
  if (!preferences.enabled) return;
  ducked = true; updateMusicVolume();
  if (duckTimer) clearTimeout(duckTimer);
  duckTimer = setTimeout(() => { ducked = false; duckTimer = undefined; updateMusicVolume(); }, duration);
}
function whoosh(): void {
  const audioContext = readyContext();
  if (!audioContext || !effectsGain) return;
  const duration = 0.23;
  const buffer = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate * duration), audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
  const source = audioContext.createBufferSource(); source.buffer = buffer;
  const filter = audioContext.createBiquadFilter(); filter.type = 'bandpass'; filter.Q.value = 0.65;
  filter.frequency.setValueAtTime(450, audioContext.currentTime); filter.frequency.exponentialRampToValueAtTime(1700, audioContext.currentTime + duration);
  const gain = audioContext.createGain(); gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.22, audioContext.currentTime + 0.07); gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
  source.connect(filter); filter.connect(gain); gain.connect(effectsGain); track(source, [source, filter, gain]);
  source.start(); source.stop(audioContext.currentTime + duration + 0.01);
}
export const soundEffects = {
  unlock,
  tap(): void {
    const now = typeof performance === 'undefined' ? Date.now() : performance.now();
    if (now - lastTap < 35) return;
    lastTap = now; tone(640, 0, 0.055, 0.13, 940);
  },
  transition(): void { duck(420); whoosh(); tone(330, 0.015, 0.16, 0.09, 495); },
  correct(): void { duck(); tone(523.25, 0, 0.21); tone(659.25, 0.085, 0.25); tone(783.99, 0.17, 0.3); },
  incorrect(): void { duck(); tone(290, 0, 0.19, 0.18, 230, 'triangle'); tone(230, 0.1, 0.22, 0.12, 190); },
  timeout(): void { duck(); tone(440, 0, 0.12, 0.16); tone(330, 0.16, 0.2, 0.15); },
  complete(): void { duck(1200); [523.25, 659.25, 783.99, 1046.5].forEach((note, index) => tone(note, index * 0.12, index === 3 ? 0.65 : 0.35, 0.22)); },
};
function interaction(event: Event): void {
  if (event instanceof KeyboardEvent && (event.repeat || !['Enter', ' '].includes(event.key))) { void unlock(); return; }
  const target = event.target instanceof Element ? event.target.closest('button,[role="button"]') : null;
  void unlock().then(() => { if (target && !target.hasAttribute('disabled') && target.getAttribute('aria-disabled') !== 'true') soundEffects.tap(); });
}
function visibilityChanged(): void {
  if (!visible()) { music?.pause(); stopEffects(); }
  else if (preferences.enabled) { if (unlocked) void unlock(); playMusic(); }
}
/** One shared engine; mounting and unmounting in React Strict Mode never duplicates loops/listeners. */
export function useAppAudio(): void {
  useEffect(() => {
    loadPreferences(); owners += 1;
    if (owners === 1) {
      document.addEventListener('pointerdown', interaction, { passive: true });
      document.addEventListener('keydown', interaction);
      document.addEventListener('visibilitychange', visibilityChanged);
      playMusic(); // Electron permits autoplay; browsers defer quietly until interaction.
    }
    return () => {
      owners = Math.max(0, owners - 1);
      if (!owners) {
        document.removeEventListener('pointerdown', interaction); document.removeEventListener('keydown', interaction); document.removeEventListener('visibilitychange', visibilityChanged);
        music?.pause(); stopEffects();
      }
    };
  }, []);
}
